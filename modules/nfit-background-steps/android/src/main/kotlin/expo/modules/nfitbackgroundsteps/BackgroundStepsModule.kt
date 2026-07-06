package expo.modules.nfitbackgroundsteps

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BackgroundStepsModule : Module() {
  private val prefs: SharedPreferences
    get() = appContext.reactContext?.let {
      it.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    } ?: throw IllegalStateException("React context not available")

  override fun definition(): ModuleDefinition = ModuleDefinition {
    Name("NfitBackgroundSteps")

    Events("onStepsUpdate")

    OnCreate {
      StepTrackerService.setCurrentListener(this@BackgroundStepsModule)
      val ctx = appContext.reactContext ?: return@OnCreate
      val steps = prefs.getInt(KEY_ACCUMULATED_STEPS, 0)
      if (steps > 0) {
        sendEvent("onStepsUpdate", mapOf("steps" to steps))
      }
    }

    OnDestroy {
      StepTrackerService.setCurrentListener(null)
    }

    AsyncFunction("startService") {
      val ctx = appContext.reactContext ?: return@AsyncFunction
      ctx.startForegroundService(Intent(ctx, StepTrackerService::class.java))
    }

    AsyncFunction("stopService") {
      val ctx = appContext.reactContext ?: return@AsyncFunction
      ctx.stopService(Intent(ctx, StepTrackerService::class.java))
    }

    AsyncFunction("getAccumulatedSteps") {
      return@AsyncFunction prefs.getInt(KEY_ACCUMULATED_STEPS, 0)
    }
  }

  fun emitStepsUpdate(steps: Int) {
    sendEvent("onStepsUpdate", mapOf("steps" to steps))
  }

  companion object {
    const val PREFS_NAME = "nfit_background_steps"
    const val KEY_ACCUMULATED_STEPS = "accumulated_steps"
    const val KEY_LAST_SENSOR_TOTAL = "last_sensor_total"
    const val KEY_SERVICE_RUNNING = "service_running"
  }
}
