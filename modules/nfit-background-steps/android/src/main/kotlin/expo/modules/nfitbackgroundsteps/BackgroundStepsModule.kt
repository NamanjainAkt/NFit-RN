package expo.modules.nfitbackgroundsteps

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.modules.ModuleDefinitionData

class BackgroundStepsModule : Module() {
  private val context: Context?
    get() = appContext.reactContext

  private val prefs: SharedPreferences?
    get() = context?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  override fun definition(): ModuleDefinitionData = ModuleDefinition {
    Name("NfitBackgroundSteps")

    // ── Service lifecycle ───────────────────────────────────────────

    AsyncFunction("startService") {
      val ctx = context ?: return@AsyncFunction false
      try {
        StepTrackerService.startService(ctx)
        true
      } catch (e: Exception) {
        Log.e(TAG, "startService failed", e)
        false
      }
    }

    AsyncFunction("stopService") {
      val ctx = context ?: return@AsyncFunction false
      try {
        StepTrackerService.stopService(ctx)
        true
      } catch (e: Exception) {
        Log.e(TAG, "stopService failed", e)
        false
      }
    }

    AsyncFunction("isServiceRunning") {
      prefs?.getBoolean(KEY_SERVICE_ALIVE, false) ?: false
    }

    // ── Daily step total (single source of truth) ───────────────────

    /**
     * Returns today's total step count as tracked by the native service.
     * This is the primary API for the JS layer to read steps.
     */
    AsyncFunction("getTotalDailySteps") {
      prefs?.getInt(KEY_DAILY_TOTAL_STEPS, 0) ?: 0
    }

    /**
     * Seeds the daily step total. Used by the JS layer on startup to
     * ensure the native count includes steps from SQLite history
     * (e.g. after a service restart mid-day).
     */
    AsyncFunction("setTotalDailySteps") { steps: Int ->
      val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
      prefs?.edit()
        ?.putInt(KEY_DAILY_TOTAL_STEPS, steps)
        ?.putString(KEY_DAILY_STEPS_DATE, today)
        ?.putInt(KEY_ACCUMULATED_STEPS, steps) // backward compat
        ?.apply()
    }

    AsyncFunction("getDailyStepsDate") {
      prefs?.getString(KEY_DAILY_STEPS_DATE, "") ?: ""
    }

    AsyncFunction("resetSensorBaseline") {
      prefs?.edit()
        ?.remove(KEY_LAST_SENSOR_TOTAL) // Clear baseline to force reset
        ?.apply()
    }

    // ── Backward-compatible aliases ─────────────────────────────────

    AsyncFunction("getAccumulatedSteps") {
      // Now returns the same daily total for backward compatibility
      prefs?.getInt(KEY_DAILY_TOTAL_STEPS, 0) ?: 0
    }

    AsyncFunction("resetAccumulatedSteps") {
      prefs?.edit()
        ?.putInt(KEY_DAILY_TOTAL_STEPS, 0)
        ?.putInt(KEY_ACCUMULATED_STEPS, 0)
        ?.apply()
    }

    // ── Battery optimization ────────────────────────────────────────

    /**
     * Returns true if the app is already exempt from battery optimization.
     */
    AsyncFunction("isBatteryOptimized") {
      val ctx = context ?: return@AsyncFunction true
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        return@AsyncFunction !pm.isIgnoringBatteryOptimizations(ctx.packageName)
      } else {
        return@AsyncFunction false
      }
    }

    /**
     * Opens the system dialog asking the user to exempt this app
     * from battery optimization, ensuring the step tracking service
     * survives aggressive battery savers (Xiaomi, Samsung, Oppo, etc.).
     */
    AsyncFunction("requestBatteryOptimizationExemption") {
      val ctx = context ?: return@AsyncFunction false
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
          if (pm.isIgnoringBatteryOptimizations(ctx.packageName)) {
            return@AsyncFunction true // Already exempt
          }
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${ctx.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          ctx.startActivity(intent)
          true
        } else {
          true // Pre-M doesn't have battery optimization
        }
      } catch (e: Exception) {
        Log.e(TAG, "Battery optimization request failed", e)
        false
      }
    }
  }

  companion object {
    private const val TAG = "NfitBackgroundSteps"
    const val PREFS_NAME = "nfit_background_steps"
    const val KEY_DAILY_TOTAL_STEPS = "daily_total_steps"
    const val KEY_ACCUMULATED_STEPS = "accumulated_steps"
    const val KEY_SERVICE_ALIVE = "service_alive"
    const val KEY_DAILY_STEPS_DATE = "daily_steps_date"
    const val KEY_LAST_SENSOR_TOTAL = "last_sensor_total"
  }
}
