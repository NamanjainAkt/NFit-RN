package expo.modules.nfitwidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NfitWidgetModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NfitWidgetModule")

        AsyncFunction("updateWidget") { steps: Int, goal: Int ->
            val context = appContext.reactContext ?: return@AsyncFunction
            NfitWidgetProvider.updateWidget(context, steps, goal)
        }
    }
}
