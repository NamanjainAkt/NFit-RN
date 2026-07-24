package expo.modules.nfitactivity

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.modules.ModuleDefinitionData

private const val TAG = "NfitActivity"
private const val ACTION_ACTIVITY = "expo.modules.nfitactivity.DETECTED_ACTIVITY"

class NfitActivityModule : Module() {

  private var currentActivity: DetectedActivityData? = null
  private var receiverRegistered = false
  private val receiver = ActivityBroadcastReceiver()

  override fun definition(): ModuleDefinitionData = ModuleDefinition {
    Name("NfitActivity")

    AsyncFunction("getCurrentActivity") {
      currentActivity
    }

    AsyncFunction("startMonitoring") {
      registerReceiver()
      requestActivityUpdates()
    }

    AsyncFunction("stopMonitoring") {
      removeActivityUpdates()
      unregisterReceiver()
    }

    OnDestroy {
      removeActivityUpdates()
      unregisterReceiver()
    }
  }

  private fun getAppContext(): Context? {
    appContext.reactContext?.let { return it }
    appContext.currentActivity?.applicationContext?.let { return it }
    return null
  }

  private fun requestActivityUpdates() {
    try {
      val ctx = getAppContext() ?: return
      val client = ActivityRecognition.getClient(ctx)
      val intent = Intent(ACTION_ACTIVITY).apply {
        setPackage(ctx.packageName)
      }
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      else
        PendingIntent.FLAG_UPDATE_CURRENT
      val pendingIntent = PendingIntent.getBroadcast(ctx, 0, intent, flags)
      client.requestActivityUpdates(30000, pendingIntent)
      Log.d(TAG, "Activity updates requested (30s interval)")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to request activity updates", e)
    }
  }

  private fun removeActivityUpdates() {
    try {
      val ctx = getAppContext() ?: return
      val client = ActivityRecognition.getClient(ctx)
      val intent = Intent(ACTION_ACTIVITY).apply {
        setPackage(ctx.packageName)
      }
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      else
        PendingIntent.FLAG_UPDATE_CURRENT
      val pendingIntent = PendingIntent.getBroadcast(ctx, 0, intent, flags)
      client.removeActivityUpdates(pendingIntent)
      Log.d(TAG, "Activity updates removed")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to remove activity updates", e)
    }
  }

  private fun registerReceiver() {
    if (receiverRegistered) return
    try {
      val ctx = getAppContext() ?: return
      receiver.module = this
      ctx.registerReceiver(receiver, IntentFilter(ACTION_ACTIVITY),
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) Context.RECEIVER_EXPORTED else 0)
      receiverRegistered = true
      Log.d(TAG, "Activity receiver registered")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to register receiver", e)
    }
  }

  private fun unregisterReceiver() {
    if (!receiverRegistered) return
    try {
      val ctx = getAppContext() ?: return
      ctx.unregisterReceiver(receiver)
      receiverRegistered = false
      Log.d(TAG, "Activity receiver unregistered")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to unregister receiver", e)
    }
  }

  fun onActivityDetected(activity: DetectedActivityData) {
    currentActivity = activity
    Log.d(TAG, "Activity: ${activity.type} (${activity.confidence}%)")
  }

  class ActivityBroadcastReceiver : BroadcastReceiver() {
    var module: NfitActivityModule? = null

    override fun onReceive(context: Context, intent: Intent) {
      if (ACTION_ACTIVITY != intent.action) return
      if (!ActivityRecognitionResult.hasResult(intent)) return

      val result = ActivityRecognitionResult.extractResult(intent) ?: return
      val mostProbable = result.mostProbableActivity ?: return

      val typeName = when (mostProbable.type) {
        DetectedActivity.IN_VEHICLE -> "IN_VEHICLE"
        DetectedActivity.ON_BICYCLE -> "CYCLING"
        DetectedActivity.ON_FOOT -> "ON_FOOT"
        DetectedActivity.RUNNING -> "RUNNING"
        DetectedActivity.STILL -> "STILL"
        DetectedActivity.TILTING -> "TILTING"
        DetectedActivity.WALKING -> "WALKING"
        else -> "UNKNOWN"
      }

      module?.onActivityDetected(
        DetectedActivityData(typeName, mostProbable.confidence)
      )
    }
  }
}

data class DetectedActivityData(
  val type: String,
  val confidence: Int
)
