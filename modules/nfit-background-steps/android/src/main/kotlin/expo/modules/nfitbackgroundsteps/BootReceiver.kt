package expo.modules.nfitbackgroundsteps

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      Log.d("BootReceiver", "Boot completed, restarting step tracker")

      val prefs = context.getSharedPreferences(
        StepTrackerService.PREFS_NAME, Context.MODE_PRIVATE
      )

      if (prefs.getBoolean(StepTrackerService.KEY_SERVICE_RUNNING, false)) {
        val serviceIntent = Intent(context, StepTrackerService::class.java)
        context.startForegroundService(serviceIntent)
        Log.d("BootReceiver", "Step tracker service restarted after boot")
      }
    }
  }
}
