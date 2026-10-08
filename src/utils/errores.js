/**
 * Error de negocio con codigo HTTP.
 * Permite lanzar "throw new ErrorApi(404, 'Producto no encontrado')" desde
 * cualquier controlador y que el middleware de errores lo traduzca a JSON.
 */
export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles = undefined) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

export const noEncontrado = (recurso, id) =>
  new ErrorApi(404, `${recurso} con id ${id} no existe`);

export const datosInvalidos = (detalles) =>
  new ErrorApi(400, 'Datos invalidos', detalles);
