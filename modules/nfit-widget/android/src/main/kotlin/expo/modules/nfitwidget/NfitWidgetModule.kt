package expo.modules.nfitwidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NfitWidgetModule : Module() {
  override fun definition(): ModuleDefinition = ModuleDefinition {
    Name("NfitWidget")

    AsyncFunction("updateWidget") {
      val ctx = appContext.reactContext ?: return@AsyncFunction
      NfitWidgetProvider.triggerRefresh(ctx)
    }

    AsyncFunction("updateWidgetData") { args: WidgetDataArgs ->
      val ctx = appContext.reactContext ?: return@AsyncFunction
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

    AsyncFunction("getWidgetData") {
      val ctx = appContext.reactContext ?: return@AsyncFunction
      return@AsyncFunction NfitWidgetProvider.readData(ctx)
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
