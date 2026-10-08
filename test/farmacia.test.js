/**
 * PRUEBAS AUTOMATIZADAS DE LA API
 * -------------------------------
 * Se usa el ejecutor de pruebas que YA TRAE Node.js ('node:test'), asi que
 * no hace falta instalar Jest ni Mocha. Se corren con:  npm test
 *
 * Las pruebas levantan el servidor real en un puerto libre y le hacen
 * peticiones HTTP con fetch (tambien nativo de Node). Es decir, se prueba
 * la API completa de punta a punta, no funciones sueltas.
 *
 * Para no ensuciar los datos reales, antes de empezar se copia el JSON de la
 * farmacia a un archivo temporal y se le indica a la capa de datos que use
 * esa copia mediante la variable de entorno FARMACIA_DB.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEMILLA = path.join(__dirname, '..', 'src', 'data', 'farmacia.json');
const COPIA = path.join(os.tmpdir(), `farmacia-test-${process.pid}.json`);

let servidor;
let base;
let guardarDatos;

/** Atajo para hacer peticiones y recibir { estado, cuerpo } ya parseado. */
async function pedir(metodo, ruta, cuerpo) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
}

before(async () => {
  await copyFile(SEMILLA, COPIA);

  // OJO: la variable debe fijarse ANTES de importar db.js, porque el modulo
  // calcula la ruta del archivo en el momento en que se carga.
  process.env.FARMACIA_DB = COPIA;
  process.env.NODE_ENV = 'test';   // silencia los logs para ver limpio el resultado

  const { conectar, guardar } = await import('../src/store/db.js');
  const { default: app } = await import('../src/app.js');
  guardarDatos = guardar;

  await conectar();

  // El puerto 0 le pide al sistema operativo cualquier puerto libre:
  // asi las pruebas no chocan con el servidor que este corriendo en el 3000.
  servidor = app.listen(0);
  await new Promise((listo) => servidor.once('listening', listo));
  base = `http://localhost:${servidor.address().port}`;
});

after(async () => {
  await guardarDatos();            // deja terminar las escrituras pendientes
  servidor.close();
  await unlink(COPIA).catch(() => {});
});

// ---------------------------------------------------------------------------

describe('Documentacion y rutas', () => {
  it('la raiz devuelve la documentacion de la API', async () => {
    const { estado, cuerpo } = await pedir('GET', '/');
    assert.equal(estado, 200);
    assert.equal(cuerpo.api, 'Farmacia API');
    assert.ok(cuerpo.endpoints.productos);
  });

  it('una ruta inexistente responde 404 en JSON, no un error del servidor', async () => {
    const { estado, cuerpo } = await pedir('GET', '/api/doctores');
    assert.equal(estado, 404);
    assert.equal(cuerpo.ok, false);
    assert.match(cuerpo.error, /no existe/);
  });
});

describe('Categorias', () => {
  it('lista las categorias con su total de productos', async () => {
    const { estado, cuerpo } = await pedir('GET', '/api/categorias');
    assert.equal(estado, 200);
    assert.equal(cuerpo.total, 4);

    const analgesicos = cuerpo.datos.find((c) => c.nombre === 'Analgesicos');
    assert.equal(analgesicos.totalProductos, 2);
  });

  it('devuelve la categoria con sus productos', async () => {
    const { estado, cuerpo } = await pedir('GET', '/api/categorias/1');
    assert.equal(estado, 200);
    assert.equal(cuerpo.datos.productos.length, 2);
  });

  it('rechaza una categoria sin nombre valido', async () => {
    const { estado, cuerpo } = await pedir('POST', '/api/categorias', { nombre: 'X' });
    assert.equal(estado, 400);
    assert.ok(cuerpo.detalles.length > 0);
  });

  it('crea una categoria nueva', async () => {
    const { estado, cuerpo } = await pedir('POST', '/api/categorias', {
      nombre: 'Antigripales',
      descripcion: 'Gripe y resfriado',
    });
    assert.equal(estado, 201);
    assert.equal(cuerpo.datos.nombre, 'Antigripales');
  });

  it('no permite dos categorias con el mismo nombre', async () => {
    const { estado } = await pedir('POST', '/api/categorias', { nombre: 'Antigripales' });
    assert.equal(estado, 409);
  });

  it('NO deja eliminar una categoria que tiene productos (integridad)', async () => {
    const { estado, cuerpo } = await pedir('DELETE', '/api/categorias/1');
    assert.equal(estado, 409);
    assert.match(cuerpo.error, /productos asociados/);

    // Y comprobamos que efectivamente sigue ahi
    const { estado: estadoLuego } = await pedir('GET', '/api/categorias/1');
    assert.equal(estadoLuego, 200);
  });

  it('si elimina una categoria vacia', async () => {
    const { cuerpo: lista } = await pedir('GET', '/api/categorias');
    const vacia = lista.datos.find((c) => c.totalProductos === 0);

    const { estado } = await pedir('DELETE', `/api/categorias/${vacia.id}`);
    assert.equal(estado, 200);
  });
});

