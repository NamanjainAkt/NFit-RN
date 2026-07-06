package expo.modules.nfitwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.res.ColorStateList
import android.os.Build
import android.widget.RemoteViews
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.modules.ModuleDefinitionData

private const val PREFS_NAME = "nfit_widget_data"

class NfitWidgetModule : Module() {
  override fun definition(): ModuleDefinitionData = ModuleDefinition {
    Name("NfitWidget")

    AsyncFunction("updateWidget") {
      appContext.reactContext?.let { ctx ->
        triggerWidgetUpdate(ctx)
      }
    }

    AsyncFunction("updateWidgetData") { args: WidgetDataArgs ->
      appContext.reactContext?.let { ctx ->
        savePrefs(ctx, args)
        triggerWidgetUpdate(ctx)
      }
    }

    AsyncFunction("getWidgetData") {
      appContext.reactContext?.let { ctx ->
        readPrefs(ctx)
      }
    }
  }

  private fun savePrefs(context: Context, args: WidgetDataArgs) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
      .putInt("widget_steps", args.steps)
      .putInt("widget_goal", args.goal)
      .putInt("widget_calories", args.calories)
      .putFloat("widget_distance", args.distance.toFloat())
      .putInt("widget_streak", args.streak)
      .putInt("widget_floors", args.floors)
      .putInt("widget_active_minutes", args.activeMinutes)
      .putString("widget_distance_unit", args.distanceUnit)
      .apply()
  }

  private fun readPrefs(context: Context): Map<String, Any> {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return mapOf(
      "widget_steps" to prefs.getInt("widget_steps", 0),
      "widget_goal" to prefs.getInt("widget_goal", 10000),
      "widget_calories" to prefs.getInt("widget_calories", 0),
      "widget_distance" to prefs.getFloat("widget_distance", 0.0f).toDouble(),
      "widget_streak" to prefs.getInt("widget_streak", 0),
      "widget_floors" to prefs.getInt("widget_floors", 0),
      "widget_active_minutes" to prefs.getInt("widget_active_minutes", 0),
      "widget_distance_unit" to (prefs.getString("widget_distance_unit", "km") ?: "km")
    )
  }

  private fun triggerWidgetUpdate(context: Context) {
    val appWidgetManager = AppWidgetManager.getInstance(context)
    val componentName = ComponentName(context.packageName, "${context.packageName}.NfitWidgetProvider")
    val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
    if (appWidgetIds.isEmpty()) return

    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val steps = prefs.getInt("widget_steps", 0)
    val goal = prefs.getInt("widget_goal", 10000)
    val calories = prefs.getInt("widget_calories", 0)
    val distance = prefs.getFloat("widget_distance", 0.0f)
    val streak = prefs.getInt("widget_streak", 0)
    val floors = prefs.getInt("widget_floors", 0)
    val activeMinutes = prefs.getInt("widget_active_minutes", 0)
    val distanceUnit = prefs.getString("widget_distance_unit", "km") ?: "km"

    val progress = if (goal > 0) (steps.toFloat() / goal * 100).toInt().coerceIn(0, 100) else 0
    val layoutId = context.resources.getIdentifier("nfit_widget", "layout", context.packageName)
    if (layoutId == 0) return

    for (appWidgetId in appWidgetIds) {
      val views = RemoteViews(context.packageName, layoutId)

      setText(views, context, "steps_text", steps.toFormattedString())
      setText(views, context, "progress_text", "$steps / ${goal.toFormattedString()}")
      setText(views, context, "percentage_text", "$progress%")
      setProgress(views, context, "progress_bar", progress)
      setText(views, context, "calories_text", calories.toFormattedString())
      setText(views, context, "distance_text", String.format("%.1f %s", distance, distanceUnit))
      setText(views, context, "streak_text", "$streak")
      setText(views, context, "floors_text", "$floors")
      setText(views, context, "active_minutes_text", "$activeMinutes")

      // Progress bar tint
      val progressBarId = context.resources.getIdentifier("progress_bar", "id", context.packageName)
      if (progressBarId != 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val tint = when {
          progress >= 100 -> android.graphics.Color.parseColor("#4CAF50")
          progress >= 75 -> android.graphics.Color.parseColor("#8BC34A")
          progress >= 50 -> android.graphics.Color.parseColor("#FFC107")
          progress >= 25 -> android.graphics.Color.parseColor("#FF9800")
          else -> android.graphics.Color.parseColor("#F44336")
        }
        views.setColorStateList(progressBarId, "setProgressTintList", ColorStateList.valueOf(tint))
      }

      // Goal-reached color
      val stepsId = context.resources.getIdentifier("steps_text", "id", context.packageName)
      if (stepsId != 0) {
        views.setTextColor(stepsId, if (progress >= 100)
          android.graphics.Color.parseColor("#4CAF50")
        else
          android.graphics.Color.parseColor("#FFFFFF"))
      }

      // Click handler — open app
      val containerId = context.resources.getIdentifier("widget_container", "id", context.packageName)
      if (containerId != 0) {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
          val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
          else
            PendingIntent.FLAG_UPDATE_CURRENT
          views.setOnClickPendingIntent(containerId,
            PendingIntent.getActivity(context, 0, launchIntent, flags))
        }
      }

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }
  }

  private fun setText(views: RemoteViews, context: Context, resName: String, text: String) {
    val id = context.resources.getIdentifier(resName, "id", context.packageName)
    if (id != 0) views.setTextViewText(id, text)
  }

  private fun setProgress(views: RemoteViews, context: Context, resName: String, progress: Int) {
    val id = context.resources.getIdentifier(resName, "id", context.packageName)
    if (id != 0) views.setProgressBar(id, 100, progress, false)
  }
}

data class WidgetDataArgs(
  val steps: Int,
  val goal: Int,
  val calories: Int,
  val distance: Double,
  val streak: Int,
  val floors: Int,
  val activeMinutes: Int,
  val distanceUnit: String
)

private fun Int.toFormattedString(): String = when {
  this >= 1_000_000 -> String.format("%.1fM", this / 1_000_000f)
  this >= 1_000 -> String.format("%,d", this)
  else -> this.toString()
}
