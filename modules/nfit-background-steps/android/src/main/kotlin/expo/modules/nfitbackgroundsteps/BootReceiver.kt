package expo.modules.nfitbackgroundsteps

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    if (context == null || intent == null) return

    val action = intent.action
    Log.d(TAG, "BootReceiver received action: $action")

    if (Intent.ACTION_BOOT_COMPLETED == action || Intent.ACTION_MY_PACKAGE_REPLACED == action) {
      try {
        StepTrackerService.startService(context)
        Log.d(TAG, "Successfully started StepTrackerService on boot/update")
      } catch (e: Exception) {
        Log.e(TAG, "Failed to start StepTrackerService on boot", e)
      }
    }
  }

  companion object {
    private const val TAG = "NfitBootReceiver"
  }
}
