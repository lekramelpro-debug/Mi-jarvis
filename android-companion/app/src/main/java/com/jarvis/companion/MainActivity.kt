package com.jarvis.companion

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(32, 48, 32, 32)
            setBackgroundColor(0xFF07111F.toInt())
        }

        val title = TextView(this).apply {
            text = "J.A.R.V.I.S."
            textSize = 28f
            setTextColor(0xFFEAF4FF.toInt())
            gravity = Gravity.CENTER
        }
        root.addView(title, matchWrap())

        val subtitle = TextView(this).apply {
            text = "Accesos rápidos de tu móvil"
            textSize = 16f
            setTextColor(0xFF9FB3C8.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 12, 0, 28)
        }
        root.addView(subtitle, matchWrap())

        addAppButton(root, "Abrir Chrome", "com.android.chrome", "https://www.google.com")
        addAppButton(root, "Abrir ChatGPT", "com.openai.chatgpt", "https://chatgpt.com")
        addAppButton(root, "Abrir Claude", "com.anthropic.claude", "https://claude.ai")

        val note = TextView(this).apply {
            text = "JARVIS solo abre las aplicaciones que eliges. No lee tus mensajes ni controla el teléfono en segundo plano."
            textSize = 13f
            setTextColor(0xFF9FB3C8.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 28, 0, 0)
        }
        root.addView(note, matchWrap())

        setContentView(root)
    }

    private fun addAppButton(
        parent: LinearLayout,
        label: String,
        packageName: String,
        fallbackUrl: String
    ) {
        val button = Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 16f
            setOnClickListener { launchApp(packageName, fallbackUrl) }
        }
        val params = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = 12
        }
        parent.addView(button, params)
    }

    private fun launchApp(packageName: String, fallbackUrl: String) {
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                startActivity(launchIntent)
            } else {
                openFallback(fallbackUrl)
            }
        } catch (_: ActivityNotFoundException) {
            openFallback(fallbackUrl)
        } catch (_: SecurityException) {
            openFallback(fallbackUrl)
        }
    }

    private fun openFallback(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, "No hay una aplicación compatible para abrir este enlace.", Toast.LENGTH_LONG).show()
        }
    }

    private fun matchWrap() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    )
}
