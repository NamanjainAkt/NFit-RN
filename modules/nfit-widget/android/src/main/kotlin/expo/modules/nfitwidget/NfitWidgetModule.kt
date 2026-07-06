package expo.modules.nfitwidget

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
          ctx,
          args.steps,
          args.goal,
          args.calories,
          args.distance,
          args.streak,
          args.floors,
          args.activeMinutes,
          args.distanceUnit
        )
      }
    }

    AsyncFunction("getWidgetData") {
      appContext.reactContext?.let { ctx ->
        NfitWidgetProvider.readData(ctx)
      }
    }
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
