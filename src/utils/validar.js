/**
 * Validaciones minimas hechas a mano (sin librerias externas) para que se
 * vea claro que la API nunca confia en lo que manda el cliente.
 * Cada funcion devuelve un arreglo de errores; vacio significa "todo bien".
 */

export function validarCategoria(cuerpo) {
  const errores = [];
  if (!cuerpo.nombre || String(cuerpo.nombre).trim().length < 3) {
    errores.push('nombre: requerido, minimo 3 caracteres');
  }
  return errores;
}

export function validarProducto(cuerpo, { parcial = false } = {}) {
  const errores = [];
  const requerido = (campo) => !parcial || cuerpo[campo] !== undefined;

  if (requerido('codigo') && (!cuerpo.codigo || !/^[A-Z]{3}-\d{3}$/.test(cuerpo.codigo))) {
    errores.push('codigo: requerido, formato ABC-123');
  }
  if (requerido('nombre') && (!cuerpo.nombre || String(cuerpo.nombre).trim().length < 3)) {
    errores.push('nombre: requerido, minimo 3 caracteres');
  }
  if (requerido('categoriaId') && !Number.isInteger(cuerpo.categoriaId)) {
    errores.push('categoriaId: requerido, numero entero');
  }
  if (requerido('precio') && (typeof cuerpo.precio !== 'number' || cuerpo.precio <= 0)) {
    errores.push('precio: requerido, numero mayor que 0');
  }
  if (requerido('stock') && (!Number.isInteger(cuerpo.stock) || cuerpo.stock < 0)) {
    errores.push('stock: requerido, entero mayor o igual a 0');
  }
  if (cuerpo.stockMinimo !== undefined && (!Number.isInteger(cuerpo.stockMinimo) || cuerpo.stockMinimo < 0)) {
    errores.push('stockMinimo: entero mayor o igual a 0');
  }
  if (requerido('fechaVencimiento') && !esFechaValida(cuerpo.fechaVencimiento)) {
    errores.push('fechaVencimiento: requerida, formato AAAA-MM-DD');
  }
  return errores;
}

export function validarVenta(cuerpo) {
  const errores = [];
  if (!cuerpo.cliente || String(cuerpo.cliente).trim().length < 3) {
    errores.push('cliente: requerido, minimo 3 caracteres');
  }
  if (!Array.isArray(cuerpo.items) || cuerpo.items.length === 0) {
    errores.push('items: requerido, al menos un producto');
    return errores;
  }
  cuerpo.items.forEach((item, i) => {
    if (!Number.isInteger(item.productoId)) {
      errores.push(`items[${i}].productoId: entero requerido`);
    }
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      errores.push(`items[${i}].cantidad: entero mayor que 0`);
    }
  });
  return errores;
}

export function esFechaValida(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor));
}
