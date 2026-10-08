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
  const estado = err instanceof ErrorApi ? err.estado : 500;

  if (estado === 500) console.error('[error]', err);

  res.status(estado).json({
    ok: false,
    error: estado === 500 ? 'Error interno del servidor' : err.message,
    ...(err.detalles ? { detalles: err.detalles } : {}),
  });
}
