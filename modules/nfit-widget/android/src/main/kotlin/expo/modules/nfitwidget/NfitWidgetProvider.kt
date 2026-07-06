package expo.modules.nfitwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.ColorStateList
import android.os.Build
import android.widget.RemoteViews

class NfitWidgetProvider : AppWidgetProvider() {

  companion object {
    private const val PREFS_NAME = "nfit_widget_data"
    private const val KEY_STEPS = "widget_steps"
    private const val KEY_GOAL = "widget_goal"
    private const val KEY_CALORIES = "widget_calories"
    private const val KEY_DISTANCE = "widget_distance"
    private const val KEY_STREAK = "widget_streak"
    private const val KEY_FLOORS = "widget_floors"
    private const val KEY_ACTIVE_MINUTES = "widget_active_minutes"
    private const val KEY_DISTANCE_UNIT = "widget_distance_unit"
    const val ACTION_REFRESH = "expo.modules.nfitwidget.REFRESH"

    fun triggerRefresh(context: Context) {
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val componentName = ComponentName(context, NfitWidgetProvider::class.java)
      val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
      if (appWidgetIds.isNotEmpty()) {
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, android.R.id.content)
        onUpdateInternal(context, appWidgetManager, appWidgetIds)
      }
    }

    fun updateData(
      context: Context,
      steps: Int,
      goal: Int,
      calories: Int,
      distance: Double,
      streak: Int,
      floors: Int,
      activeMinutes: Int,
      distanceUnit: String = "km"
    ) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit()
        .putInt(KEY_STEPS, steps)
        .putInt(KEY_GOAL, goal)
        .putInt(KEY_CALORIES, calories)
        .putFloat(KEY_DISTANCE, distance.toFloat())
        .putInt(KEY_STREAK, streak)
        .putInt(KEY_FLOORS, floors)
        .putInt(KEY_ACTIVE_MINUTES, activeMinutes)
        .putString(KEY_DISTANCE_UNIT, distanceUnit)
        .apply()

      triggerRefresh(context)
    }

    fun readData(context: Context): Map<String, Any> {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      return mapOf(
        KEY_STEPS to prefs.getInt(KEY_STEPS, 0),
        KEY_GOAL to prefs.getInt(KEY_GOAL, 10000),
        KEY_CALORIES to prefs.getInt(KEY_CALORIES, 0),
        KEY_DISTANCE to prefs.getFloat(KEY_DISTANCE, 0.0f).toDouble(),
        KEY_STREAK to prefs.getInt(KEY_STREAK, 0),
        KEY_FLOORS to prefs.getInt(KEY_FLOORS, 0),
        KEY_ACTIVE_MINUTES to prefs.getInt(KEY_ACTIVE_MINUTES, 0),
        KEY_DISTANCE_UNIT to (prefs.getString(KEY_DISTANCE_UNIT, "km") ?: "km")
      )
    }

    private fun onUpdateInternal(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetIds: IntArray
    ) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val steps = prefs.getInt(KEY_STEPS, 0)
      val goal = prefs.getInt(KEY_GOAL, 10000)
      val calories = prefs.getInt(KEY_CALORIES, 0)
      val distance = prefs.getFloat(KEY_DISTANCE, 0.0f)
      val streak = prefs.getInt(KEY_STREAK, 0)
      val floors = prefs.getInt(KEY_FLOORS, 0)
      val activeMinutes = prefs.getInt(KEY_ACTIVE_MINUTES, 0)
      val distanceUnit = prefs.getString(KEY_DISTANCE_UNIT, "km") ?: "km"

      val progress = if (goal > 0) (steps.toFloat() / goal * 100).toInt().coerceIn(0, 100) else 0

      for (appWidgetId in appWidgetIds) {
        val views = RemoteViews(context.packageName, R.layout.nfit_widget)

        // Main metrics
        views.setTextViewText(R.id.steps_text, steps.toFormattedString())
        views.setTextViewText(R.id.progress_text, "$steps / ${goal.toFormattedString()}")
        views.setTextViewText(R.id.percentage_text, "$progress%")
        views.setProgressBar(R.id.progress_bar, 100, progress, false)

        // Secondary metrics
        views.setTextViewText(R.id.calories_text, calories.toFormattedString())
        views.setTextViewText(R.id.distance_text, String.format("%.1f %s", distance, distanceUnit))
        views.setTextViewText(R.id.streak_text, "$streak")
        views.setTextViewText(R.id.floors_text, "$floors")
        views.setTextViewText(R.id.active_minutes_text, "$activeMinutes")

        // Color the progress bar based on progress
        val progressColor = when {
          progress >= 100 -> android.graphics.Color.parseColor("#4CAF50") // Green
          progress >= 75 -> android.graphics.Color.parseColor("#8BC34A")  // Light green
          progress >= 50 -> android.graphics.Color.parseColor("#FFC107")  // Amber
          progress >= 25 -> android.graphics.Color.parseColor("#FF9800")  // Orange
          else -> android.graphics.Color.parseColor("#F44336")            // Red
        }

        // Set progress tint (API 29+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          views.setColorStateList(R.id.progress_bar, "setProgressTintList",
            ColorStateList.valueOf(progressColor))
        }

        // Goal reached animation color for steps
        if (progress >= 100) {
          views.setTextColor(R.id.steps_text, android.graphics.Color.parseColor("#4CAF50"))
        } else {
          views.setTextColor(R.id.steps_text, android.graphics.Color.parseColor("#FFFFFF"))
        }

        // Click handler: open app
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
          val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
          } else {
            PendingIntent.FLAG_UPDATE_CURRENT
          }
          val pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent, pendingIntentFlags
          )
          views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
      }
    }
  }

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    onUpdateInternal(context, appWidgetManager, appWidgetIds)
  }

  override fun onEnabled(context: Context) {
    // Widget was added to home screen
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (ACTION_REFRESH == intent.action) {
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val componentName = ComponentName(context, NfitWidgetProvider::class.java)
      val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
      if (appWidgetIds.isNotEmpty()) {
        onUpdateInternal(context, appWidgetManager, appWidgetIds)
      }
    }
  }
}

private fun Int.toFormattedString(): String {
  return when {
    this >= 1_000_000 -> String.format("%.1fM", this / 1_000_000f)
    this >= 1_000 -> String.format("%,d", this)
    else -> this.toString()
  }
}
