package com.jarvis.companion

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.DatePickerDialog
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.TimePickerDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.text.DateFormat
import java.util.Calendar
import java.util.Date

class MainActivity : Activity() {
    private lateinit var root: LinearLayout
    private lateinit var reminderInput: EditText
    private lateinit var reminderList: TextView
    private val prefs by lazy { getSharedPreferences(PREFS, Context.MODE_PRIVATE) }
    private var selectedTime = Calendar.getInstance().apply { add(Calendar.MINUTE, 5) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
        requestNotificationPermission()

        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(32, 36, 32, 32)
            setBackgroundColor(0xFF07111F.toInt())
        }

        addText("J.A.R.V.I.S.", 28f, 0xFFEAF4FF.toInt())
        addText("Accesos rápidos y recordatorios", 16f, 0xFF9FB3C8.toInt(), 12, 24)

        addAppButton("Abrir Chrome", "com.android.chrome", "https://www.google.com")
        addAppButton("Abrir ChatGPT", "com.openai.chatgpt", "https://chatgpt.com")
        addAppButton("Abrir Claude", "com.anthropic.claude", "https://claude.ai")

        addText("Nuevo recordatorio", 20f, 0xFFEAF4FF.toInt(), 20, 10)
        reminderInput = EditText(this).apply {
            hint = "¿Qué tienes que hacer?"
            setSingleLine(true)
            setTextColor(0xFFEAF4FF.toInt())
            setHintTextColor(0xFF9FB3C8.toInt())
        }
        root.addView(reminderInput, matchWrap())

        val chooseTime = Button(this).apply {
            text = "Elegir fecha y hora"
            isAllCaps = false
            setOnClickListener { chooseDateAndTime() }
        }
        root.addView(chooseTime, matchWrap())

        val save = Button(this).apply {
            text = "Guardar recordatorio"
            isAllCaps = false
            setOnClickListener { saveReminder() }
        }
        root.addView(save, matchWrap())

        addText("Pendientes", 20f, 0xFFEAF4FF.toInt(), 24, 8)
        reminderList = TextView(this).apply {
            textSize = 14f
            setTextColor(0xFFEAF4FF.toInt())
        }
        root.addView(reminderList, matchWrap())
        addText(
            "Las notificaciones dependen de los permisos y ajustes de batería de Android.",
            12f, 0xFF9FB3C8.toInt(), 24, 0
        )
        setContentView(root)
        refreshReminderList()
    }

    private fun addText(text: String, size: Float, color: Int, top: Int = 0, bottom: Int = 0) {
        val view = TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(color)
            gravity = Gravity.CENTER
            setPadding(0, top, 0, bottom)
        }
        root.addView(view, matchWrap())
    }

    private fun addAppButton(label: String, packageName: String, fallbackUrl: String) {
        val button = Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { launchApp(packageName, fallbackUrl) }
        }
        root.addView(button, matchWrap())
    }

    private fun launchApp(packageName: String, fallbackUrl: String) {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        if (launchIntent != null) {
            startActivity(launchIntent)
        } else {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)))
        }
    }

    private fun chooseDateAndTime() {
        val now = Calendar.getInstance()
        DatePickerDialog(this, { _, year, month, day ->
            selectedTime.set(Calendar.YEAR, year)
            selectedTime.set(Calendar.MONTH, month)
            selectedTime.set(Calendar.DAY_OF_MONTH, day)
            TimePickerDialog(this, { _, hour, minute ->
                selectedTime.set(Calendar.HOUR_OF_DAY, hour)
                selectedTime.set(Calendar.MINUTE, minute)
                selectedTime.set(Calendar.SECOND, 0)
                selectedTime.set(Calendar.MILLISECOND, 0)
                Toast.makeText(
                    this,
                    "Programado: " + DateFormat.getDateTimeInstance().format(selectedTime.time),
                    Toast.LENGTH_LONG
                ).show()
            }, now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE), true).show()
        }, now.get(Calendar.YEAR), now.get(Calendar.MONTH), now.get(Calendar.DAY_OF_MONTH)).show()
    }

    private fun saveReminder() {
        val title = reminderInput.text.toString().trim()
        if (title.isEmpty()) {
            reminderInput.error = "Escribe qué tienes que hacer"
            return
        }
        val triggerAt = selectedTime.timeInMillis
        if (triggerAt <= System.currentTimeMillis()) {
            Toast.makeText(this, "Elige una hora futura.", Toast.LENGTH_LONG).show()
            return
        }
        val id = System.currentTimeMillis().toInt()
        prefs.edit()
            .putString("title_$id", title)
            .putLong("time_$id", triggerAt)
            .apply()
        scheduleReminder(this, id, title, triggerAt)
        reminderInput.text.clear()
        refreshReminderList()
        Toast.makeText(this, "Recordatorio guardado.", Toast.LENGTH_SHORT).show()
    }

    private fun refreshReminderList() {
        val items = prefs.all.entries
            .filter { it.key.startsWith("time_") }
            .mapNotNull { entry ->
                val id = entry.key.removePrefix("time_")
                val time = entry.value as? Long ?: return@mapNotNull null
                val title = prefs.getString("title_$id", null) ?: return@mapNotNull null
                Triple(time, title, id)
            }
            .sortedBy { it.first }
        reminderList.text = if (items.isEmpty()) {
            "No tienes recordatorios pendientes."
        } else {
            items.joinToString("\n\n") { (time, title, _) ->
                "• $title\n  " + DateFormat.getDateTimeInstance().format(Date(time))
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                ReminderReceiver.CHANNEL_ID,
                "Recordatorios de JARVIS",
                NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "Avisos de tus tareas programadas" }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun matchWrap() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    )

    companion object {
        const val PREFS = "jarvis_reminders"
    }
}
