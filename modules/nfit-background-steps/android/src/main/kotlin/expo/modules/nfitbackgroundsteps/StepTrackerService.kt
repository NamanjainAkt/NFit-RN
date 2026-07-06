package expo.modules.nfitbackgroundsteps

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.SensorManager.SENSOR_DELAY_NORMAL
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class StepTrackerService : Service() {

  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private var sensorManager: SensorManager? = null
  private var stepCounterSensor: Sensor? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var accumulatedSteps = 0
  private var lastSensorTotal = 0f
  private var isFirstEvent = true

  private val prefs: SharedPreferences
    get() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private val sensorEventListener = object : SensorEventListener {
    override fun onSensorChanged(event: SensorEvent) {
      if (event.values.isEmpty()) return

      val currentTotal = event.values[0]

      if (isFirstEvent) {
        if (lastSensorTotal == 0f) {
          lastSensorTotal = currentTotal
        }
        isFirstEvent = false
      }

      if (currentTotal > lastSensorTotal) {
        val delta = (currentTotal - lastSensorTotal).toInt()
        if (delta > 0 && delta < 1000) {
          accumulatedSteps += delta
          Log.d(TAG, "Steps delta=$delta, accumulated=$accumulatedSteps")

          scope.launch {
            persistState()
            emitStepsUpdate(accumulatedSteps)
            updateNotification()
          }
        }
      }

      lastSensorTotal = currentTotal
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
  }

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "Service creating")
    createNotificationChannel()

    accumulatedSteps = prefs.getInt(KEY_ACCUMULATED_STEPS, 0)
    lastSensorTotal = prefs.getFloat(KEY_LAST_SENSOR_TOTAL, 0f)

    sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
    stepCounterSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    acquireWakeLock()
    registerSensor()

    if (Build.VERSION.SDK_INT >= 34) {
      val type = 512 // FOREGROUND_SERVICE_TYPE_HEALTH
      startForeground(NOTIFICATION_ID, buildNotification(), type)
    } else {
      @Suppress("DEPRECATION")
      startForeground(NOTIFICATION_ID, buildNotification())
    }

    Log.d(TAG, "Service created, accumulated=$accumulatedSteps")
  }

  @Suppress("DEPRECATION")
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopSelf()
        return START_NOT_STICKY
      }
    }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    scope.cancel()
    unregisterSensor()
    releaseWakeLock()
    instance = null
    Log.d(TAG, "Service destroyed")
    super.onDestroy()
  }

  private fun registerSensor() {
    stepCounterSensor?.let { sensor ->
      val handler = Handler(Looper.getMainLooper())
      sensorManager?.registerListener(sensorEventListener, sensor, SENSOR_DELAY_NORMAL, handler)
    }
  }

  private fun unregisterSensor() {
    sensorManager?.unregisterListener(sensorEventListener)
  }

  private fun persistState() {
    prefs.edit()
      .putInt(KEY_ACCUMULATED_STEPS, accumulatedSteps)
      .putFloat(KEY_LAST_SENSOR_TOTAL, lastSensorTotal)
      .putBoolean(KEY_SERVICE_RUNNING, true)
      .apply()
  }

  private fun emitStepsUpdate(steps: Int) {
    currentListener?.emitStepsUpdate(steps)
  }

  fun getAccumulatedSteps(): Int = accumulatedSteps

  // Called from JS side to sync profile data
  fun syncProfileData(goal: Int, calories: Int, distance: Double, streak: Int) {
    prefs.edit()
      .putInt("step_goal", goal)
      .putInt("step_calories", calories)
      .putFloat("step_distance", distance.toFloat())
      .putInt("step_streak", streak)
      .apply()
  }

  // ---- Notification ----

  private fun updateNotification() {
    val notification = buildNotification()
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, notification)
  }

  private fun buildNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)

    val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }

    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(this, 0, it, pendingIntentFlags)
    }

    val builder = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("Tracking your steps")
      .setContentText("$accumulatedSteps steps counted today")
      .setSmallIcon(android.R.drawable.ic_notification_overlay)
      .setOngoing(true)
      .setContentIntent(pendingIntent)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    }

    return builder.build()
  }

  private fun createNotificationChannel() {
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Step Tracking",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Background step tracking service"
      setShowBadge(false)
    }
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(channel)
  }

  // ---- Wake lock ----

  private fun acquireWakeLock() {
    val powerManager = getSystemService(POWER_SERVICE) as PowerManager
    wakeLock = powerManager.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      "Nfit:StepTrackerWakeLock"
    )
    wakeLock?.acquire(30 * 60 * 1000L) // max 30 min to prevent draining
  }

  private fun releaseWakeLock() {
    if (wakeLock?.isHeld == true) {
      wakeLock?.release()
    }
    wakeLock = null
  }

  companion object {
    private const val TAG = "StepTrackerSvc"
    private const val NOTIFICATION_ID = 1001
    private const val CHANNEL_ID = "step_tracker_channel"

    const val PREFS_NAME = "nfit_background_steps"
    const val KEY_ACCUMULATED_STEPS = "accumulated_steps"
    const val KEY_LAST_SENSOR_TOTAL = "last_sensor_total"
    const val KEY_SERVICE_RUNNING = "service_running"

    const val ACTION_STOP = "expo.modules.nfitbackgroundsteps.STOP"

    var instance: StepTrackerService? = null
      private set

    private var currentListener: BackgroundStepsModule? = null

    fun setCurrentListener(module: BackgroundStepsModule?) {
      currentListener = module
    }
  }

  init {
    instance = this
  }
}
