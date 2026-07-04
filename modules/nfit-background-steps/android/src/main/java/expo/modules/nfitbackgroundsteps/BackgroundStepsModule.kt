package expo.modules.nfitbackgroundsteps

import android.content.Intent
import android.os.PowerManager
import android.content.Context
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BackgroundStepsModule : Module() {

    private var hasEmittedSinceRegister = false

    override fun definition() = ModuleDefinition {
        Name("BackgroundStepsModule")

        Events("onStepsUpdate")

        OnCreate {
            StepTrackerService.currentListener = this@BackgroundStepsModule
        }

        OnDestroy {
            StepTrackerService.currentListener = null
        }

        AsyncFunction("startService") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            context.startService(Intent(context, StepTrackerService::class.java))
            null
        }

        AsyncFunction("stopService") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            context.stopService(Intent(context, StepTrackerService::class.java))
            null
        }

        AsyncFunction("getAccumulatedSteps") {
            val context = appContext.reactContext ?: return@AsyncFunction 0
            StepTrackerService.getAccumulatedSteps(context)
        }

        AsyncFunction("isServiceRunning") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            StepTrackerService.isRunning(context)
        }

        AsyncFunction("resetForNewDay") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            val intent = Intent(context, StepTrackerService::class.java).apply {
                action = "ACTION_RESET_FOR_NEW_DAY"
            }
            context.startService(intent)
            null
        }

        AsyncFunction("isIgnoringBatteryOptimizations") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            powerManager?.isIgnoringBatteryOptimizations(context.packageName) ?: false
        }

        AsyncFunction("requestIgnoreBatteryOptimizations") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            null
        }
    }

    fun emitStepsUpdate(steps: Int) {
        try {
            sendEvent("onStepsUpdate", mapOf("steps" to steps))
            hasEmittedSinceRegister = true
        } catch (e: Exception) {
            android.util.Log.w("BackgroundStepsModule", "Failed to emit: ${e.message}")
        }
    }
}
