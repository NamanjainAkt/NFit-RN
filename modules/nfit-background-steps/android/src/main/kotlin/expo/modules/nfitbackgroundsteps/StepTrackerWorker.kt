package expo.modules.nfitbackgroundsteps

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.WorkRequest
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume

class StepTrackerWorker(
  appContext: Context,
  params: WorkerParameters
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    try {
      val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val sensorManager = applicationContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      val stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        ?: return@withContext Result.success()

      val currentTotal = readStepCount(sensorManager, stepSensor)
      val lastTotal = prefs.getFloat(KEY_LAST_SENSOR_TOTAL, currentTotal)
      val accumulated = prefs.getInt(KEY_ACCUMULATED_STEPS, 0)

      if (currentTotal > lastTotal) {
        val delta = (currentTotal - lastTotal).toInt()
        if (delta > 0 && delta < 5000) {
          val newAccumulated = accumulated + delta
          prefs.edit()
            .putInt(KEY_ACCUMULATED_STEPS, newAccumulated)
            .putFloat(KEY_LAST_SENSOR_TOTAL, currentTotal)
            .putBoolean(KEY_SERVICE_RUNNING, false)
            .apply()
          Log.d(TAG, "Worker: accumulated $newAccumulated steps (delta=$delta)")
        }
      }

      Result.success()
    } catch (e: Exception) {
      Log.e(TAG, "Worker failed", e)
      Result.retry()
    }
  }

  private suspend fun readStepCount(
    sensorManager: SensorManager,
    sensor: Sensor
  ): Float = suspendCancellableCoroutine { continuation ->
    val handler = Handler(Looper.getMainLooper())
    val listener = object : SensorEventListener {
      override fun onSensorChanged(event: SensorEvent) {
        sensorManager.unregisterListener(this)
        if (!continuation.isCancelled && event.values.isNotEmpty()) {
          continuation.resume(event.values[0])
        }
      }

      override fun onAccuracyChanged(s: Sensor?, accuracy: Int) {}
    }

    val registered = sensorManager.registerListener(
      listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, handler
    )

    if (!registered) {
      if (!continuation.isCancelled) {
        continuation.resume(0f)
      }
      return@suspendCancellableCoroutine
    }

    continuation.invokeOnCancellation {
      sensorManager.unregisterListener(listener)
    }
  }

  companion object {
    const val PREFS_NAME = "nfit_background_steps"
    const val KEY_ACCUMULATED_STEPS = "accumulated_steps"
    const val KEY_LAST_SENSOR_TOTAL = "last_sensor_total"
    const val KEY_SERVICE_RUNNING = "service_running"
    const val WORK_NAME = "nfit_background_step_tracking"
    const val TAG = "StepTrackerWorker"

    fun enqueuePeriodicWork(context: Context) {
      val constraints = Constraints.Builder()
        .setRequiresBatteryNotLow(true)
        .build()

      val request = PeriodicWorkRequest.Builder(
        StepTrackerWorker::class.java,
        15, TimeUnit.MINUTES
      )
        .setConstraints(constraints)
        .setBackoffCriteria(
          BackoffPolicy.LINEAR,
          WorkRequest.MIN_BACKOFF_MILLIS,
          TimeUnit.MILLISECONDS
        )
        .build()

      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        request
      )
    }
  }
}
