package com.nfit.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.os.Build
import android.widget.RemoteViews

class NfitWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    onUpdateInternal(context, appWidgetManager, appWidgetIds)
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
        onUpdateInternal(context, appWidgetManager, appWidgetIds)
      }
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
      val layoutId = context.resources.getIdentifier("nfit_widget", "layout", context.packageName)
      if (layoutId == 0) return

      for (appWidgetId in appWidgetIds) {
        val views = RemoteViews(context.packageName, layoutId)
        val stepsId = resourceId(context, "steps_text")
        val progressTextId = resourceId(context, "progress_text")
        val percentageId = resourceId(context, "percentage_text")
        val progressBarId = resourceId(context, "progress_bar")
        val caloriesId = resourceId(context, "calories_text")
        val distanceId = resourceId(context, "distance_text")
        val streakId = resourceId(context, "streak_text")
        val floorsId = resourceId(context, "floors_text")
        val activeMinId = resourceId(context, "active_minutes_text")
        val containerId = resourceId(context, "widget_container")

        if (stepsId != 0) views.setTextViewText(stepsId, steps.toFormattedString())
        if (progressTextId != 0) views.setTextViewText(progressTextId, "$steps / ${goal.toFormattedString()}")
        if (percentageId != 0) views.setTextViewText(percentageId, "$progress%")
        if (progressBarId != 0) views.setProgressBar(progressBarId, 100, progress, false)
        if (caloriesId != 0) views.setTextViewText(caloriesId, calories.toFormattedString())
        if (distanceId != 0) views.setTextViewText(distanceId, String.format("%.1f %s", distance, distanceUnit))
        if (streakId != 0) views.setTextViewText(streakId, "$streak")
        if (floorsId != 0) views.setTextViewText(floorsId, "$floors")
        if (activeMinId != 0) views.setTextViewText(activeMinId, "$activeMinutes")

        if (progressBarId != 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val progressColor = when {
            progress >= 100 -> android.graphics.Color.parseColor("#4CAF50")
            progress >= 75 -> android.graphics.Color.parseColor("#8BC34A")
            progress >= 50 -> android.graphics.Color.parseColor("#FFC107")
            progress >= 25 -> android.graphics.Color.parseColor("#FF9800")
            else -> android.graphics.Color.parseColor("#F44336")
          }
          views.setColorStateList(progressBarId, "setProgressTintList",
            ColorStateList.valueOf(progressColor))
        }

        if (stepsId != 0) {
          views.setTextColor(stepsId, if (progress >= 100)
            android.graphics.Color.parseColor("#4CAF50")
          else
            android.graphics.Color.parseColor("#FFFFFF"))
        }

        if (containerId != 0) {
          val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
          if (launchIntent != null) {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
              PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            else
              PendingIntent.FLAG_UPDATE_CURRENT
            val pi = PendingIntent.getActivity(context, 0, launchIntent, flags)
            views.setOnClickPendingIntent(containerId, pi)
          }
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
      }
    }

    private fun resourceId(context: Context, name: String): Int {
      return context.resources.getIdentifier(name, "id", context.packageName)
    }
  }
}

private fun Int.toFormattedString(): String = when {
  this >= 1_000_000 -> String.format("%.1fM", this / 1_000_000f)
  this >= 1_000 -> String.format("%,d", this)
  else -> this.toString()
}
