# Uso de IA

Se utilizó ChatGPT (Codex) para leer el enunciado, identificar ambigüedades y proponer preguntas, diseñar e implementar el motor tarifario, la API, la persistencia en SQLite y la interfaz. También se usó para redactar la documentación, generar y ejecutar pruebas, y preparar el recorrido técnico para la defensa.

Para la revisión visual se aplicó la skill `frontend-design`. Codex reorganizó el backend separando transporte HTTP, operaciones de negocio y persistencia. La interfaz se comprobó en Chromium mediante Playwright, incluyendo liquidación, importación, cierre, navegación móvil y manejo de errores. No había una skill específica de arquitectura Node/SQLite disponible para esta revisión.

Tras recibir las respuestas del evaluador, Codex actualizó las decisiones, la explicación visible de duplicados y el diccionario de artículos. También añadió comentarios en español a las funciones del backend, la interfaz y los auxiliares de pruebas, y verificaciones de los totales y desgloses de los dos ejemplos aclarados sobre tramos nocturnos.
