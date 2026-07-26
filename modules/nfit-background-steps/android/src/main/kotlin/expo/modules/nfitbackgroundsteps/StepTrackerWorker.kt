package expo.modules.nfitbackgroundsteps

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * WorkManager watchdog that runs every 15 minutes to ensure
 * StepTrackerService is alive. If the service was killed by an
 * OEM battery saver or a system resource reclaim, this restarts it.
 *
 * Calling startService when it's already running is a safe no-op
 * (triggers onStartCommand with START_STICKY).
 */
class StepTrackerWorker(
  appContext: Context,
  params: WorkerParameters
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    try {
      StepTrackerService.checkAndResetIfNewDay(applicationContext)
      StepTrackerService.startService(applicationContext)
      Log.d(TAG, "Watchdog: ensured StepTrackerService is running")
      Result.success()
    } catch (e: Exception) {
      Log.e(TAG, "Watchdog: failed to (re)start service", e)
      Result.retry()
    }
  }

  companion object {
    private const val TAG = "StepTrackerWatchdog"
    private const val WORK_NAME = "nfit_step_service_watchdog"

    /**
     * Enqueue a periodic 15-minute watchdog. Uses KEEP policy so
     * multiple enqueue calls are idempotent.
     */
    fun enqueueWatchdog(context: Context) {
      val request = PeriodicWorkRequest.Builder(
        StepTrackerWorker::class.java,
        15, TimeUnit.MINUTES
      ).build()

      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        request
      )
    }
  }
}
