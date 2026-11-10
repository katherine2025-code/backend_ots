# DIAGNÓSTICO — Tabulación por feriado en Reportes

Rama: `feat/tabulacion-app`
Fecha: 2026-11-10

## Problema
En Reportes, al elegir un feriado en el filtro, la **tabulación por pregunta** no se
filtraba por ese feriado cuando la fuente era "App" (datos de `respuestas_encuestas`):
el frontend solo le enviaba `fechaInicio`/`fechaFin`, nunca el feriado. Resultado: la
tabulación de la app mostraba TODAS las encuestas sin importar el feriado seleccionado.
(La fuente "ETL/Kobo" sí filtraba por feriado porque usa `construirFiltroFecha`.)

## Cambios

| Archivo | Cambio | Motivo |
|---|---|---|
| `src/controller/tabulacionAppController.js` | Se agregó el helper `rangoDeFeriado(nombre)` (convierte el nombre del feriado a su rango `[inicio, fin]` usando la tabla `feriados` + `MARGEN_ANALISIS_DIAS`) y se lee el query param `feriado`. El filtro de fecha ahora **intersecta** el rango del feriado con el rango de fechas explícito (toma la cota inferior más alta y la superior más baja). Si el feriado no existe en la tabla, devuelve `total: 0`. La respuesta incluye `feriado`. | Que la tabulación de la app respete el feriado elegido, con el mismo calendario/margen que usa todo el sistema (Ocupación, gráficos). |
| `../ots_front/src/app/core/services/reporte.service.ts` | `getTabulacionApp` ahora acepta `feriado?` en sus filtros. | Para poder enviar el feriado al backend. |
| `../ots_front/src/app/pages/reportes/reportes.page.ts` | `cargarTabulacion()` ahora pasa `feriado: filtros.feriado` a `getTabulacionApp`. | Que al elegir un feriado, la tabulación de la app muestre solo ese feriado. |

## Resultado
Al elegir un feriado en Reportes, **ambas fuentes** (ETL/Kobo y App) muestran solo la
tabulación de ese feriado. "Todos" vuelve a mostrar el total.

## Nota de datos (no es bug)
- Los feriados históricos cargados por **Kobo/ETL** viven en `encuestas_turisticas` →
  se tabulan con la fuente **"ETL/Kobo"** (limitada a las preguntas con columna propia).
- Las encuestas recogidas por la **app** viven en `respuestas_encuestas` → fuente **"App"**
  (todas las preguntas). Para un feriado sin encuestas de la app, esa fuente sale vacía;
  es esperado, no un error.
