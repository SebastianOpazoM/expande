# Imágenes del calendario

Los 38 eventos existentes tienen una ilustración temática en sus tarjetas y detalles. Ocho imágenes cubren conferencias, ferias, agua, procesos, transporte, minería digital, mantenimiento y energía. No son fotografías ni material oficial de organizadores. La asignación por ID está en `content/calendario-thumbnails.json`.

Se generaron con la herramienta integrada `image_gen`, una llamada por tema. `content/calendario-artwork.json` registra los prompts exactos, método, rutas originales y destinos finales. Los originales se conservaron. Las imágenes optimizadas están en `public/images/calendario/`: ocho JPEG de 960 × 540 píxeles, 895.512 bytes en total, convertidos con System.Drawing a calidad 85. La hoja de contacto `.local/calendario-contact-sheet.jpg` se inspeccionó visualmente.

El componente compartido `ContentThumbnail` reserva espacio 16:9, carga imágenes de forma diferida y ofrece texto alternativo y fallback neutro. Las tarjetas de eventos mantienen su enlace al detalle. Las miniaturas aparecen en las tarjetas bajo ambas vistas (agenda y calendario), incluidos eventos tentativos y de fecha desconocida. La cuadrícula mensual mantiene sus enlaces compactos.

La validación de ejecución de `events` admite `thumbnail_url` y `thumbnail_alt` opcionales, compatibles con registros anteriores. No se modificó el paquete original ni se creó una migración SQL o un endpoint. Las rutas del calendario ocultan la insignia documental solicitada y sus detalles omiten «Fuente y documentos». La procedencia continúa almacenada; las etiquetas de eventos demo y las restricciones por precisión de fecha se conservan.

## Datos y reproducción

`scripts/prepare-calendario-thumbnails.mjs` lee los 38 registros y revisiones mediante el CLI de la misma base usada por la app. Produce cambios de registro completo, modificando únicamente los dos campos de imagen.

```powershell
npm.cmd run data -- schema --collection events
node --experimental-transform-types scripts/prepare-calendario-thumbnails.mjs
npm.cmd run data -- preview --scope catalog --file .local/calendario-thumbnails-update.json
# Inspeccionar el diff antes de aplicar el mismo archivo.
npm.cmd run data -- apply --scope catalog --file .local/calendario-thumbnails-update.json --actor calendar-thumbnails
npm.cmd run data -- history --scope catalog
```

Se aplicó el lote `f8247a97-0db5-46e9-8d7f-59efd6a87e7f` tras comprobar que todos los campos anteriores permanecían intactos. Se cotejaron los 38 registros por `get` y sus 38 eventos de auditoría. Evidencia: `.local/calendario-thumbnails-preview.json`, `.local/calendario-thumbnails-applied.json` y `.local/calendario-thumbnails-audit-verification.json`.

No se edita actividad de visitantes. El enriquecimiento no se reaplica automáticamente tras restaurar el catálogo; el reset de una sesión lo conserva.

## Verificación

Build de producción aprobado; 43 pruebas unitarias/API/CLI/catálogos y 30 pruebas de navegador aprobadas. Se comprobaron ambos modos del calendario, eventos precisos/tentativos/sin fecha, las 38 portadas, ausencia de sección de fuentes y de insignias documentales, restricciones de recordatorios, fallback de imagen y navegación en 360/390/430 px sin desbordamiento horizontal. Se revisaron capturas finales y la hoja de contacto. No se repitieron pruebas Docker ni se afirma fidelidad completa con todas las vistas anidadas de Figma.
