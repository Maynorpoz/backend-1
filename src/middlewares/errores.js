import { ErrorApi } from '../utils/errores.js';

/** Se ejecuta cuando ninguna ruta coincidio con la URL pedida. */
export function rutaNoEncontrada(req, res) {
  res.status(404).json({
    ok: false,
    error: `La ruta ${req.method} ${req.originalUrl} no existe en esta API`,
  });
}

/**
 * MANEJADOR DE ERRORES CENTRAL.
 * Express lo reconoce porque recibe CUATRO parametros (err, req, res, next).
 * Cualquier throw dentro de un controlador termina aqui, asi que el cliente
 * siempre recibe un JSON consistente y nunca un stack trace.
 */
export function manejadorErrores(err, req, res, next) {
  let estado = 500;
  let mensaje = 'Error interno del servidor';

  if (err instanceof ErrorApi) {
    // Error de negocio lanzado por nosotros desde un controlador
    estado = err.estado;
    mensaje = err.message;
  } else if (err.type === 'entity.parse.failed') {
    // express.json() no pudo leer el cuerpo: el cliente mando un JSON mal escrito
    estado = 400;
    mensaje = 'El cuerpo de la peticion no es un JSON valido';
  } else if (err.status || err.statusCode) {
    // Otros errores de Express que ya traen su propio codigo HTTP
    estado = err.status || err.statusCode;
    mensaje = err.message;
  }

  // Solo registramos en consola lo que de verdad es una falla nuestra
  if (estado === 500) console.error('[error]', err);

  res.status(estado).json({
    ok: false,
    error: mensaje,
    ...(err.detalles ? { detalles: err.detalles } : {}),
  });
}
