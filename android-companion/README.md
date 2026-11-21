# JARVIS Android Companion

Aplicación Android complementaria mínima para abrir Chrome, ChatGPT y Claude.

## Qué hace
- Abre la aplicación instalada si Android permite resolver su paquete.
- Si no está instalada o no se puede abrir, intenta abrir la web correspondiente.
- No solicita permisos de micrófono, contactos, ubicación, SMS, llamadas ni accesibilidad.
- No funciona como servicio en segundo plano ni controla otras aplicaciones.

## Compilar
Abre esta carpeta en Android Studio con JDK 17 y deja que Gradle sincronice el proyecto. Después ejecuta el módulo `app` en un dispositivo Android o genera un APK de depuración.

Paquete: `com.jarvis.companion`

La compilación no se ha ejecutado en este entorno. Comprueba el APK en tu propio dispositivo antes de usarlo.