describe('Productos', () => {
  it('agrega campos calculados que no estan en el JSON', async () => {
    const { cuerpo } = await pedir('GET', '/api/productos/1');
    const producto = cuerpo.datos;

    assert.equal(producto.categoria, 'Analgesicos');
    assert.equal(typeof producto.diasParaVencer, 'number');
    assert.equal(typeof producto.vencido, 'boolean');
    assert.equal(producto.stockBajo, producto.stock <= producto.stockMinimo);
  });

  it('filtra los productos bajo el stock minimo', async () => {
    const { cuerpo } = await pedir('GET', '/api/productos?stockBajo=true');
    assert.ok(cuerpo.datos.every((p) => p.stock <= p.stockMinimo));
    assert.ok(cuerpo.datos.some((p) => p.nombre === 'Ibuprofeno 400mg'));
  });

  it('busca por nombre o por codigo', async () => {
    const porNombre = await pedir('GET', '/api/productos?buscar=ibupro');
    assert.equal(porNombre.cuerpo.total, 1);

    const porCodigo = await pedir('GET', '/api/productos?buscar=MED-001');
    assert.equal(porCodigo.cuerpo.total, 1);
  });

  it('filtra por categoria', async () => {
    const { cuerpo } = await pedir('GET', '/api/productos?categoriaId=1');
    assert.ok(cuerpo.datos.every((p) => p.categoriaId === 1));
  });

  it('rechaza un producto con datos invalidos y devuelve TODOS los errores', async () => {
    const { estado, cuerpo } = await pedir('POST', '/api/productos', {
      nombre: 'X',
      precio: -5,
    });
    assert.equal(estado, 400);
    assert.ok(cuerpo.detalles.some((d) => d.startsWith('codigo')));
    assert.ok(cuerpo.detalles.some((d) => d.startsWith('precio')));
  });

  it('rechaza un producto de una categoria que no existe', async () => {
    const { estado } = await pedir('POST', '/api/productos', {
      codigo: 'XXX-999',
      nombre: 'Producto fantasma',
      categoriaId: 999,
      precio: 10,
      stock: 5,
      fechaVencimiento: '2030-01-01',
    });
    assert.equal(estado, 422);
  });

  it('registra un producto valido', async () => {
    const { estado, cuerpo } = await pedir('POST', '/api/productos', {
      codigo: 'MED-004',
      nombre: 'Loratadina 10mg',
      categoriaId: 1,
      precio: 28.5,
      stock: 50,
      stockMinimo: 10,
      fechaVencimiento: '2030-08-01',
    });
    assert.equal(estado, 201);
    assert.equal(cuerpo.datos.codigo, 'MED-004');
  });

  it('no permite repetir el codigo de un producto', async () => {
    const { estado } = await pedir('POST', '/api/productos', {
      codigo: 'MED-004',
      nombre: 'Otro producto',
      categoriaId: 1,
      precio: 10,
      stock: 5,
      fechaVencimiento: '2030-01-01',
    });
    assert.equal(estado, 409);
  });

  it('reabastece el inventario sumando unidades', async () => {
    const { cuerpo: antes } = await pedir('GET', '/api/productos/2');
    const { estado, cuerpo } = await pedir('PATCH', '/api/productos/2/stock', { cantidad: 60 });

    assert.equal(estado, 200);
    assert.equal(cuerpo.datos.stock, antes.datos.stock + 60);
  });

  it('rechaza un reabastecimiento con cantidad invalida', async () => {
    const { estado } = await pedir('PATCH', '/api/productos/2/stock', { cantidad: -10 });
    assert.equal(estado, 400);
  });

  it('responde 404 si el producto no existe', async () => {
    const { estado } = await pedir('GET', '/api/productos/9999');
    assert.equal(estado, 404);
  });
});

