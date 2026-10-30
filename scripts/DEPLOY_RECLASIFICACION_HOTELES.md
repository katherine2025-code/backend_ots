# Deploy a producción: reclasificación de hoteles y métricas

Este checklist cubre los dos cambios:

1. Corrección del cantón/parroquia de los 32 hoteles.
2. Métricas de Predicciones coherentes con la precisión oficial del modelo (61.44 %).

> **No ejecutar `scripts/corregir_hoteles.js` en producción.** Ese script fusiona
> duplicados y elimina fichas; está pensado para la limpieza local. La migración
> segura es `scripts/reclasificar_hoteles.js`.

---

## 1. Archivos que se despliegan

**Backend Node**
- `scripts/reclasificar_hoteles.js` (nuevo)

**Microservicio ML**
- `modelo.py`
- `app.py`
- `regenerar_modelo.py`
- `modelo_rf_ots.pkl`
- `modelo_xgb_ots.pkl`
- `modelo_prophet_ots.pkl`
- `modelo_ganador.json` (incluye `test_predicciones` y `temporada_mapa`)

> Si en el servidor se reentrena con `regenerar_modelo.py`, no hace falta copiar
> los `.pkl` ni el JSON: se generan allí. Si no se reentrena, hay que copiar los
> cuatro archivos juntos; un `.pkl` nuevo con un JSON viejo deja las métricas
> incoherentes.

**Frontend**
- `src/app/pages/predicciones/predicciones.page.ts`
- `src/app/pages/predicciones/predicciones.page.html`
- Build compilado (`www/`) o el comando de build usado en el servidor.

---

## 2. Corregir hoteles en producción

Trabajar en `backend_ots` con el `.env` de producción.

```powershell
# 1) Revisar sin escribir nada
node scripts/reclasificar_hoteles.js

# 2) Aplicar (guarda un respaldo JSON automático en scripts/backups/)
node scripts/reclasificar_hoteles.js --aplicar
```

Qué hace:

- Recalcula el cantón desde la parroquia para todos los hoteles.
- Aplica el mapeo explícito de los 32 hoteles como garantía.
- Si la parroquia no pertenece al cantón esperado, también la corrige para que
  el próximo ETL no vuelva a mover el hotel.
- Verifica al final que los 32 queden en el cantón correcto e imprime la
  distribución por cantón.

Resultado esperado en local: `98 hoteles`, `30 Salinas / 68 Santa Elena`,
`32/32 correctos`, `0 cambios pendientes`.

Si el dry-run reporta nombres **FALTA**, revisar que producción use los mismos
nombres (el script ignora acentos, mayúsculas y espacios repetidos, pero no
variantes de texto distintas).

### Respaldo manual adicional (opcional)

```powershell
mysqldump -u <usuario> -p <base> hoteles > hoteles_antes_reclasificar.sql
```

---

## 3. Reentrenar el modelo (o copiar los archivos)

En `Microserv_ETLpython`, con el entorno virtual:

```powershell
$env:PYTHONIOENCODING='utf-8'
$env:PYTHONUTF8='1'
.\venv\Scripts\python.exe regenerar_modelo.py
```

Debe imprimir:

- Modelo ganador: `Random Forest`
- `Precisión: 61.44%`
- `test_ids=43`, `test_predicciones=43`
- `temporada_mapa={'Alta': 0, 'Media': 1}`
- `OK: el modelo, los test_ids, las predicciones del holdout y el mapeo de temporada quedaron guardados.`

Si no se reentrena, copiar los 4 archivos indicados en el punto 1.

---

## 4. Reiniciar el microservicio ML

```powershell
.\venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 5000
```

Comprobar:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/predicciones-historicas |
  Select-Object precision_promedio, precision_modelo, mape, total_registros, conjunto_evaluado
```

Debe devolver:

```
precision_promedio : 61.44
precision_modelo   : 61.44
mape               : 38.56
total_registros    : 43
conjunto_evaluado  : prueba
```

---

## 5. Verificación final

```powershell
# Backend Node (con el backend arriba en :3000)
node scripts/_test_api.js
```

Criterio de aceptación: `27 OK, 0 FALLAS`.

Además, en la página de Predicciones:

- La tarjeta "Precisión del modelo" y la nota deben mostrar **61.44 %**.
- La nota debe indicar **MAPE 38.56 %**.
- La tabla puede mostrar precisiones negativas en registros con error mayor al
  100 % del valor real: es intencional, no se recorta.
- El histograma de precisión incluye el bucket "Menor a 0%" y suma 43 registros.

---

## 6. Qué quedó corregido en el modelo

- `temporada` ya no se recodifica con una sola fila al predecir. Se persiste el
  mapeo del entrenamiento (`Alta=0`, `Media=1`). Una temporada desconocida
  (`Baja`, que no existe en los datos) cae en `Media`; antes **todas** caían en
  `Alta`.
- `/predicciones-historicas` usa las predicciones guardadas del 30 % de prueba,
  no vuelve a predecir. Por eso la precisión mostrada es exactamente la oficial.
- La precisión por fila ya no se recorta a 0 y se expone el MAPE.
