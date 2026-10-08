/**
 * CONTROLADORES DE CATEGORIAS
 * Un controlador recibe la peticion, aplica la regla de negocio y responde.
 * Son funciones 'async': Express 5 captura automaticamente cualquier error
 * lanzado dentro de ellas y lo envia al manejador central de errores.
 */
import { tabla, siguienteId, guardar } from '../store/db.js';
import { ErrorApi, noEncontrado, datosInvalidos } from '../utils/errores.js';
import { validarCategoria } from '../utils/validar.js';

export async function listar(req, res) {
  const categorias = tabla('categorias');
  const productos = tabla('productos');

  // A cada categoria le agregamos cuantos productos tiene (como un JOIN)
  const resultado = categorias.map((c) => ({
    ...c,
    totalProductos: productos.filter((p) => p.categoriaId === c.id).length,
  }));

  res.json({ ok: true, total: resultado.length, datos: resultado });
}

export async function obtener(req, res) {
  const id = Number(req.params.id);
  const categoria = tabla('categorias').find((c) => c.id === id);
  if (!categoria) throw noEncontrado('Categoria', id);

  const productos = tabla('productos').filter((p) => p.categoriaId === id);
  res.json({ ok: true, datos: { ...categoria, productos } });
}

export async function crear(req, res) {
  const errores = validarCategoria(req.body);
  if (errores.length) throw datosInvalidos(errores);

  const repetida = tabla('categorias').some(
    (c) => c.nombre.toLowerCase() === req.body.nombre.trim().toLowerCase()
  );
  if (repetida) throw new ErrorApi(409, 'Ya existe una categoria con ese nombre');

  const categoria = {
    id: siguienteId('categorias'),
    nombre: req.body.nombre.trim(),
    descripcion: req.body.descripcion?.trim() ?? '',
  };

  tabla('categorias').push(categoria);
  await guardar();

  res.status(201).json({ ok: true, mensaje: 'Categoria creada', datos: categoria });
}

export async function actualizar(req, res) {
  const id = Number(req.params.id);
  const categoria = tabla('categorias').find((c) => c.id === id);
  if (!categoria) throw noEncontrado('Categoria', id);

  const errores = validarCategoria({ ...categoria, ...req.body });
  if (errores.length) throw datosInvalidos(errores);

  Object.assign(categoria, {
    nombre: req.body.nombre?.trim() ?? categoria.nombre,
    descripcion: req.body.descripcion?.trim() ?? categoria.descripcion,
  });
  await guardar();

  res.json({ ok: true, mensaje: 'Categoria actualizada', datos: categoria });
}

export async function eliminar(req, res) {
  const id = Number(req.params.id);
  const categorias = tabla('categorias');
  const indice = categorias.findIndex((c) => c.id === id);
  if (indice === -1) throw noEncontrado('Categoria', id);

  // Regla de integridad: no se borra una categoria que aun tiene productos
  const enUso = tabla('productos').some((p) => p.categoriaId === id);
  if (enUso) {
    throw new ErrorApi(409, 'No se puede eliminar: la categoria tiene productos asociados');
  }

  const [eliminada] = categorias.splice(indice, 1);
  await guardar();

  res.json({ ok: true, mensaje: 'Categoria eliminada', datos: eliminada });
}