describe('Ventas', () => {
  // Productos creados a proposito para estas pruebas, con fechas fijas,
  // para que los resultados no dependan del dia en que se ejecuten.
  let conReceta;
  let vencido;
  let normal;

  before(async () => {
    const crear = async (datos) => (await pedir('POST', '/api/productos', datos)).cuerpo.datos;

    conReceta = await crear({
      codigo: 'TST-001', nombre: 'Antibiotico de prueba', categoriaId: 2,
      precio: 100, stock: 10, fechaVencimiento: '2099-12-31', requiereReceta: true,
    });
    vencido = await crear({
      codigo: 'TST-002', nombre: 'Jarabe caducado', categoriaId: 2,
      precio: 50, stock: 10, fechaVencimiento: '2020-01-01',
    });
    normal = await crear({
      codigo: 'TST-003', nombre: 'Producto de prueba', categoriaId: 3,
      precio: 50, stock: 5, stockMinimo: 4, fechaVencimiento: '2099-12-31',
    });
  });

  it('registra una venta, descuenta stock y calcula el IVA', async () => {
    const { estado, cuerpo } = await pedir('POST', '/api/ventas', {
      cliente: 'Maria Lopez',
      items: [{ productoId: normal.id, cantidad: 2 }],
    });

    assert.equal(estado, 201);
    assert.equal(cuerpo.datos.subtotal, 100);     // 50 x 2
    assert.equal(cuerpo.datos.impuesto, 12);      // IVA 12 %
    assert.equal(cuerpo.datos.total, 112);

    const { cuerpo: luego } = await pedir('GET', `/api/productos/${normal.id}`);
    assert.equal(luego.datos.stock, 3);           // 5 - 2
  });

  it('avisa cuando un producto queda bajo el stock minimo', async () => {
    const { cuerpo } = await pedir('POST', '/api/ventas', {
      cliente: 'Carlos Ruiz',
      items: [{ productoId: normal.id, cantidad: 1 }],   // queda en 2, minimo 4
    });
    assert.ok(cuerpo.alertasInventario.length > 0);
  });

  it('rechaza la venta de un medicamento con receta si no se envia la receta', async () => {
    const { estado, cuerpo } = await pedir('POST', '/api/ventas', {
      cliente: 'Juan Perez',
      items: [{ productoId: conReceta.id, cantidad: 1 }],
    });

    assert.equal(estado, 409);
    assert.match(cuerpo.detalles[0], /receta medica/);
  });

  it('acepta la venta del mismo medicamento si se envia la receta', async () => {
    const { estado } = await pedir('POST', '/api/ventas', {
      cliente: 'Juan Perez',
      recetaMedica: 'RM-4521',
      items: [{ productoId: conReceta.id, cantidad: 1 }],
    });
    assert.equal(estado, 201);
  });

  it('rechaza la venta de un producto vencido', async () => {
    const { estado, cuerpo } = await pedir('POST', '/api/ventas', {
      cliente: 'Ana Gomez',
      items: [{ productoId: vencido.id, cantidad: 1 }],
    });

    assert.equal(estado, 409);
    assert.match(cuerpo.detalles[0], /vencido/);
  });

  it('rechaza la venta cuando no hay stock suficiente', async () => {
    const { estado, cuerpo } = await pedir('POST', '/api/ventas', {
      cliente: 'Ana Gomez',
      items: [{ productoId: conReceta.id, cantidad: 500 }],
      recetaMedica: 'RM-1',
    });

    assert.equal(estado, 409);
    assert.match(cuerpo.detalles[0], /Stock insuficiente/);
  });

  it('TODO O NADA: si un item falla, NINGUN producto pierde stock', async () => {
    const { cuerpo: antes } = await pedir('GET', `/api/productos/${conReceta.id}`);

    // El primer item es valido, el segundo esta vencido -> la venta debe fallar
    const { estado, cuerpo } = await pedir('POST', '/api/ventas', {
      cliente: 'Pedro Diaz',
      recetaMedica: 'RM-7788',
      items: [
        { productoId: conReceta.id, cantidad: 1 },
        { productoId: vencido.id, cantidad: 1 },
      ],
    });

    assert.equal(estado, 409);
    assert.equal(cuerpo.detalles.length, 1);

    const { cuerpo: despues } = await pedir('GET', `/api/productos/${conReceta.id}`);
    assert.equal(despues.datos.stock, antes.datos.stock, 'el stock no debio cambiar');
  });

  it('reporta todos los problemas juntos, no solo el primero', async () => {
    const { cuerpo } = await pedir('POST', '/api/ventas', {
      cliente: 'Pedro Diaz',
      items: [
        { productoId: vencido.id, cantidad: 1 },
        { productoId: 9999, cantidad: 1 },
      ],
    });
    assert.equal(cuerpo.detalles.length, 2);
  });

  it('rechaza una venta sin items', async () => {
    const { estado } = await pedir('POST', '/api/ventas', { cliente: 'Luis Mo', items: [] });
    assert.equal(estado, 400);
  });

  it('el resumen refleja las ventas registradas', async () => {
    const { estado, cuerpo } = await pedir('GET', '/api/ventas/resumen');

    assert.equal(estado, 200);
    assert.ok(cuerpo.datos.totalVentas >= 3);
    assert.ok(cuerpo.datos.ingresoTotal > 0);
    assert.ok(cuerpo.datos.productosMasVendidos.length > 0);
  });

  it('/resumen no se confunde con /:id (orden de las rutas)', async () => {
    const { cuerpo } = await pedir('GET', '/api/ventas/resumen');
    assert.ok(cuerpo.datos.totalVentas !== undefined, 'devolvio una venta en vez del reporte');
  });

  it('el historial devuelve las ventas de la mas reciente a la mas antigua', async () => {
    const { cuerpo } = await pedir('GET', '/api/ventas');
    const fechas = cuerpo.datos.map((v) => v.fecha);
    assert.deepEqual(fechas, [...fechas].sort().reverse());
  });
});
