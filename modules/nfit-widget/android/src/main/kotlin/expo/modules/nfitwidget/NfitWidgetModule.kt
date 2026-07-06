package expo.modules.nfitwidget

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.modules.ModuleDefinitionData

private const val PREFS_NAME = "nfit_widget_data"
private const val ACTION_REFRESH = "expo.modules.nfitwidget.REFRESH"

class NfitWidgetModule : Module() {
  override fun definition(): ModuleDefinitionData = ModuleDefinition {
    Name("NfitWidget")

    AsyncFunction("updateWidget") {
      appContext.reactContext?.let { ctx ->
        triggerRefresh(ctx)
      }
    }

    AsyncFunction("updateWidgetData") { args: WidgetDataArgs ->
      appContext.reactContext?.let { ctx ->
        saveData(ctx, args)
        triggerRefresh(ctx)
      }
    }

    AsyncFunction("getWidgetData") {
      appContext.reactContext?.let { ctx ->
        readData(ctx)
      }
    }
  }

  private fun saveData(context: Context, args: WidgetDataArgs) {
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

  private fun readData(context: Context): Map<String, Any> {
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

  private fun triggerRefresh(context: Context) {
    val intent = Intent(ACTION_REFRESH)
    intent.component = ComponentName(context.packageName, "${context.packageName}.NfitWidgetProvider")
    context.sendBroadcast(intent)
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
