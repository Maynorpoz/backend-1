# Farmacia API — Backend con Node.js + Express

Sistema de **backend** (API REST) para una farmacia. No tiene interfaz gráfica:
todo se prueba con peticiones HTTP. Los datos se guardan en un **archivo JSON**,
no en una base de datos, para que el foco quede en cómo funciona Node.js.

---

## 1. Cómo ejecutarlo

```bash
npm install     # instala Express (única dependencia)
npm start       # levanta el servidor en http://localhost:3000
npm run dev     # igual, pero se reinicia solo al guardar cambios
npm test        # ejecuta las 35 pruebas automatizadas
```

Al abrir `http://localhost:3000/` la API devuelve su propia documentación en JSON.

Para probar los endpoints hay dos opciones:
- Abrir `peticiones.http` en VS Code con la extensión **REST Client** y dar clic en *Send Request*.
- Usar `curl` o Postman (ejemplos más abajo).

---

## 2. Qué hace el sistema

La farmacia maneja tres entidades relacionadas:

```
CATEGORIA  1 ──────< N  PRODUCTO  1 ──────< N  ITEM DE VENTA  N >────── 1  VENTA
```

### Categorías

Clasifican los productos (Analgésicos, Antibióticos, Vitaminas, Cuidado personal).
Reglas implementadas:
- No se permiten dos categorías con el mismo nombre → `409 Conflict`.
- **No se puede eliminar una categoría que todavía tiene productos** → `409 Conflict`.
  Es una regla de integridad referencial hecha a mano, igual a la que haría una
  llave foránea en SQL.

### Productos (inventario)

Cada producto guarda los datos propios del giro farmacéutico:

| Campo | Para qué sirve |
|---|---|
| `codigo` | Identificador comercial, formato `ABC-123` |
| `precio` / `stock` | Venta y existencias |
| `stockMinimo` | Umbral para alertar reabastecimiento |
| `lote` | Trazabilidad del fabricante |
| `fechaVencimiento` | Control de caducidad |
| `requiereReceta` | Marca los medicamentos controlados |

La API agrega campos **calculados** al responder (no se guardan en el JSON):
`categoria`, `diasParaVencer`, `vencido` y `stockBajo`.

Se puede filtrar el inventario por *query string*:

```
GET /api/productos?buscar=ibupro        → busca por nombre o código
GET /api/productos?categoriaId=1        → solo analgésicos
GET /api/productos?stockBajo=true       → los que hay que reabastecer
GET /api/productos?porVencer=90         → los que caducan en 90 días
```

### Ventas (la caja)

Es la parte con más lógica. Al registrar una venta, el sistema:

1. Valida el cuerpo de la petición (cliente e ítems).
2. Revisa **cada producto** antes de tocar nada:
   - que exista,
   - que **no esté vencido**,
   - que haya **stock suficiente**,
   - que se adjunte `recetaMedica` si el producto la exige.
3. Si algo falla, responde `409` con **todos** los problemas juntos y **no modifica
   el inventario**. Si todo está bien, descuenta stock, calcula subtotal, IVA (12 %)
   y total, y guarda la venta.
4. Devuelve además `alertasInventario` si algún producto quedó bajo su mínimo.

Ese "valido todo primero, aplico después" es la forma de imitar el *todo o nada*
de una transacción, que el archivo JSON no ofrece por sí solo.

`GET /api/ventas/resumen` entrega un reporte: total de ventas, ingreso acumulado,
los 3 productos más vendidos y los productos con stock bajo.

---

## 3. Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Documentación de la API |
| GET | `/api/categorias` | Lista categorías con su conteo de productos |
| GET | `/api/categorias/:id` | Categoría con sus productos |
| POST | `/api/categorias` | Crea categoría |
| PUT | `/api/categorias/:id` | Actualiza categoría |
| DELETE | `/api/categorias/:id` | Elimina (solo si no tiene productos) |
| GET | `/api/productos` | Inventario, admite filtros |
| GET | `/api/productos/:id` | Detalle de producto |
| POST | `/api/productos` | Registra producto |
| PUT | `/api/productos/:id` | Actualiza producto |
| PATCH | `/api/productos/:id/stock` | Reabastece inventario |
| DELETE | `/api/productos/:id` | Elimina producto |
| GET | `/api/ventas` | Historial de ventas |
| GET | `/api/ventas/resumen` | Reporte de la farmacia |
| GET | `/api/ventas/:id` | Detalle de venta |
| POST | `/api/ventas` | Registra venta y descuenta stock |

Todas las respuestas siguen el mismo formato:

```jsonc
// Éxito
{ "ok": true, "mensaje": "...", "datos": { } }

// Error
{ "ok": false, "error": "...", "detalles": ["..."] }
```

Códigos usados: `200` OK · `201` creado · `400` datos inválidos · `404` no existe ·
`409` conflicto de negocio · `422` referencia inválida · `500` error interno.

---

## 4. Estructura del proyecto

