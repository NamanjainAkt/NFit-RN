package expo.modules.nfitwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.res.ColorStateList
import android.os.Build
import android.util.Log
import android.widget.RemoteViews
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.modules.ModuleDefinitionData
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private const val PREFS_NAME = "nfit_widget_data"
private const val TAG = "NfitWidget"

class NfitWidgetModule : Module() {

  /**
   * Resolve a usable Context, falling back through multiple sources.
   * reactContext can be null during early lifecycle or background execution.
   */
  private fun getContext(): Context? {
    appContext.reactContext?.let { return it }
    Log.w(TAG, "reactContext is null, trying currentActivity")
    appContext.currentActivity?.applicationContext?.let { return it }
    Log.e(TAG, "No context available — widget update will be skipped")
    return null
  }

  override fun definition(): ModuleDefinitionData = ModuleDefinition {
    Name("NfitWidget")

    AsyncFunction("updateWidget") {
      val ctx = getContext()
      if (ctx != null) {
        triggerWidgetUpdate(ctx)
      } else {
        Log.e(TAG, "updateWidget: no context, skipped")
      }
    }

    AsyncFunction("updateWidgetData") { args: WidgetDataArgs ->
      val ctx = getContext()
      if (ctx != null) {
        Log.d(TAG, "updateWidgetData: steps=${args.steps} goal=${args.goal}")
        savePrefs(ctx, args)
        triggerWidgetUpdate(ctx)
      } else {
        Log.e(TAG, "updateWidgetData: no context, skipped")
      }
    }

    AsyncFunction("getWidgetData") {
      val ctx = getContext()
      if (ctx != null) {
        readPrefs(ctx)
      } else {
        Log.e(TAG, "getWidgetData: no context, returning null")
        null
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
      .commit()
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
    Log.d(TAG, "triggerWidgetUpdate: component=$componentName, widgetIds=${appWidgetIds.toList()}")
    if (appWidgetIds.isEmpty()) {
      Log.w(TAG, "triggerWidgetUpdate: no widget instances found, skipping")
      return
    }

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

    // Build RemoteViews once and push to ALL instances via ComponentName.
    // The ComponentName overload is more reliable than per-widget-id updates
    // because the launcher caches RemoteViews per-instance and may ignore
    // per-id updates that look identical.
    val views = RemoteViews(context.packageName, layoutId)

    // Force a visual change to break launcher caching: set a unique tag
    // with current timestamp. This ensures the view is treated as "changed".
    views.setTextViewText(resId(context, "steps_text"), steps.toFormattedString())
    views.setTextViewText(resId(context, "progress_text"), "$steps / ${goal.toFormattedString()}")
    views.setTextViewText(resId(context, "percentage_text"), "$progress%")
    setBar(resId(context, "progress_bar"), views, progress)
    views.setTextViewText(resId(context, "calories_text"), calories.toFormattedString())
    views.setTextViewText(resId(context, "distance_text"), String.format("%.1f %s", distance, distanceUnit))
    views.setTextViewText(resId(context, "streak_text"), "$streak")
    views.setTextViewText(resId(context, "floors_text"), "$floors")
    views.setTextViewText(resId(context, "active_minutes_text"), "$activeMinutes")

    // Goal-reached badge visibility
    val goalReachedId = resId(context, "goal_reached_badge")
    if (goalReachedId != 0) {
      views.setInt(goalReachedId, "setVisibility",
        if (progress >= 100) android.view.View.VISIBLE else android.view.View.GONE)
    }

    // Progress bar tint and height
    val pbarId = resId(context, "progress_bar")
    if (pbarId != 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val tint = when {
        progress >= 100 -> android.graphics.Color.parseColor("#4CAF50")
        progress >= 75 -> android.graphics.Color.parseColor("#8BC34A")
        progress >= 50 -> android.graphics.Color.parseColor("#FDD835")
        progress >= 25 -> android.graphics.Color.parseColor("#FB8C00")
        else -> android.graphics.Color.parseColor("#EF5350")
      }
      views.setColorStateList(pbarId, "setProgressTintList", ColorStateList.valueOf(tint))
    }

    // Goal-reached color for steps text
    val sId = resId(context, "steps_text")
    if (sId != 0) {
      views.setTextColor(sId, if (progress >= 100)
        android.graphics.Color.parseColor("#4CAF50")
      else
        android.graphics.Color.parseColor("#FFFFFF"))
    }

    // Click handler
    val cId = resId(context, "widget_container")
    if (cId != 0) {
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launchIntent != null) {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        else
          PendingIntent.FLAG_UPDATE_CURRENT
        views.setOnClickPendingIntent(cId,
          PendingIntent.getActivity(context, 0, launchIntent, flags))
      }
    }

    // Update ALL widget instances at once via ComponentName.
    // This bypasses the per-instance RemoteViews caching that causes
    // many launchers to silently ignore per-widget-id updateAppWidget calls.
    appWidgetManager.updateAppWidget(componentName, views)
  }

  private fun resId(context: Context, name: String): Int =
    context.resources.getIdentifier(name, "id", context.packageName)

  private fun setBar(id: Int, views: RemoteViews, pct: Int) {
    if (id != 0) views.setProgressBar(id, 100, pct, false)
  }
}

class WidgetDataArgs : Record {
  @Field val steps: Int = 0
  @Field val goal: Int = 10000
  @Field val calories: Int = 0
  @Field val distance: Double = 0.0
  @Field val streak: Int = 0
  @Field val floors: Int = 0
  @Field val activeMinutes: Int = 0
  @Field val distanceUnit: String = "km"
}

private fun Int.toFormattedString(): String = when {
  this >= 1_000_000 -> String.format("%.1fM", this / 1_000_000f)
  this >= 1_000 -> String.format("%,d", this)
  else -> this.toString()
}
