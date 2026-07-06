package expo.modules.nfitwidget

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.modules.ModuleDefinitionData

class NfitWidgetModule : Module() {
  override fun definition(): ModuleDefinitionData = ModuleDefinition {
    Name("NfitWidget")

    AsyncFunction("updateWidget") {
      appContext.reactContext?.let { ctx ->
        NfitWidgetProvider.triggerRefresh(ctx)
      }
    }

    AsyncFunction("updateWidgetData") { args: WidgetDataArgs ->
      appContext.reactContext?.let { ctx ->
        NfitWidgetProvider.updateData(
          ctx, args.steps, args.goal, args.calories,
          args.distance, args.streak, args.floors,
          args.activeMinutes, args.distanceUnit
        )
      }
    }

    AsyncFunction("getWidgetData") {
      appContext.reactContext?.let { ctx ->
        NfitWidgetProvider.readData(ctx)
      }
    }
  }

  companion object {
    const val PREFS_NAME = "nfit_widget_data"
    const val KEY_STEPS = "widget_steps"
    const val KEY_GOAL = "widget_goal"
    const val KEY_CALORIES = "widget_calories"
    const val KEY_DISTANCE = "widget_distance"
    const val KEY_STREAK = "widget_streak"
    const val KEY_FLOORS = "widget_floors"
    const val KEY_ACTIVE_MINUTES = "widget_active_minutes"
    const val KEY_DISTANCE_UNIT = "widget_distance_unit"
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
