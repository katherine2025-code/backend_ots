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

---

# Descarga de datos limpios (auditoría de calidad)

Fecha: 2026-11-10

## Contexto
Los encuestadores suben los archivos (CSV/XLSX) sin revisión; se confía en que el ETL
los limpia. Revisando el archivo CRUDO de Noviembre se ven celdas vacías y "N/A", pero
eso es el archivo de origen: el ETL **sí** limpia al insertar en la base
(`ots_app_encuestas.py`): vacío/"N/A" en opción → `Prefiero no responder`; en escala/numérico
→ `0`. El dato en la base ya está limpio. Faltaba una forma de **comprobarlo**.

## Cambios

| Archivo | Cambio | Motivo |
|---|---|---|
| `src/controller/etlController.js` | Nueva función `exportarDatosLimpios` (+ helper `filasACsv`): hace `SELECT *` de `encuestas_turisticas` (turista) u `ocupacion_hotelera` (hotel), filtrado por el rango del feriado elegido (mismo calendario/margen del sistema), y lo devuelve como CSV (separador `;`, BOM UTF-8 para Excel). | Permitir auditar la calidad de los datos ya limpios por feriado. |
| `src/routes/etlRoutes.js` | Nueva ruta `GET /api/etl/exportar-limpio` (solo Super Admin). | Exponer la descarga. |
| `../ots_front/src/app/core/services/etl.service.ts` | Nuevo `descargarDatosLimpios(tipo, feriado?)` (responseType blob). | Llamar al endpoint y descargar. |
| `../ots_front/src/app/pages/etl/etl.page.ts` | Props `expTipo`, `expFeriado`, `feriadosLista`, `descargandoCsv` + método `descargarCsvLimpio()`. | Lógica del selector y la descarga. |
| `../ots_front/src/app/pages/etl/etl.page.html` | Tarjeta "Descargar datos limpios (CSV)" en la pestaña **Historial**: selector de tipo + feriado y botón de descarga. | UI pedida: descargar CSV limpio por feriado desde el historial ETL. |

## Resultado
En ETL → pestaña **Historial** → "Descargar datos limpios (CSV)": se elige tipo
(Turística / Ocupación) y feriado (o "Todos"), y se descarga el CSV limpio desde la base.
