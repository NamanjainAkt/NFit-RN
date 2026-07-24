package expo.modules.nfitbackgroundsteps

import android.content.Context
import android.content.SharedPreferences
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.modules.ModuleDefinitionData

class BackgroundStepsModule : Module() {
  private val prefs: SharedPreferences
    get() = appContext.reactContext?.let {
      it.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    } ?: throw IllegalStateException("React context not available")

  override fun definition(): ModuleDefinitionData = ModuleDefinition {
    Name("NfitBackgroundSteps")

    AsyncFunction("getAccumulatedSteps") {
      prefs.getInt(KEY_ACCUMULATED_STEPS, 0)
    }

    AsyncFunction("resetAccumulatedSteps") {
      prefs.edit().putInt(KEY_ACCUMULATED_STEPS, 0).apply()
    }
  }

  companion object {
    const val PREFS_NAME = "nfit_background_steps"
    const val KEY_ACCUMULATED_STEPS = "accumulated_steps"
  }
}
