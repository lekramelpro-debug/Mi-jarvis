# J.A.R.V.I.S. — Asistente personal

Aplicación web personal en español para móvil y ordenador.

## Funciones

- Chat con doble motor de IA: Cloudflare Workers AI como principal y Gemini como respaldo automático si Cloudflare falla o no devuelve texto.
- Las claves de ambos proveedores se mantienen como secretos del Worker; nunca se exponen al navegador.
- Reconocimiento de voz y respuestas habladas con selección de una voz instalada en cada dispositivo, más ajustes de velocidad y tono.
- Memoria de notas y tareas guardada localmente.
- Sincronización automática opcional de notas y tareas entre dispositivos mediante Cloudflare D1, con actualización al volver a la web y comprobación periódica mientras permanece abierta.
- Recordatorios del navegador mientras JARVIS permanece abierto.
- Uso opcional de notas y tareas como contexto para la IA, desactivado por defecto.
- Importación y exportación de copias de seguridad JSON, incluidas las revisiones semanales, las revisiones de futsal y el progreso diario de habilidades; la clave de sincronización nunca se exporta.

## Configuración del Worker

El Worker necesita estos bindings:
- Workers AI: variable `AI`.
- D1 database: variable `DB`.

Y este secreto:
- `JARVIS_SYNC_TOKEN`: clave privada aleatoria de al menos 32 caracteres. No debe publicarse en GitHub ni enviarse por el chat.

### Crear D1 para sincronización

1. En Cloudflare, abre **Storage & Databases → D1 SQL Database** y crea una base de datos, por ejemplo `jarvis-memory`.
2. Abre **Workers & Pages → mi-jarvis → Settings → Bindings**.
3. Añade un binding de tipo **D1 database**.
4. En **Variable name** escribe exactamente `DB` y selecciona la base de datos que acabas de crear.
5. Guarda y despliega.

La tabla `jarvis_vault` se crea automáticamente la primera vez que se usa la sincronización; no necesitas ejecutar SQL a mano.

### Proteger y activar la sincronización

1. Abre JARVIS → **Herramientas** y pulsa **Generar clave segura**. Copia la clave.
2. En **mi-jarvis → Settings → Variables and Secrets**, crea un secreto llamado exactamente `JARVIS_SYNC_TOKEN`.
3. Como valor, utiliza una clave aleatoria y única de al menos 32 caracteres. No reutilices la contraseña de tu correo, GitHub o Cloudflare.
4. Guarda y despliega el Worker.
5. Abre JARVIS → **Herramientas**.
6. Pega esa misma clave en **Clave de sincronización** y pulsa **Guardar clave y sincronizar**.
7. En el otro dispositivo, abre la web y pega la misma clave en el mismo apartado.

La clave se guarda en el almacenamiento local del navegador y se envía al Worker únicamente en la petición de sincronización. No se añade al repositorio ni se envía al modelo de IA.

Cada guardado de memoria incluye la versión que el dispositivo acaba de leer. D1 solo acepta la escritura si esa versión sigue siendo la actual. Si dos dispositivos intentan guardar a la vez, el segundo recibe un conflicto, vuelve a descargar la memoria, combina las notas y tareas por identificador y fecha de actualización y reintenta una vez. Esto evita que una escritura atrasada sustituya silenciosamente una versión más reciente.

Las notas y tareas se sincronizan; el historial del chat y los ajustes de voz permanecen locales. La selección de voz, velocidad y tono debe configurarse por separado en cada dispositivo porque las voces disponibles dependen del sistema y del navegador.

## Privacidad y límites

- No guardes contraseñas, claves API ni datos privados o sensibles en las notas.
- La sincronización requiere conocer la clave privada configurada en Cloudflare.
- Las notas solo se envían al modelo de IA como contexto si activas expresamente esa opción.
- Los recordatorios locales no son fiables con la página cerrada o suspendida.
- D1 ofrece una modalidad gratuita con límites de uso; consulta los límites vigentes de Cloudflare.
- El uso de Workers AI y Gemini puede estar sujeto a cuotas o cargos según el plan y el consumo. La aplicación no tiene un límite automático de gasto; revisa el uso y la facturación con un adulto responsable antes de utilizarla de forma continuada.
- La investigación abre búsquedas web y no lee automáticamente páginas.
- La página no puede controlar libremente otras aplicaciones ni leer archivos privados del dispositivo.

## Instalar JARVIS en Android

JARVIS es una PWA. Para crear un acceso directo:
1. Abre la dirección HTTPS publicada de JARVIS en Chrome para Android.
2. Abre el menú de tres puntos (⋮).
3. Selecciona **Instalar aplicación** o **Añadir a pantalla de inicio** y confirma.
4. Abre JARVIS desde el nuevo icono.

En Samsung Internet, abre el menú del navegador y busca **Añadir página a → Pantalla Inicio**. El texto exacto puede variar según la versión del navegador. Si aparece el botón **Instalar** dentro de JARVIS, también puedes usarlo; si el navegador no ofrece instalación automática, el botón muestra los pasos manuales.

La instalación PWA no convierte la web en una aplicación con control total del teléfono. El navegador solo permite funciones expresamente autorizadas, como notificaciones, voz o abrir enlaces. JARVIS no puede leer libremente otras aplicaciones, activar el micrófono en segundo plano ni realizar llamadas telefónicas por sí solo.

## Integración Android futura

Para acciones más profundas se estudiará una aplicación complementaria Android, con permisos mínimos, visibles y revocables. Cada automatización deberá pedir autorización antes de actuar y mostrar un registro de lo realizado. Las llamadas automáticas no forman parte de la PWA actual; antes de considerarlas se necesitarán un proveedor telefónico, consentimiento explícito, controles antiabuso y una política clara para alertas verdaderamente críticas. No se habilitarán llamadas ni control remoto oculto.