```
backend/
├── server.js                  # Punto de entrada: carga datos y levanta el servidor
├── peticiones.http            # 21 peticiones listas para probar
├── test/
│   └── farmacia.test.js       # 35 pruebas automatizadas (node:test)
├── src/
│   ├── app.js                 # Configuración de Express y cadena de middlewares
│   ├── data/farmacia.json     # "Base de datos": categorías, productos y ventas
│   ├── store/db.js            # Capa de acceso a datos (lee/escribe el JSON)
│   ├── routes/                # Qué URL corresponde a qué controlador
│   ├── controllers/           # Reglas de negocio de cada recurso
│   ├── middlewares/           # Logger y manejo central de errores
│   └── utils/                 # Validaciones y clase de error
```

La separación **ruta → controlador → datos** es el patrón estándar de un backend:
la ruta solo decide *quién* atiende, el controlador aplica *la regla*, y la capa de
datos se ocupa de *dónde* se guarda. Si mañana se cambia el JSON por PostgreSQL,
solo se reescribe `src/store/db.js`.

---

## 5. Pruebas automatizadas

```bash
npm test
```

El proyecto incluye **35 pruebas** en `test/farmacia.test.js`, escritas con el
ejecutor de pruebas que **ya trae Node.js** (`node:test`): no hace falta instalar
Jest ni Mocha.

Son pruebas **de punta a punta**: levantan el servidor real en un puerto libre y le
hacen peticiones HTTP con `fetch`, igual que lo haría Postman. Para no alterar los
datos reales, antes de empezar se copia `farmacia.json` a un archivo temporal y se
le indica a la capa de datos que use esa copia mediante la variable de entorno
`FARMACIA_DB`.

Lo que se verifica:

| Grupo | Casos cubiertos |
|---|---|
| Documentación y rutas | La raíz documenta la API; una ruta inexistente responde `404` en JSON |
| Categorías | Listado con conteo, creación, nombre duplicado (`409`) y **no borrar una categoría con productos** |
| Productos | Campos calculados, los 3 filtros, validación con `400`, categoría inexistente (`422`), código duplicado (`409`) y reabastecimiento |
| Ventas | Cálculo del IVA, descuento de stock, alerta de stock mínimo, rechazo por falta de receta, por producto vencido y por stock insuficiente |

La prueba más importante es **"TODO O NADA"**: envía una venta con dos productos,
uno válido y otro vencido, y comprueba que tras el rechazo el producto válido
**conserva su stock original**. Es la que demuestra que la validación ocurre antes
de modificar el inventario.

Otra prueba verifica que `/api/ventas/resumen` devuelva el reporte y no una venta,
que es justamente el error que provoca declarar esa ruta después de `/:id`.

---

## 6. Lo que este proyecto demuestra de Node.js

**1. El servidor es la propia aplicación.**
Node no necesita Apache, IIS ni Tomcat. `app.listen(3000)` levanta el servidor HTTP
dentro del mismo proceso de JavaScript.

**2. Un solo hilo + E/S no bloqueante.**
Node atiende muchas peticiones con un único hilo porque nunca se queda esperando al
disco: delega la operación y sigue atendiendo. Por eso toda la capa de datos usa
`fs/promises` con `async/await`, nunca las versiones `...Sync`.

**3. Programación orientada a eventos.**
En `src/middlewares/logger.js` nos suscribimos al evento `finish` de la respuesta
(`res.on('finish', ...)`) para medir cuánto tardó la petición. No se "espera" a que
termine: se reacciona cuando ocurre.

**4. Middlewares: la petición como una cadena.**
En `src/app.js` la petición baja por `express.json()` → `logger` → el router del
recurso → y si nadie respondió, por el 404 y el manejador de errores. **El orden
importa**: por eso el manejador de errores va de último y `/api/ventas/resumen` se
declara antes que `/api/ventas/:id` (si no, Express tomaría "resumen" como un id).

**5. Manejo centralizado de errores.**
Express reconoce un middleware de errores porque recibe **cuatro** parámetros
`(err, req, res, next)`. Cualquier `throw` en un controlador cae ahí, así que el
cliente siempre recibe JSON y nunca un *stack trace*. Express 5 captura solo los
errores de funciones `async`, sin necesidad de `try/catch` en cada controlador.

**6. Módulos ES y escritura segura.**
El proyecto usa `import/export` (`"type": "module"`). Al guardar, `db.js` escribe
primero un archivo `.tmp` y luego lo renombra: si el proceso muere a mitad de la
escritura, el JSON original no queda corrupto. Además encadena las escrituras en una
cola (`Promise`) para que dos peticiones simultáneas no se pisen — un problema real
que aparece justamente por ser asíncrono.

---

## 7. Prueba rápida con curl

```bash
# Ver el inventario
curl http://localhost:3000/api/productos

# Productos bajo el stock mínimo
curl "http://localhost:3000/api/productos?stockBajo=true"

# Venta válida (descuenta stock)
curl -X POST http://localhost:3000/api/ventas \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Maria Lopez","recetaMedica":"RM-4521","items":[{"productoId":1,"cantidad":2},{"productoId":3,"cantidad":1}]}'

# Venta rechazada: el antibiótico exige receta
curl -X POST http://localhost:3000/api/ventas \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Juan Perez","items":[{"productoId":3,"cantidad":1}]}'

# Reporte de la farmacia
curl http://localhost:3000/api/ventas/resumen
```

Después de una venta se puede abrir `src/data/farmacia.json` y comprobar que el
stock bajó y que la venta quedó guardada: la persistencia es real.
