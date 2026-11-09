# Formación: biblioteca editorial ilustrada

La biblioteca contiene 12 tarjetas: 8 cápsulas, 3 masterclasses y 1 resumen audiovisual. Se preservan LEARN-R01, LEARN-D01 y LEARN-D02; se agregan LEARN-D03 a LEARN-D11.

## Contenido y fuentes

El contenido editable está en [`content/formacion-library.json`](../content/formacion-library.json). Incluye títulos, descripciones, tres capítulos por lección, duración ilustrativa, nivel y referencias editoriales públicas. Las once lecciones se atribuyen a **Equipo editorial de la demo**. Las instituciones citadas no se presentan como autoras, auspiciadoras ni acreditadoras de estos contenidos.

Las referencias provienen de Centro Nacional de Pilotaje, NASA, OMPI, OPC Foundation, NIST, HuellaChile, Cochilco y Codelco. Las fuentes principales se vinculan mediante `provenance.source_id`; `reference_source_ids` permite referencias adicionales, por ejemplo la información de proveedores de Codelco. Todos esos identificadores se validan contra `sources`.

LEARN-R01 reproduce dentro de su página el archivo MP4 aportado por el usuario, conservado sin transcodificar en `public/videos/expande-masterclass-resumen-jornada.mp4`. Su duración medida es 47,76 segundos (48 en el catálogo), con video H.264 y audio AAC. La referencia original de Drive y la atribución a Expande se conservan como procedencia; el campo `media_url` apunta ahora al archivo local. Los metadatos y SHA-256 están en `content/formacion-video.json`. El resto mantiene reproducción y progreso simulados, sin videos inventados, inscripciones ni certificados.

El cambio del video se aplicó al registro existente mediante el lote de catálogo `76ffaeec-c09e-466b-903a-0b470d7fee2f`; LEARN-R01 quedó en revisión 3. El reproductor incorpora controles nativos, reproducción inline, carga de metadatos y la miniatura como poster. Se verificaron reproducción, pausa, búsqueda a los 10 segundos, respuesta parcial HTTP 206 y ausencia de desbordamiento a 360, 390 y 430px. El archivo original y la copia local tienen el mismo SHA-256. La sección “Fuente y documentos” ya no se muestra en formación por una solicitud posterior del usuario; las referencias permanecen en los datos y en este manifiesto.

## Ilustraciones

Las doce imágenes finales están en [`public/images/formacion/`](../public/images/formacion/), como `learn-r01.jpg` y `learn-d01.jpg` a `learn-d11.jpg`. Fueron generadas individualmente con la herramienta integrada **image_gen**, con fondos opacos y una dirección editorial isométrica común: verde petróleo, maquinaria turquesa, acentos cálidos y ausencia de texto o marcas institucionales.

El conjunto exacto de prompts y el nombre de cada original generado se conserva en [`content/formacion-artwork.json`](../content/formacion-artwork.json). Los originales permanecen en la carpeta de imágenes generadas de Codex; las versiones finales del proyecto son JPEG de 960 × 540 píxeles, optimizadas para el catálogo. El conjunto completo ocupa aproximadamente 1,1 MB.

Las tarjetas reservan un espacio 16:9, cargan sus imágenes de forma diferida e incluyen texto alternativo. Si una imagen falta o falla, aparece un marcador neutral accesible sin alterar el tamaño de la tarjeta. Se conservan las pestañas de formato, los colores de sus etiquetas y la supresión de los badges de procedencia solicitada anteriormente.

## Aplicación a otro catálogo

Esta actualización se aplicó a la base local de la aplicación, `data/expande.sqlite`, mediante el lote **3a2dd71a-5c53-4503-9aae-ca31d444ac0d**: 10 fuentes y 12 registros de formación. Se inspeccionó el preview antes de aplicar el mismo archivo; se verificaron los 22 registros y sus 22 entradas de auditoría.

La semilla original no se modifica. Una base recién creada o una restauración explícita del catálogo vuelve al contenido original. Para enriquecer otra base, ejecutar desde la raíz del repositorio con el mismo `DATABASE_PATH` que la aplicación:

```powershell
node --experimental-transform-types scripts/prepare-formacion-update.mjs .local/formacion-update.json
npm run data -- preview --scope catalog --file .local/formacion-update.json
npm run data -- apply --scope catalog --file .local/formacion-update.json --actor formacion-editorial-enrichment
npm run data -- history --scope catalog
```

El preparador lee cada registro y su revisión mediante el CLI. No ejecuta `apply`, no elimina otros registros y conserva los campos originales del resumen audiovisual. Revisar siempre el diff antes de aplicar; si existe un conflicto, releer y reconciliar antes de reintentar. Los archivos `.local/formacion-preview.json`, `.local/formacion-applied.json` y `.local/formacion-audit-verification.json` conservan la evidencia de esta ejecución.

Las extensiones de validación en tiempo de ejecución son opcionales: `thumbnail_url`, `thumbnail_alt` y `reference_source_ids`. Los registros anteriores siguen siendo válidos y el paquete fuente original permanece intacto. No se cambian las sesiones, sus guardados ni su progreso como parte del lote de catálogo.

## Verificación

- `npm run build`: aprobado.
- `npm test`: **41 pruebas aprobadas**.
- `npm run test:e2e`: **20 pruebas aprobadas**, usando una base de prueba separada con la misma biblioteca editorial.
- Imágenes cargadas para los 12 registros y filtros con recuentos 8/3/1.
- Búsqueda, nivel, estado de URL, capítulos, fuente principal y fuentes adicionales verificados.
- Fallback de imagen, conservación de guardados/progreso y video documental verificados.
- Layout sin desbordamiento horizontal a 360, 390 y 430 px; capturas y contacto de las ilustraciones revisados visualmente en `.local/screenshots/formacion-*.png` y `.local/formacion-artwork-contact-sheet.jpg`.
- Frontend local, API y una imagen del catálogo respondieron HTTP 200.

Las referencias sustentan el diseño editorial; no implican que los cursos propuestos existan en esos sitios. No se verificaron reproducción externa del video de Drive, disponibilidad futura de las páginas de referencia ni fidelidad completa contra Figma. Docker no se volvió a comprobar en esta actualización.
