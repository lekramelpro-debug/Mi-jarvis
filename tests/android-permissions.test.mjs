import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = await readFile(
  new URL("../android-companion/app/src/main/AndroidManifest.xml", import.meta.url),
  "utf8"
);

test("la app Android solo declara los permisos necesarios para recordatorios locales", () => {
  const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)]
    .map(match => match[1])
    .sort();
  assert.deepEqual(permissions, [
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED"
  ]);
  assert.match(manifest, /android:allowBackup="false"/);
});

test("los receptores de notificaciones no están exportados a otras apps", () => {
  assert.match(manifest, /android:name="\.ReminderReceiver"\s+android:enabled="true"\s+android:exported="false"/);
  assert.match(manifest, /android:name="\.BootReceiver"\s+android:enabled="true"\s+android:exported="false"/);
});
