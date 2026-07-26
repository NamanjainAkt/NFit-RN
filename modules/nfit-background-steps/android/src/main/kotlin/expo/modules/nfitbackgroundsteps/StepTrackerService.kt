package expo.modules.nfitbackgroundsteps

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Foreground service that continuously counts steps using the hardware
 * TYPE_STEP_COUNTER sensor. This is the single source of truth for step
 * counting — the JS layer polls the daily total from SharedPreferences
 * instead of counting independently.
 *
 * TYPE_STEP_COUNTER is hardware-backed on virtually all Android devices
 * (API 19+). It uses the low-power co-processor and has built-in shake/
 * vibration rejection, so no custom burst filter is needed.
 */
class StepTrackerService : Service(), SensorEventListener {

  private lateinit var sensorManager: SensorManager
  private var stepCounterSensor: Sensor? = null
  private lateinit var prefs: SharedPreferences

  private var lastWidgetUpdateSteps = 0

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "StepTrackerService onCreate")

    prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    createNotificationChannel()
    startForegroundServiceWithNotification()

    prefs.edit().putBoolean(KEY_SERVICE_ALIVE, true).apply()
    checkAndResetIfNewDay(applicationContext)

    // Enqueue WorkManager watchdog to restart this service if it ever dies
    StepTrackerWorker.enqueueWatchdog(applicationContext)

    if (stepCounterSensor != null) {
      val registered = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
        sensorManager.registerListener(
          this,
          stepCounterSensor,
          SensorManager.SENSOR_DELAY_NORMAL,
          0 // deliver immediately
        )
      } else {
        sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL)
      }
      Log.d(TAG, "TYPE_STEP_COUNTER registered: $registered")
    } else {
      Log.w(TAG, "TYPE_STEP_COUNTER not available. Falling back to TYPE_STEP_DETECTOR.")
      val stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
      if (stepDetectorSensor != null) {
        sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_NORMAL)
        Log.d(TAG, "TYPE_STEP_DETECTOR registered")
      } else {
        Log.e(TAG, "No step tracking sensors available on this device")
      }
    }

    lastWidgetUpdateSteps = prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d(TAG, "StepTrackerService onStartCommand")
    checkAndResetIfNewDay(applicationContext)
    try {
      startForegroundServiceWithNotification()
    } catch (e: Exception) {
      Log.e(TAG, "Failed to start foreground service in onStartCommand", e)
      stopSelf()
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onSensorChanged(event: SensorEvent?) {
    if (event == null || event.values.isEmpty()) return

    val isCounter = event.sensor.type == Sensor.TYPE_STEP_COUNTER
    val isDetector = event.sensor.type == Sensor.TYPE_STEP_DETECTOR

    if (!isCounter && !isDetector) return

    val today = getTodayDateString()
    val storedDate = prefs.getString(KEY_DAILY_STEPS_DATE, "") ?: ""
    if (storedDate != today) {
      prefs.edit()
        .putInt(KEY_DAILY_TOTAL_STEPS, 0)
        .putString(KEY_DAILY_STEPS_DATE, today)
        .putInt(KEY_ACCUMULATED_STEPS, 0)
        .apply()
      lastWidgetUpdateSteps = 0
      updateNotification(0)
      triggerWidgetUpdateBroadcast()
      Log.d(TAG, "Day rollover → reset for $today")
      // Do not return here! Let the rest of the function process the delta and apply it to the new 0 baseline.
    }

    if (isDetector) {
      // Step detector fires once per step. Just increment by 1.
      val currentDailyTotal = prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0)
      val newDailyTotal = currentDailyTotal + 1
      
      prefs.edit()
        .putInt(KEY_DAILY_TOTAL_STEPS, newDailyTotal)
        .putInt(KEY_ACCUMULATED_STEPS, newDailyTotal)
        .apply()
        
      Log.d(TAG, "Detector Steps +1 → daily total: $newDailyTotal")
      updateNotification(newDailyTotal)
      if (Math.abs(newDailyTotal - lastWidgetUpdateSteps) >= 10) {
        lastWidgetUpdateSteps = newDailyTotal
        triggerWidgetUpdateBroadcast()
      }
      return
    }

    // --- TYPE_STEP_COUNTER LOGIC ---
    val currentSensorTotal = event.values[0]
    if (currentSensorTotal <= 0) return

    val savedLastSensor = prefs.getFloat(KEY_LAST_SENSOR_TOTAL, -1f)
    if (savedLastSensor < 0f) {
      prefs.edit()
        .putFloat(KEY_LAST_SENSOR_TOTAL, currentSensorTotal)
        .putString(KEY_DAILY_STEPS_DATE, today)
        .apply()
      return
    }

    if (currentSensorTotal >= savedLastSensor) {
      val delta = (currentSensorTotal - savedLastSensor).toInt()
      if (delta > 0) {
        val currentDailyTotal = prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0)
        val newDailyTotal = currentDailyTotal + delta
        prefs.edit()
          .putInt(KEY_DAILY_TOTAL_STEPS, newDailyTotal)
          .putFloat(KEY_LAST_SENSOR_TOTAL, currentSensorTotal)
          .putInt(KEY_ACCUMULATED_STEPS, newDailyTotal)
          .apply()
        Log.d(TAG, "Steps +$delta → daily total: $newDailyTotal")
        updateNotification(newDailyTotal)
        if (Math.abs(newDailyTotal - lastWidgetUpdateSteps) >= 10) {
          lastWidgetUpdateSteps = newDailyTotal
          triggerWidgetUpdateBroadcast()
        }
      }
    } else {
      val delta = currentSensorTotal.toInt()
      val currentDailyTotal = prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0)
      val newDailyTotal = currentDailyTotal + delta
      prefs.edit()
        .putInt(KEY_DAILY_TOTAL_STEPS, newDailyTotal)
        .putFloat(KEY_LAST_SENSOR_TOTAL, currentSensorTotal)
        .putInt(KEY_ACCUMULATED_STEPS, newDailyTotal)
        .apply()
      Log.d(TAG, "Sensor reboot detected. Steps +$delta → daily total: $newDailyTotal")
      updateNotification(newDailyTotal)
      triggerWidgetUpdateBroadcast()
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun onDestroy() {
    super.onDestroy()
    Log.d(TAG, "StepTrackerService onDestroy")
    prefs.edit().putBoolean(KEY_SERVICE_ALIVE, false).apply()
    try {
      sensorManager.unregisterListener(this)
    } catch (e: Exception) {
      Log.e(TAG, "Error unregistering sensor listener", e)
    }
  }

  /**
   * Called when the user swipes the app away from Recents.
   * Schedule a restart so step tracking continues uninterrupted.
   */
  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    Log.d(TAG, "onTaskRemoved — scheduling restart in 3s")
    try {
      val restartIntent = Intent(applicationContext, StepTrackerService::class.java).apply {
        setPackage(packageName)
      }
      val pendingIntent = PendingIntent.getService(
        this, 1, restartIntent,
        PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
      )
      val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(
          AlarmManager.ELAPSED_REALTIME_WAKEUP,
          SystemClock.elapsedRealtime() + 3000,
          pendingIntent
        )
      } else {
        alarmManager.setExact(
          AlarmManager.ELAPSED_REALTIME_WAKEUP,
          SystemClock.elapsedRealtime() + 3000,
          pendingIntent
        )
      }
    } catch (e: Exception) {
      Log.e(TAG, "Failed to schedule restart on task removed", e)
    }
  }



  // ── Helpers ───────────────────────────────────────────────────────────

  private fun getTodayDateString(): String {
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
  }

  // ── Notification ──────────────────────────────────────────────────────

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Nfit Step Tracking",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Continuous step tracking in the background"
        setShowBadge(false)
      }
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(dailySteps: Int): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this, 0, launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Nfit Step Tracker")
      .setContentText("$dailySteps steps today")
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  private fun startForegroundServiceWithNotification() {
    val notification = buildNotification(prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0))
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      Log.e(TAG, "Fatal error: Missing ACTIVITY_RECOGNITION or POST_NOTIFICATIONS permission", e)
      stopSelf()
    }
  }

  private fun updateNotification(dailySteps: Int) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification(dailySteps))
  }

  // ── Widget ────────────────────────────────────────────────────────────

  private fun triggerWidgetUpdateBroadcast() {
    try {
      val intent = Intent("com.reactnativeandroidwidget.UPDATE")
      intent.setPackage(packageName)
      sendBroadcast(intent)

      val appWidgetManager = AppWidgetManager.getInstance(applicationContext)
      val componentName = ComponentName(packageName, "com.nfit.app.widget.NfitWidget")
      val widgetIds = appWidgetManager.getAppWidgetIds(componentName)
      if (widgetIds != null && widgetIds.isNotEmpty()) {
        val updateIntent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
          component = componentName
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds)
        }
        sendBroadcast(updateIntent)
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error sending widget update broadcast", e)
    }
  }

  // ── Constants & Static ────────────────────────────────────────────────

  companion object {
    private const val TAG = "StepTrackerService"
    private const val WIDGET_BROADCAST_ACTION = "com.nfit.WIDGET_UPDATE_STEPS"
    const val PREFS_NAME = "nfit_background_steps"
    const val KEY_DAILY_TOTAL_STEPS = "daily_total_steps"
    const val KEY_DAILY_STEPS_DATE = "daily_steps_date"
    const val KEY_LAST_SENSOR_TOTAL = "last_sensor_total"
    const val KEY_ACCUMULATED_STEPS = "accumulated_steps" // backward compat
    const val KEY_SERVICE_ALIVE = "service_alive"
    private const val CHANNEL_ID = "nfit_background_step_channel"
    private const val NOTIFICATION_ID = 1001

    fun checkAndResetIfNewDay(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val storedDate = prefs.getString(KEY_DAILY_STEPS_DATE, "") ?: ""
        
        if (storedDate.isNotEmpty() && storedDate != today) {
            prefs.edit()
                .putInt(KEY_DAILY_TOTAL_STEPS, 0)
                .putString(KEY_DAILY_STEPS_DATE, today)
                .putInt(KEY_ACCUMULATED_STEPS, 0)
                .apply()
            Log.d(TAG, "checkAndResetIfNewDay: Reset for $today")
        }
    }

    fun startService(context: Context) {
      val intent = Intent(context, StepTrackerService::class.java)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (e: Exception) {
        Log.e(TAG, "Failed to start StepTrackerService: missing permissions", e)
      }
    }

    fun stopService(context: Context) {
      val intent = Intent(context, StepTrackerService::class.java)
      context.stopService(intent)
    }
  }
}
