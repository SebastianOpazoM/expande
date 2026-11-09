# Biblioteca de financiamiento

La vista `/financiamiento` muestra doce fichas de programas reales, FUND-R11–FUND-R22. Se conservaron los trece registros anteriores con `catalog_hidden: true`: no aparecen en búsquedas del catálogo, contadores o valores de filtros, pero sus IDs y vínculos desde Guardados siguen funcionando. Sus detalles indican que son registros archivados. No se cambiaron sus fechas, cifras, tipos de registro, procedencia ni condiciones originales.

## Contenido y fuentes

`content/financiamiento-library.json` reúne el contenido editorial, las referencias y sus fechas de revisión. Cada ficha tiene resumen, elegibilidad, montos con contexto y cuatro secciones sobre propósito, condiciones de financiamiento, preparación y disponibilidad o antecedentes históricos. Las sugerencias de preparación son editoriales y no se atribuyen a las instituciones como asesoría o respaldo.

Los doce programas son Crea y Valida; Consolida y Expande Innovación; Innova Región; Innova Alta Tecnología; Capital Humano para la Innovación; Programa de Absorción Tecnológica para la Innovación; Súmate a Innovar; Semilla Inicia; Semilla Expande; Start-Up Chile (Build, Ignite y Growth); Startup Ciencia; y Red Proveedores. No se presentan como instrumentos exclusivos para minería. Se distingue especialmente al demandante que postula a Red Proveedores de sus empresas proveedoras participantes y al gestor de PATI de las empresas atendidas.

Se registraron dieciséis fuentes oficiales en `sources`. Se consultaron fichas Corfo, el anuncio BIG13 del Ministerio de Economía y documentación ANID. Las fichas generales de Crea y Valida y del calendario de innovación de Corfo tuvieron timeouts en algunas lecturas; se complementaron con la convocatoria nacional 2026 de Crea y Valida y el manual oficial PATI. La descarga de la ficha PDF de ChileAtiende para Súmate a Innovar devolvió 403; se conserva como enlace oficial, sin deducir un monto, cierre o disponibilidad vigentes de esa referencia. Las fuentes no garantizan que cada destino pueda abrirse en todos los navegadores.

La revisión del 8 de noviembre de 2026 confirmó el anuncio oficial BIG13: cierre el 24 de noviembre a las 13:00 de Chile, y apoyos diferenciados de CLP 15/30/75 millones. Los otros once programas quedan **Por confirmar** en cuanto a disponibilidad actual. Sus ediciones históricas se describen dentro del contenido; no se usan como próximos cierres ni se asume que un anuncio programado de resultados ya esté publicado. Una fila de Semilla Expande mantiene una etiqueta abierta con cierre pasado: no se utilizó como evidencia de apertura vigente. No se usaron cifras de Startup Ciencia 2027 procedentes solo de agregadores.

Los montos con etapas, líneas o condiciones se explican en `amount_text`. El valor numérico se usa únicamente cuando hay un techo de referencia inequívoco para ordenar; no se suman etapas de Semilla Expande ni se convierten CLP a USD. Los topes no verificados quedan como no informados. Las fechas de revisión aparecen en los detalles.

## Presentación y compatibilidad

Se reutiliza `ContentThumbnail` en tarjetas y detalles, con proporción 16:9, espacio reservado, carga diferida, texto alternativo y fallback neutro. La lista única conserva búsqueda, segmento, región, estado, moneda y orden, con «Limpiar filtros». Se retiraron las pestañas de convocatorias/hitos y el filtro de tipo. Las opciones se obtienen solo de registros visibles; los programas con cobertura «Todo Chile» se incluyen al filtrar una región.

Las rutas de financiamiento ocultan ambas insignias de procedencia y «Fuente y documentos». Se mantiene «Ver programa oficial» con confirmación de salida. La información original permanece almacenada. Los registros archivados no se convierten en nuevas oportunidades.

La validación de ejecución admite campos opcionales `thumbnail_url`, `thumbnail_alt`, `summary`, `body_sections`, `reference_source_ids`, `reviewed_on`, `closing_at` y `catalog_hidden`. Las secciones requieren `heading` y `body`; las referencias se validan contra `sources`; el plazo preciso incluye zona u offset. No se modificó el esquema del paquete original, ni se añadió SQL de migración o un endpoint nuevo.

`shared/funding.ts` separa la disponibilidad efectiva de los valores almacenados: un plazo preciso y verificado de una oportunidad real vence con la hora real. En el cliente se programa la actualización al alcanzar el plazo, sin exigir recargar; en el servidor se calcula al leer los datos. Los registros demo conservan su comportamiento con el reloj de visitante. No se reabren registros cerrados ni se reescribe el catálogo por el paso del tiempo. No hay monitoreo automático de cambios en las instituciones.

## Ilustraciones

Doce imágenes distintas se generaron con la herramienta integrada `image_gen`, una llamada por ficha. Los prompts exactos, método, originales y destinos están en `content/financiamiento-artwork.json`. Los originales se conservaron; se copiaron optimizados a `public/images/financiamiento/` como JPEG de 960 × 540, calidad 85 mediante System.Drawing, 1.160.135 bytes en total. La hoja de contacto `.local/financiamiento-contact-sheet.jpg` se revisó visualmente. No contienen logotipos o autoría institucional.

## Actualización de datos

El script lee cada fuente y cada registro/revisión mediante el CLI antes de preparar cambios completos. Usa `DATABASE_PATH` o la misma base predeterminada de la app (`data/expande.sqlite`).

```powershell
npm.cmd run data -- help
npm.cmd run data -- collections
npm.cmd run data -- schema --collection funding_calls
node --experimental-transform-types scripts/prepare-financiamiento-update.mjs
npm.cmd run data -- preview --scope catalog --file .local/financiamiento-update.json
# Inspeccionar el diff validado antes de aplicar el mismo archivo.
npm.cmd run data -- apply --scope catalog --file .local/financiamiento-update.json --actor funding-library
npm.cmd run data -- history --scope catalog
```

El lote `8690fd15-4e82-4964-a66c-8b4d20ec8b27` contiene doce programas nuevos, dieciséis fuentes oficiales y trece registros archivados. Evidencia local: `.local/financiamiento-preview.json`, `.local/financiamiento-applied.json`, `.local/financiamiento-history.json` y `.local/financiamiento-audit-verification.json`. No se modifican sesiones de visitantes ni el paquete original. El enriquecimiento se conserva al resetear una sesión y no se reaplica automáticamente tras restaurar el catálogo.

## Verificación

Build de producción aprobado; 45 pruebas unitarias/API/CLI/catálogos y las 36 pruebas de navegador aprobadas. Se cotejaron los 41 registros y sus 41 eventos de auditoría. Cobertura de las doce portadas, contenidos, vínculos oficiales y confirmación de salida, archivo y guardados, filtros combinados, orden por monto con desconocidos al final, limpieza y regreso, fallback y anchos 360/390/430 px sin desbordamiento. El vencimiento BIG13 se verificó en hora de Chile, con transición de estado sin recarga, independiente del reloj de visitante; se mantiene la lógica de tiempo demo para registros anteriores. Se inspeccionaron las capturas finales y la hoja de contacto. No se hicieron postulaciones reales ni se verificó fidelidad completa con todas las vistas de Figma o despliegue Docker.
