package com.jarvis.companion

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

fun scheduleReminder(context: Context, id: Int, title: String, triggerAt: Long) {
    val intent = Intent(context, ReminderReceiver::class.java).apply {
        putExtra(ReminderReceiver.EXTRA_ID, id)
        putExtra(ReminderReceiver.EXTRA_TITLE, title)
    }
    val pending = PendingIntent.getBroadcast(
        context, id, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(EXTRA_ID, -1)
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Tienes una tarea pendiente"
        val prefs = context.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE)

        val openApp = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context)
        }.setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("Recordatorio de JARVIS")
            .setContentText(title)
            .setStyle(Notification.BigTextStyle().bigText(title))
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(id, notification)
        prefs.edit().remove("title_$id").remove("time_$id").apply()
    }

    companion object {
        const val CHANNEL_ID = "jarvis_reminders"
        const val EXTRA_ID = "reminder_id"
        const val EXTRA_TITLE = "reminder_title"
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val prefs = context.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE)
        prefs.all.entries.filter { it.key.startsWith("time_") }.forEach { entry ->
            val id = entry.key.removePrefix("time_").toIntOrNull() ?: return@forEach
            val time = entry.value as? Long ?: return@forEach
            val title = prefs.getString("title_$id", null) ?: return@forEach
            if (time > System.currentTimeMillis()) {
                scheduleReminder(context, id, title, time)
            }
        }
    }
}
