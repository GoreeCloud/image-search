package com.goreecloud.imagesearch

import android.os.Bundle
import android.view.View
import com.goreecloud.imagesearch.AndroidSystemBars
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
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
        // Light on first launch; persisted dark preference is applied by the web bridge.
        val saved = getSharedPreferences("image-search.appearance.v1", MODE_PRIVATE)
            .getString("theme", "light") ?: "light"
        AndroidSystemBars.apply(this, saved)
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
