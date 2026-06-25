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
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.modules.Module

class StepTrackerService : Service(), SensorEventListener {

    companion object {
        private const val TAG = "StepTrackerService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "step_tracker_service"
        private const val PREFS_NAME = "nfit_background_steps"
        private const val KEY_ACCUMULATED_STEPS = "accumulated_steps"
        private const val KEY_LAST_SENSOR_TOTAL = "last_sensor_total"
        private const val KEY_SERVICE_RUNNING = "service_running"

        var currentListener: Module? = null

        fun getAccumulatedSteps(context: Context): Int {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getInt(KEY_ACCUMULATED_STEPS, 0)
        }

        fun isRunning(context: Context): Boolean {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getBoolean(KEY_SERVICE_RUNNING, false)
        }

        fun setAccumulatedSteps(context: Context, steps: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putInt(KEY_ACCUMULATED_STEPS, steps).apply()
        }

        fun resetForNewDay(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putInt(KEY_ACCUMULATED_STEPS, 0)
                .putLong(KEY_LAST_SENSOR_TOTAL, -1L)
                .apply()
        }
    }

    private lateinit var sensorManager: SensorManager
    private var stepCounterSensor: Sensor? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var lastSensorTotal: Float = -1f
    private var accumulatedSteps: Int = 0
    private var isFirstEvent: Boolean = true
    private var lastPersistTime: Long = 0

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        accumulatedSteps = prefs.getInt(KEY_ACCUMULATED_STEPS, 0)
        lastSensorTotal = prefs.getFloat(KEY_LAST_SENSOR_TOTAL, -1f)

        acquireWakeLock()
        Log.d(TAG, "Service created. Restored steps: $accumulatedSteps, lastSensorTotal: $lastSensorTotal")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand: ${intent?.action}")

        val notification = buildNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        registerSensor()

        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_SERVICE_RUNNING, true)
            .apply()

        if (intent?.action == "ACTION_RESET_FOR_NEW_DAY") {
            resetForNewDay(this)
            accumulatedSteps = 0
            lastSensorTotal = -1f
            isFirstEvent = true
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putInt(KEY_ACCUMULATED_STEPS, 0)
                .putFloat(KEY_LAST_SENSOR_TOTAL, -1f)
                .apply()
            emitStepsUpdate(0)
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        unregisterSensor()
        releaseWakeLock()

        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_SERVICE_RUNNING, false)
            .apply()

        currentListener = null
        Log.d(TAG, "Service destroyed. Final steps: $accumulatedSteps")
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_STEP_COUNTER) return

        val currentTotal = event.values[0]

        if (isFirstEvent) {
            if (lastSensorTotal >= 0 && currentTotal >= lastSensorTotal) {
                val delta = (currentTotal - lastSensorTotal).toInt()
                if (delta > 0) {
                    accumulatedSteps += delta
                    persistState(currentTotal)
                }
            }
            isFirstEvent = false
            lastSensorTotal = currentTotal
            persistState(currentTotal)
            emitStepsUpdate(accumulatedSteps)
            return
        }

        if (currentTotal > lastSensorTotal) {
            val delta = (currentTotal - lastSensorTotal).toInt()

            if (delta in 1..50) {
                accumulatedSteps += delta
            } else if (delta > 50) {
                Log.w(TAG, "Large step delta detected: $delta, likely sensor reset")
                lastSensorTotal = currentTotal
                persistState(currentTotal)
                return
            }

            lastSensorTotal = currentTotal
            persistState(currentTotal)

            val now = System.currentTimeMillis()
            if (now - lastPersistTime > 5000) {
                emitStepsUpdate(accumulatedSteps)
            }
        } else if (currentTotal < lastSensorTotal) {
            Log.d(TAG, "Sensor reset detected: $currentTotal < $lastSensorTotal")
            lastSensorTotal = currentTotal
            persistState(currentTotal)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun registerSensor() {
        stepCounterSensor?.let { sensor ->
            sensorManager.registerListener(
                this,
                sensor,
                SensorManager.SENSOR_DELAY_NORMAL
            )
            Log.d(TAG, "Sensor registered")
        }
    }

    private fun unregisterSensor() {
        sensorManager.unregisterListener(this)
        Log.d(TAG, "Sensor unregistered")
    }

    private fun persistState(sensorTotal: Float) {
        lastPersistTime = System.currentTimeMillis()
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_ACCUMULATED_STEPS, accumulatedSteps)
            .putFloat(KEY_LAST_SENSOR_TOTAL, sensorTotal)
            .apply()
    }

    private fun emitStepsUpdate(steps: Int) {
        currentListener?.let { module ->
            try {
                val method = module::class.java.getMethod("emitStepsUpdate", Int::class.java)
                method.invoke(module, steps)
            } catch (e: Exception) {
                Log.w(TAG, "Could not emit steps update to JS: ${e.message}")
            }
        }
    }

    private fun buildNotification(): Notification {
        val intent = packageManager?.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nfit")
            .setContentText("Tracking your steps in the background")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Step Tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Background step tracking notification"
            setShowBadge(false)
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "Nfit:StepTrackerWakeLock"
        )
        wakeLock?.acquire(10 * 60 * 1000L)
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }
}
