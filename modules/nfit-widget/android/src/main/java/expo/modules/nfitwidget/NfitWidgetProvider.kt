package expo.modules.nfitwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import java.text.NumberFormat

class NfitWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            buildAndUpdate(context, appWidgetManager, appWidgetId, 0, 10000)
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
    }

    companion object {
        private const val MAX_PROGRESS = 1000

        fun updateWidget(context: Context, steps: Int, goal: Int) {
            val appContext = context.applicationContext
            val appWidgetManager = AppWidgetManager.getInstance(appContext)
            val componentName = ComponentName(appContext, NfitWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

            for (appWidgetId in appWidgetIds) {
                buildAndUpdate(appContext, appWidgetManager, appWidgetId, steps, goal)
            }
        }

        private fun buildAndUpdate(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            steps: Int,
            goal: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.nfit_widget)

            val fmt = NumberFormat.getNumberInstance()

            val formattedSteps = fmt.format(steps)
            views.setTextViewText(R.id.steps_text, formattedSteps)

            val safeGoal = if (goal > 0) goal else 10000
            val formattedGoal = fmt.format(safeGoal)
            views.setTextViewText(R.id.progress_text, "$formattedSteps / $formattedGoal")

            val progress = (steps.toFloat() / safeGoal * MAX_PROGRESS).toInt().coerceIn(0, MAX_PROGRESS)
            views.setProgressBar(R.id.progress_bar, MAX_PROGRESS, progress, false)

            val percent = (steps.toFloat() / safeGoal * 100).toInt()
            views.setTextViewText(R.id.percentage_text, "$percent%")

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
