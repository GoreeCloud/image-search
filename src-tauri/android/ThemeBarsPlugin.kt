package com.goreecloud.imagesearch

import android.app.Activity
import android.content.Context
import android.view.View
import androidx.core.view.WindowCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class ThemeBarsArgs {
    lateinit var theme: String
}

/**
 * Paint the native system-bar inset surfaces with the same base colors as
 * the web UI. On Android 15+ window.statusBarColor is ignored under
 * enforced edge-to-edge; the decor/content backgrounds remain visible.
 */
object ThemeBarAppearance {
    private const val PREFS = "goreecloud-image-search-appearance"
    private const val KEY = "theme"
    private const val LIGHT = 0xFFEEF1FF
    private const val DARK = 0xFF0E0F12

    fun restore(activity: Activity) {
        val stored = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, "light")
        apply(activity, stored == "dark")
    }

    fun update(activity: Activity, theme: String) {
        require(theme == "light" || theme == "dark")
        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY, theme).apply()
        apply(activity, theme == "dark")
    }

    private fun apply(activity: Activity, dark: Boolean) {
        val background = (if (dark) DARK else LIGHT).toInt()
        activity.window.decorView.setBackgroundColor(background)
        activity.findViewById<View>(android.R.id.content)?.setBackgroundColor(background)
        val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
        controller.isAppearanceLightStatusBars = !dark
        controller.isAppearanceLightNavigationBars = !dark
    }
}

/** A tightly scoped, non-networked native appearance command. */
@TauriPlugin
class ThemeBarsPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun setThemeBars(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(ThemeBarsArgs::class.java)
        } catch (_: Exception) {
            invoke.reject("Invalid appearance request.")
            return
        }
        if (args.theme != "light" && args.theme != "dark") {
            invoke.reject("Unsupported appearance.")
            return
        }
        activity.runOnUiThread {
            try {
                ThemeBarAppearance.update(activity, args.theme)
                val reply = JSObject()
                reply.put("applied", true)
                invoke.resolve(reply)
            } catch (_: Exception) {
                invoke.reject("Could not update Android system bars.")
            }
        }
    }
}
