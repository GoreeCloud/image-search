package com.goreecloud.imagesearch

import android.os.Bundle
import android.view.View
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Android 15+ windows can extend under system bars. Apply the actual
 * native system bar and display cutout sizes to the WebView container.
 * Zero those handled insets before dispatch to prevent CSS double padding.
 * Preserve IME insets for keyboard viewport resizing.
 */
class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The system-bar backdrop stays pale even when the WebView switches to dark mode.
        // Request dark status-bar glyphs in both modes so time and system icons remain legible.
        WindowCompat.getInsetsController(window, window.decorView)
            .isAppearanceLightStatusBars = true
        val container = findViewById<View>(android.R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
            val types = WindowInsetsCompat.Type.systemBars() or
                WindowInsetsCompat.Type.displayCutout()
            val bars = insets.getInsets(types)
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.Builder(insets)
                .setInsets(types, Insets.NONE)
                .build()
        }
        ViewCompat.requestApplyInsets(container)
    }
}
