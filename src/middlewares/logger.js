/**
 * MIDDLEWARE: funcion que se ejecuta ENTRE la peticion y la respuesta.
 * Recibe (req, res, next) y debe llamar a next() para ceder el turno
 * al siguiente eslabon de la cadena. Aqui solo medimos cuanto tardo
 * cada peticion y la imprimimos en consola.
 */
export function logger(req, res, next) {
  const inicio = Date.now();

  // 'finish' es un evento del objeto respuesta: Node es orientado a eventos,
  // asi que nos suscribimos y reaccionamos cuando la respuesta ya se envio.
  res.on('finish', () => {
    const ms = Date.now() - inicio;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });

  next();
}
