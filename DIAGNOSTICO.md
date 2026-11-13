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

---

# Tabulación de la encuesta hotelera en Reportes

Fecha: 2026-11-10

## Cambios (solo frontend; el backend ya soportaba `tipo=hotel`)

| Archivo | Cambio | Motivo |
|---|---|---|
| `ots_front/.../reportes/reportes.page.ts` | Nueva prop `encuestaTab: 'turista'|'hotel'`; `cargarTabulacion` ahora llama a `getTabulacionApp({tipo:'hotel', feriado})` cuando es hotel; nuevo método `cambiarEncuestaTab()`. | Tabular la encuesta hotelera igual que la turística. |
| `ots_front/.../reportes/reportes.page.html` | Selector **Turística / Hotelera**; el toggle ETL/App solo aparece en Turística; aviso propio para Hotelera. | UI para elegir qué encuesta tabular. |

## Nota de datos
La tabulación hotelera sale de `respuestas_encuestas` (encuesta de hotel de la **app**). Los
archivos de establecimiento cargados por **Kobo/ETL** van a `ocupacion_hotelera` (solo números
de ocupación), por eso no aparecen como tabulación de preguntas.

---

# Reportes: todas las preguntas turísticas + se elimina "Kobo" y el aviso amarillo

Fecha: 2026-11-11

## Problema (reportado por Katherine)
1. La tabulación turística no mostraba TODAS las preguntas.
2. Un aviso amarillo decía "25 de 37 preguntas... archivo de Kobo"; no debe verlo el jurado.
3. La palabra "Kobo" aparecía en el sistema; es NUESTRO sistema, no se debe nombrar otro software.

## Causa
- La tabulación (`obtenerTabulacion`) tenía una **lista fija** (`PREGUNTAS_TABULABLES`) que omitía los
  6 gastos por rubro (se guardan como monto medio del rango, no como categoría) y `lugares_visitados`.
  Los datos SÍ están en `encuestas_turisticas`; solo faltaba incluir esas preguntas.

## Cambios

| Archivo | Cambio | Motivo |
|---|---|---|
| `src/controller/reporteController.js` | Se agregaron a `PREGUNTAS_TABULABLES`: `lugares_visitados` (multiopción) y los 6 `gasto_*` por rubro. Para el gasto se revierte el monto guardado a su rango (`RANGO_GASTO`/`bucketGasto`); el 0 se cuenta como "sin dato" (es ambiguo: sin gasto o sin respuesta). Se quitó del comentario la narrativa de "25/37" y las referencias a Kobo. | Que se tabulen TODAS las preguntas del cuestionario turístico. |
| `ots_front/.../reportes/reportes.page.html` | Se eliminó el aviso amarillo (`aviso-pendiente`) con el texto de "25 de 37 / Kobo". | El jurado no debe ver ese mensaje. |
| `ots_front/.../sidebar.component.ts` | Texto de ayuda de Carga ETL: "(CSV / Excel / Kobo)" → "(CSV / Excel)". | Quitar "Kobo" de la interfaz. |
| `ots_front/.../reportes.page.ts`, `reportes.page.scss`, `etl.page.ts`, `ocupacion.page.ts`, `ocupacion.service.ts`, `reporte.service.ts` | Se reemplazó "Kobo" por términos neutros en comentarios y textos. | Que la palabra "Kobo" no aparezca. |
| `Microserv_ETLpython/kobo_encuestas_turismo.py`, `kobo_establecimientos.py` | Advertencia del ETL "(mismo envío de Kobo)" → "(mismo envío)". | Único texto del ETL visible al usuario que decía "Kobo". |

Nota: los nombres internos de archivos (`kobo_*.py`) y la columna `uuid_kobo` NO se muestran en
pantalla; se dejan para no arriesgar una migración innecesaria.

---

# Reportes: se quitó el toggle "Datos del ETL / Datos de la app"

Fecha: 2026-11-11

## Cambio (frontend)
A pedido de Katherine, en la sección "Tabulación por pregunta" se **eliminó** el selector de
fuente **"Datos del ETL (Kobo) / Datos de la app (todas)"**. Queda solo el selector de encuesta
**Turística / Establecimiento de alojamiento**. La tabulación turística usa siempre los datos
cargados (ETL/Kobo, la muestra histórica); la de establecimiento sale de `respuestas_encuestas`
(encuestas de la app) vía `getTabulacionApp(tipo:'hotel')`.

| Archivo | Cambio | Motivo |
|---|---|---|
| `ots_front/.../reportes/reportes.page.html` | Se borró el `div.fuente-tab` de ETL/App y sus avisos; se renombró el botón "Hotelera" → "Establecimiento de alojamiento"; el aviso de 25/37 preguntas ahora depende solo de `encuestaTab === 'turista'`. | Simplificar: una sola vista por tipo de encuesta, sin el toggle de fuente que confundía. |

Nota: `fuenteTab` queda fijo en `'etl'` en el `.ts` (el método `cambiarFuenteTab` queda sin uso,
sin efecto). Pendiente de decisión: de dónde alimentar la tabulación de establecimiento (ver abajo).

---

# Gráficos en blanco en Reportes (producción) — diagnóstico

El código de los gráficos y el registro de Chart.js son **idénticos** entre `main` (que
renderiza bien en producción) y la rama, así que **no es una regresión de los cambios**. Señal
fuerte: el total de encuestas en producción bajó de ~9194 a 1927 → la **base de datos de
producción cambió** (parece que quedó solo la carga de Difuntos). Pendiente confirmar con la
consola del navegador / respuesta de `/reportes/estadisticas` y revisar si se reinició la BD.
