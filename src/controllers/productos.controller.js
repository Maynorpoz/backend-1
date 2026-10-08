/**
 * CONTROLADORES DE PRODUCTOS (el inventario de la farmacia)
 * Incluye las reglas propias del giro: stock minimo, lote y vencimiento.
 */
import { tabla, siguienteId, guardar } from '../store/db.js';
import { ErrorApi, noEncontrado, datosInvalidos } from '../utils/errores.js';
import { validarProducto } from '../utils/validar.js';

/** Agrega campos calculados que no se guardan en el JSON. */
function enriquecer(producto) {
  const categoria = tabla('categorias').find((c) => c.id === producto.categoriaId);
  const diasParaVencer = Math.ceil(
    (new Date(producto.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return {
    ...producto,
    categoria: categoria?.nombre ?? 'Sin categoria',
    diasParaVencer,
    vencido: diasParaVencer < 0,
    stockBajo: producto.stock <= producto.stockMinimo,
  };
}

/**
 * GET /api/productos
 * Soporta filtros por query string: ?buscar=&categoriaId=&stockBajo=true&porVencer=90
 */
export async function listar(req, res) {
  const { buscar, categoriaId, stockBajo, porVencer } = req.query;
  let resultado = tabla('productos').map(enriquecer);

  if (buscar) {
    const texto = String(buscar).toLowerCase();
    resultado = resultado.filter(
      (p) => p.nombre.toLowerCase().includes(texto) || p.codigo.toLowerCase().includes(texto)
    );
  }
  if (categoriaId) {
    resultado = resultado.filter((p) => p.categoriaId === Number(categoriaId));
  }
  if (stockBajo === 'true') {
    resultado = resultado.filter((p) => p.stockBajo);
  }
  if (porVencer) {
    const dias = Number(porVencer);
    resultado = resultado.filter((p) => p.diasParaVencer <= dias);
  }

  res.json({ ok: true, total: resultado.length, datos: resultado });
}

export async function obtener(req, res) {
  const id = Number(req.params.id);
  const producto = tabla('productos').find((p) => p.id === id);
  if (!producto) throw noEncontrado('Producto', id);

  res.json({ ok: true, datos: enriquecer(producto) });
}

export async function crear(req, res) {
  const errores = validarProducto(req.body);
  if (errores.length) throw datosInvalidos(errores);

  const existeCategoria = tabla('categorias').some((c) => c.id === req.body.categoriaId);
  if (!existeCategoria) throw new ErrorApi(422, 'La categoria indicada no existe');

  const codigoRepetido = tabla('productos').some((p) => p.codigo === req.body.codigo);
  if (codigoRepetido) throw new ErrorApi(409, 'Ya existe un producto con ese codigo');

  const producto = {
    id: siguienteId('productos'),
    codigo: req.body.codigo,
    nombre: req.body.nombre.trim(),
    categoriaId: req.body.categoriaId,
    precio: req.body.precio,
    stock: req.body.stock,
    stockMinimo: req.body.stockMinimo ?? 10,
    lote: req.body.lote ?? 'SIN-LOTE',
    fechaVencimiento: req.body.fechaVencimiento,
    requiereReceta: Boolean(req.body.requiereReceta),
  };

  tabla('productos').push(producto);
  await guardar();

  res.status(201).json({ ok: true, mensaje: 'Producto registrado', datos: enriquecer(producto) });
}

export async function actualizar(req, res) {
  const id = Number(req.params.id);
  const producto = tabla('productos').find((p) => p.id === id);
  if (!producto) throw noEncontrado('Producto', id);

  const errores = validarProducto(req.body, { parcial: true });
  if (errores.length) throw datosInvalidos(errores);

  if (req.body.categoriaId !== undefined) {
    const existe = tabla('categorias').some((c) => c.id === req.body.categoriaId);
    if (!existe) throw new ErrorApi(422, 'La categoria indicada no existe');
  }

  // Solo se sobrescriben los campos enviados; el id nunca se toca
  const { id: _ignorado, ...cambios } = req.body;
  Object.assign(producto, cambios);
  await guardar();

  res.json({ ok: true, mensaje: 'Producto actualizado', datos: enriquecer(producto) });
}

/**
 * PATCH /api/productos/:id/stock  { "cantidad": 50 }
 * Entrada de mercaderia: suma unidades al inventario.
 */
export async function reabastecer(req, res) {
  const id = Number(req.params.id);
  const producto = tabla('productos').find((p) => p.id === id);
  if (!producto) throw noEncontrado('Producto', id);

  const cantidad = req.body.cantidad;
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw datosInvalidos(['cantidad: entero mayor que 0']);
  }

  producto.stock += cantidad;
  await guardar();

  res.json({
    ok: true,
    mensaje: `Se agregaron ${cantidad} unidades`,
    datos: enriquecer(producto),
  });
}

export async function eliminar(req, res) {
  const id = Number(req.params.id);
  const productos = tabla('productos');
  const indice = productos.findIndex((p) => p.id === id);
  if (indice === -1) throw noEncontrado('Producto', id);

  const [eliminado] = productos.splice(indice, 1);
  await guardar();

  res.json({ ok: true, mensaje: 'Producto eliminado', datos: eliminado });
}
