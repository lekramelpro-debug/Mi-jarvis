# Arquitectura propuesta de agentes especializados

Estado: propuesta técnica; no activa agentes ni cambia el comportamiento de la aplicación.

## Objetivo

Permitir que JARVIS organice solicitudes por áreas (negocio, estudios, organización, aprendizaje y deporte) sin duplicar motores de IA, memoria ni credenciales. Cloudflare Workers AI seguirá siendo el proveedor principal y Gemini el respaldo secuencial existente.

## Principios obligatorios

1. **Un único orquestador.** La interfaz envía una solicitud al Worker actual. El Worker valida la petición y selecciona un especialista lógico; los especialistas no realizan llamadas externas por su cuenta.
2. **Especialistas como configuración, no como servicios separados.** Cada especialista aporta instrucciones acotadas, límites de salida y herramientas permitidas. No se crean cuentas, proveedores, bases de datos ni costes nuevos.
3. **Memoria mínima y explícita.** Por defecto, cada especialista recibe solo el mensaje actual. Notas y tareas solo se incorporan cuando el usuario haya activado expresamente el ajuste existente para compartir memoria con IA.
4. **Sin memoria oculta.** No inferir ni almacenar datos sensibles. Las preferencias duraderas deben poder consultarse, editarse y exportarse por el usuario.
5. **Salida estructurada y validada.** Si un especialista propone tareas, debe devolver un esquema validable (título, descripción opcional, fecha opcional); la aplicación muestra una vista previa y exige confirmación antes de guardar.
6. **Sin acciones externas automáticas.** Ningún especialista puede enviar mensajes, publicar contenido, comprar, desplegar, modificar cuentas o ejecutar acciones fuera de JARVIS.
7. **Resistencia a instrucciones maliciosas.** Los mensajes, notas, resultados de búsqueda y documentos se tratan como datos no confiables, nunca como instrucciones para cambiar políticas, revelar secretos o ejecutar acciones.
8. **Límites de uso.** Un solo flujo de proveedor a la vez: Cloudflare primero y Gemini solo según el fallback actual. No lanzar especialistas en paralelo ni repetir llamadas para “pensar más”.
9. **Privacidad y observabilidad.** No registrar prompts completos, notas, tokens ni respuestas privadas en logs. Registrar únicamente categoría, duración, proveedor y resultado técnico, si ya existe un mecanismo seguro.
10. **Compatibilidad.** Si el clasificador falla, la categoría es desconocida o el formato no valida, volver al flujo conversacional general sin perder el mensaje.

## Especialistas iniciales

| Especialista | Alcance | Límites |
|---|---|---|
| Negocio y marketing | Hipótesis, contenido orgánico, análisis de resultados y próximos experimentos | No inventar métricas, ventas ni márgenes |
| Estudios y aprendizaje | Explicaciones, práctica y planificación de estudio | Enseñar paso a paso; no sustituir el trabajo del estudiante |
| Organización | Prioridades, tareas y planificación semanal | Proponer; no guardar sin confirmación |
| Habilidades personales | Comunicación, pensamiento crítico y hábitos sostenibles | Evitar presión, promesas y objetivos extremos |
| Deporte | Técnica, táctica, recuperación y planificación general | Recomendaciones apropiadas a la edad; descanso y supervisión adulta cuando corresponda |

## Flujo propuesto

1. Validar origen, tamaño, roles y longitud de mensajes en el Worker.
2. Clasificar la intención con reglas locales simples y transparentes; no llamar a un segundo modelo solo para clasificar.
3. Construir el contexto mínimo permitido por los ajustes actuales.
4. Aplicar las instrucciones del especialista seleccionado.
5. Ejecutar una única ruta de IA: Cloudflare principal; Gemini como respaldo secuencial existente.
6. Validar la respuesta y cualquier propuesta estructurada.
7. Mostrar la respuesta y pedir confirmación explícita antes de crear tareas o modificar memoria.

## Datos y sincronización

La primera versión no debe cambiar el esquema D1 ni las claves actuales. La categoría de especialista puede mantenerse como dato efímero de la petición. Si más adelante se desea guardar preferencias por área, primero habrá que diseñar exportación, compatibilidad con copias antiguas y una migración aditiva revisable; no se debe migrar ni borrar datos automáticamente.

La sincronización actual documentada cubre notas y tareas. No se debe afirmar que el progreso de experimentos, habilidades o revisiones está sincronizado hasta implementar y probar esa cobertura por separado.

## Plan de implementación por fases

- **Fase 0 — diseño:** aprobar este alcance y revisar el Worker, el formato de mensajes y los límites actuales.
- **Fase 1 — clasificación determinista:** añadir categorías locales con pruebas de frases ambiguas, idioma, mensajes vacíos y fallback general.
- **Fase 2 — prompts acotados:** definir instrucciones pequeñas por especialista, pruebas de seguridad y límites de longitud.
- **Fase 3 — propuestas estructuradas:** validar propuestas de tareas y requerir confirmación visible antes de guardarlas.
- **Fase 4 — experiencia:** añadir selector y mostrar qué especialista responde, con opción de volver al modo general.
- **Fase 5 — evaluación:** medir latencia, tasa de fallback, errores de validación y calidad con ejemplos sintéticos; no enviar datos personales a pruebas.

## Criterios de aceptación

- Cloudflare y Gemini permanecen configurados en el orden actual.
- No hay llamadas paralelas ni servicios de pago nuevos.
- Ninguna nota se comparte con IA si el ajuste de consentimiento está desactivado.
- Ninguna tarea o cambio de memoria se guarda sin confirmación.
- Los fallos del clasificador y del formato vuelven al chat general.
- Las pruebas cubren prompt injection, límites, privacidad, fallback y compatibilidad con mensajes existentes.
- No se cambia el esquema D1 ni se despliega a producción como parte de esta fase.
