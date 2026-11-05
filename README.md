# J.A.R.V.I.S. — Asistente personal

Aplicación web personal en español para móvil y ordenador.

## Funciones

- Chat con IA mediante Cloudflare Workers AI.
- Reconocimiento de voz y respuestas habladas con selección de una voz instalada en cada dispositivo.
- Memoria de notas y tareas guardada localmente.
- Sincronización opcional de notas y tareas entre dispositivos mediante Cloudflare D1.
- Recordatorios del navegador mientras JARVIS permanece abierto.
- Uso opcional de notas como contexto para la IA, desactivado por defecto.
- Importación y exportación de copias de seguridad JSON.

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

1. Abre JARVIS → **Herramientas** y pulsa **Generar clave segura**. Copia la clave.\n2. En **mi-jarvis → Settings → Variables and Secrets**, crea un secreto llamado exactamente `JARVIS_SYNC_TOKEN`.
2. Como valor, utiliza una clave aleatoria y única de al menos 32 caracteres. No reutilices la contraseña de tu correo, GitHub o Cloudflare.
3. Guarda y despliega el Worker.
4. Abre JARVIS → **Herramientas**.
5. Pega esa misma clave en **Clave de sincronización** y pulsa **Guardar clave y sincronizar**.
6. En el otro dispositivo, abre la web y pega la misma clave en el mismo apartado.

La clave se guarda en el almacenamiento local del navegador y se envía al Worker únicamente en la petición de sincronización. No se añade al repositorio ni se envía al modelo de IA.

Las notas y tareas se sincronizan; el historial del chat y los ajustes de voz permanecen locales. La selección de voz debe hacerse por separado en cada dispositivo porque las voces disponibles dependen del sistema y del navegador.

## Privacidad y límites

- No guardes contraseñas, claves API ni datos privados o sensibles en las notas.
- La sincronización requiere conocer la clave privada configurada en Cloudflare.
- Las notas solo se envían al modelo de IA como contexto si activas expresamente esa opción.
- Los recordatorios locales no son fiables con la página cerrada o suspendida.
- D1 ofrece una modalidad gratuita con límites de uso; consulta los límites vigentes de Cloudflare.
- La investigación abre búsquedas web y no lee automáticamente páginas.
- La página no puede controlar libremente otras aplicaciones ni leer archivos privados del dispositivo.
