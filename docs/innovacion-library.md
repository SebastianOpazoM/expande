# Biblioteca de Innovación

La biblioteca contiene cinco casos, cinco noticias y cinco tendencias. `content/innovacion-library.json` define los 15 artículos, tres secciones por artículo, descripciones de imágenes y cuatro referencias editoriales. Los once IDs originales se conservan; se agregan CASE-04, CASE-05, TREND-04 y TREND-05.

## Contenido y procedencia

Los casos y noticias documentales conservan fechas, empresas, enlaces originales, procedencia y resultados. Las explicaciones editoriales separan los antecedentes reportados de sus implicaciones para proveedores. El camión eléctrico mantiene resultados preliminares; las cifras de los otros casos siguen siendo reportadas por la fuente, sin verificación independiente.

Los nuevos casos describen diseños de piloto de bombas y correas, sin empresas reales, fechas de ejecución ni resultados medidos. Su procedencia los identifica como escenarios sintéticos con referencias. Las tendencias son artículos editoriales basados en CNP, Cochilco, OPC Foundation y NIST, sin atribuirles autoría o respaldo institucional. Las referencias se conservan en `sources` y `reference_source_ids` aunque la interfaz no muestre la sección de fuentes.

## Presentación e interfaces

Las tarjetas y detalles usan el mismo componente `ContentThumbnail` que Formación. Cada imagen reserva un espacio 16:9, tiene descripción alternativa, carga diferida y fallback neutro. Los filtros siguen en la URL; el contador refleja los resultados y «Limpiar filtros» conserva la pestaña elegida. Volver desde un detalle recupera la búsqueda y filtros.

Los validadores de ejecución de `cases`, `news` y `trends` admiten campos opcionales `thumbnail_url`, `thumbnail_alt`, `reference_source_ids` y `body_sections` (objetos con `heading` y `body`). Las referencias se validan contra `sources`. No hay un nuevo endpoint ni migración SQL; los registros antiguos siguen siendo válidos. El paquete original permanece intacto.

Por solicitud del usuario, las rutas de Innovación ocultan insignias de procedencia y «Fuente y documentos». El contenido mantiene las salvedades relevantes sobre resultados y estado de los pilotos.

## Ilustraciones

Se generaron quince imágenes distintas con la herramienta integrada `image_gen`, una llamada por imagen. Los prompts exactos, método, originales y destinos están en `content/innovacion-artwork.json`. Los JPEG finales se encuentran en `public/images/innovacion/`, de 960 × 540 píxeles, aproximadamente 1,53 MB en total. Se convirtieron con System.Drawing a calidad 85; los originales generados se conservaron. La hoja de contacto está en `.local/innovacion-contact-sheet.jpg`.

## Actualización reproducible del catálogo

Se usa la misma base que la aplicación (`DATABASE_PATH`, por defecto `data/expande.sqlite`). El script lee cada registro y revisión mediante el CLI antes de preparar cambios completos, preservando los campos no modificados.

```powershell
npm.cmd run data -- help
npm.cmd run data -- collections
npm.cmd run data -- schema --collection cases
npm.cmd run data -- schema --collection news
npm.cmd run data -- schema --collection trends
node --experimental-transform-types scripts/prepare-innovacion-update.mjs
npm.cmd run data -- preview --scope catalog --file .local/innovacion-update.json
# Revisar el diff validado antes de aplicar el mismo archivo.
npm.cmd run data -- apply --scope catalog --file .local/innovacion-update.json --actor innovation-enrichment
npm.cmd run data -- history --scope catalog
```

El lote aplicado fue `0e5a10d5-0c18-4066-aba3-ada906e85878`: 15 artículos y cuatro fuentes. Se verificaron los 19 registros mediante `get` y sus 19 eventos de auditoría. Evidencia local: `.local/innovacion-preview.json`, `.local/innovacion-applied.json` y `.local/innovacion-audit-verification.json`.

Los datos no se reaplican automáticamente al arrancar ni se añaden al paquete de semilla. La restauración explícita del catálogo elimina este enriquecimiento; un reset de visitante lo conserva. No se modifican sesiones de visitantes, autenticación, envíos o servicios externos.

## Verificación

Build de producción aprobado; 42 pruebas unitarias/API/CLI/catálogos y 26 pruebas de navegador aprobadas. Cobertura: cinco artículos por pestaña, todas las imágenes y secciones, salvedades documentales, guardados, filtros combinados, regreso y limpieza, fallback accesible y anchos de 360/390/430 px sin desbordamiento horizontal. Se inspeccionaron visualmente la hoja de contacto y capturas móviles finales. No se afirma fidelidad completa con vistas anidadas de Figma ni se repitieron pruebas Docker.
