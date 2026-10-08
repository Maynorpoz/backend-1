/**
 * CONTROLADORES DE VENTAS (la caja de la farmacia)
 * Aqui esta la logica mas interesante: una venta toca varios productos,
 * valida reglas y descuenta inventario. Se valida TODO antes de modificar
 * nada, imitando el "todo o nada" de una transaccion de base de datos.
 */
import { tabla, siguienteId, guardar } from '../store/db.js';
import { ErrorApi, noEncontrado, datosInvalidos } from '../utils/errores.js';
import { validarVenta } from '../utils/validar.js';

const redondear = (n) => Math.round(n * 100) / 100;

export async function listar(req, res) {
  const ventas = [...tabla('ventas')].sort((a, b) => b.fecha.localeCompare(a.fecha));
  res.json({ ok: true, total: ventas.length, datos: ventas });
}

export async function obtener(req, res) {
  const id = Number(req.params.id);
  const venta = tabla('ventas').find((v) => v.id === id);
  if (!venta) throw noEncontrado('Venta', id);

  res.json({ ok: true, datos: venta });
}

/**
 * POST /api/ventas
 * {
 *   "cliente": "Maria Lopez",
 *   "recetaMedica": "RM-4521",      // opcional, obligatorio si algun producto la exige
 *   "items": [{ "productoId": 1, "cantidad": 2 }]
 * }
 */
export async function crear(req, res) {
  const errores = validarVenta(req.body);
  if (errores.length) throw datosInvalidos(errores);

  const hoy = new Date();
  const problemas = [];
  const detalle = [];

  // --- PASO 1: validar cada item sin tocar el inventario ---
  for (const item of req.body.items) {
    const producto = tabla('productos').find((p) => p.id === item.productoId);

    if (!producto) {
      problemas.push(`El producto ${item.productoId} no existe`);
      continue;
    }
    if (new Date(producto.fechaVencimiento) < hoy) {
      problemas.push(`${producto.nombre} esta vencido (lote ${producto.lote}), no se puede vender`);
      continue;
    }
    if (producto.stock < item.cantidad) {
      problemas.push(`Stock insuficiente de ${producto.nombre}: hay ${producto.stock}, se piden ${item.cantidad}`);
      continue;
    }
    if (producto.requiereReceta && !req.body.recetaMedica) {
      problemas.push(`${producto.nombre} requiere receta medica, envie el campo "recetaMedica"`);
      continue;
    }

    detalle.push({
      productoId: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      cantidad: item.cantidad,
      precioUnitario: producto.precio,
      subtotal: redondear(producto.precio * item.cantidad),
    });
  }

  if (problemas.length) throw new ErrorApi(409, 'La venta no se puede procesar', problemas);

  // --- PASO 2: aplicar los cambios (ya sabemos que todo es valido) ---
  for (const linea of detalle) {
    const producto = tabla('productos').find((p) => p.id === linea.productoId);
    producto.stock -= linea.cantidad;
  }

  const subtotal = redondear(detalle.reduce((acc, l) => acc + l.subtotal, 0));
  const impuesto = redondear(subtotal * 0.12); // IVA 12%

  const venta = {
    id: siguienteId('ventas'),
    fecha: new Date().toISOString(),
    cliente: req.body.cliente.trim(),
    recetaMedica: req.body.recetaMedica ?? null,
    items: detalle,
    subtotal,
    impuesto,
    total: redondear(subtotal + impuesto),
  };

  tabla('ventas').push(venta);
  await guardar();

  // Avisamos si alguna venta dejo producto bajo el minimo
  const alertas = detalle
    .map((l) => tabla('productos').find((p) => p.id === l.productoId))
    .filter((p) => p.stock <= p.stockMinimo)
    .map((p) => `${p.nombre} quedo en ${p.stock} unidades (minimo ${p.stockMinimo})`);

  res.status(201).json({
    ok: true,
    mensaje: 'Venta registrada',
    datos: venta,
    ...(alertas.length ? { alertasInventario: alertas } : {}),
  });
}

/** GET /api/ventas/resumen -> reporte simple para el dueno de la farmacia */
export async function resumen(req, res) {
  const ventas = tabla('ventas');

  const unidadesPorProducto = new Map();
  for (const venta of ventas) {
    for (const linea of venta.items) {
      const acumulado = unidadesPorProducto.get(linea.nombre) ?? 0;
      unidadesPorProducto.set(linea.nombre, acumulado + linea.cantidad);
    }
  }

  const masVendidos = [...unidadesPorProducto.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([nombre, unidades]) => ({ nombre, unidades }));

  res.json({
    ok: true,
    datos: {
      totalVentas: ventas.length,
      ingresoTotal: redondear(ventas.reduce((acc, v) => acc + v.total, 0)),
      productosMasVendidos: masVendidos,
      productosConStockBajo: tabla('productos')
        .filter((p) => p.stock <= p.stockMinimo)
        .map((p) => ({ nombre: p.nombre, stock: p.stock, stockMinimo: p.stockMinimo })),
    },
  });
}
