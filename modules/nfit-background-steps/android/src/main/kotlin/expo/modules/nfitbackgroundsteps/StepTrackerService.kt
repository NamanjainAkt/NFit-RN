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
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log

class StepTrackerService : Service(), SensorEventListener {

  companion object {
    private const val TAG = "StepTrackerSvc"
    private const val NOTIFICATION_ID = 1001
    private const val CHANNEL_ID = "step_tracker_channel"

    const val PREFS_NAME = "nfit_background_steps"
    const val KEY_ACCUMULATED_STEPS = "accumulated_steps"
    const val KEY_LAST_SENSOR_TOTAL = "last_sensor_total"
    const val KEY_SERVICE_RUNNING = "service_running"

    const val ACTION_STOP = "expo.modules.nfitbackgroundsteps.STOP"
    const val ACTION_STEPS_UPDATED = "expo.modules.nfitbackgroundsteps.STEPS_UPDATED"
    const val EXTRA_STEPS = "extra_steps"

    var instance: StepTrackerService? = null
      private set

    private var currentListener: BackgroundStepsModule? = null

    fun setCurrentListener(module: BackgroundStepsModule?) {
      currentListener = module
    }
  }

  private var sensorManager: SensorManager? = null
  private var stepCounterSensor: Sensor? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var lastSensorTotal = 0f
  private var accumulatedSteps = 0
  private var isFirstEvent = true
  private var lastPersistTime = 0L
  private var stepGoal = 10000
  private var stepCalories = 0
  private var stepDistance = 0.0
  private var stepStreak = 0
  private var stepFloors = 0
  private var stepActiveMinutes = 0

  private val prefs: SharedPreferences
    get() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "Service creating")
    createNotificationChannel()

    val p = prefs
    accumulatedSteps = p.getInt(KEY_ACCUMULATED_STEPS, 0)
    lastSensorTotal = p.getFloat(KEY_LAST_SENSOR_TOTAL, 0f)
    stepGoal = p.getInt("step_goal", 10000)
    stepCalories = p.getInt("step_calories", 0)
    stepDistance = p.getFloat("step_distance", 0.0).toDouble()
    stepStreak = p.getInt("step_streak", 0)
    stepFloors = p.getInt("step_floors", 0)
    stepActiveMinutes = p.getInt("step_active_minutes", 0)

    sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
    stepCounterSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    acquireWakeLock()
    registerSensor()

    val notification = buildNotification()
    startForeground(NOTIFICATION_ID, notification)
    Log.d(TAG, "Service created, accumulated=$accumulatedSteps")
  }

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
    persistState()
    unregisterSensor()
    releaseWakeLock()
    instance = null
    Log.d(TAG, "Service destroyed")
    super.onDestroy()
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event?.values == null || event.values.isEmpty()) return

    val currentTotal = event.values[0]

    if (isFirstEvent) {
      val p = prefs
      lastSensorTotal = p.getFloat(KEY_LAST_SENSOR_TOTAL, currentTotal)
      if (lastSensorTotal == 0f) {
        lastSensorTotal = currentTotal
      }
      isFirstEvent = false
    }

    if (currentTotal > lastSensorTotal) {
      val delta = (currentTotal - lastSensorTotal).toInt()
      if (delta > 0 && delta < 1000) {
        accumulatedSteps += delta
        stepFloors = accumulatedSteps / 200
        stepActiveMinutes = accumulatedSteps / 100
        Log.d(TAG, "Steps delta=$delta, accumulated=$accumulatedSteps")
        emitStepsUpdate(accumulatedSteps)
      }
    }

    lastSensorTotal = currentTotal
    persistState()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  private fun registerSensor() {
    stepCounterSensor?.let { sensor ->
      sensorManager?.registerListener(
        this, sensor, SensorManager.SENSOR_DELAY_NORMAL
      )
    }
  }

  private fun unregisterSensor() {
    sensorManager?.unregisterListener(this)
  }

  private fun persistState() {
    val now = System.currentTimeMillis()
    if (now - lastPersistTime < 5_000) return
    lastPersistTime = now

    prefs.edit()
      .putInt(KEY_ACCUMULATED_STEPS, accumulatedSteps)
      .putFloat(KEY_LAST_SENSOR_TOTAL, lastSensorTotal)
      .putBoolean(KEY_SERVICE_RUNNING, true)
      .putInt("step_floors", stepFloors)
      .putInt("step_active_minutes", stepActiveMinutes)
      .apply()
  }

  private fun emitStepsUpdate(steps: Int) {
    currentListener?.emitStepsUpdate(steps)
  }

  // Called from JS side to sync profile data
  fun syncProfileData(goal: Int, calories: Int, distance: Double, streak: Int) {
    stepGoal = goal
    stepCalories = calories
    stepDistance = distance
    stepStreak = streak
    prefs.edit()
      .putInt("step_goal", goal)
      .putInt("step_calories", calories)
      .putFloat("step_distance", distance.toFloat())
      .putInt("step_streak", streak)
      .apply()
  }

  private fun buildNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(applicationContext.packageName)

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

  private fun acquireWakeLock() {
    val powerManager = getSystemService(POWER_SERVICE) as PowerManager
    wakeLock = powerManager.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      "Nfit:StepTrackerWakeLock"
    )
    wakeLock?.acquire()
  }

  private fun releaseWakeLock() {
    if (wakeLock?.isHeld == true) {
      wakeLock?.release()
    }
    wakeLock = null
  }

  fun getAccumulatedSteps(): Int = accumulatedSteps

  init {
    instance = this
  }
}
