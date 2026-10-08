/**
 * PUNTO DE ENTRADA
 * ----------------
 * Node.js NO necesita un servidor web externo (Apache, Tomcat, IIS):
 * el propio proceso levanta el servidor HTTP y atiende las peticiones
 * en un solo hilo gracias al event loop y a la E/S no bloqueante.
 *
 * Ejecutar con:  npm start     (o npm run dev para recarga automatica)
 */
import app from './src/app.js';
import { conectar } from './src/store/db.js';

const PUERTO = process.env.PORT || 3000;

async function iniciar() {
  // Primero cargamos los datos; si el JSON esta corrupto, no arrancamos
  await conectar();

  const servidor = app.listen(PUERTO, () => {
    console.log('='.repeat(55));
    console.log('  FARMACIA API - Node.js + Express');
    console.log(`  Escuchando en http://localhost:${PUERTO}`);
    console.log('  Ctrl + C para detener');
    console.log('='.repeat(55));
  });

  // Apagado ordenado: dejamos terminar las peticiones en curso
  process.on('SIGINT', () => {
    console.log('\n[servidor] Cerrando...');
    servidor.close(() => process.exit(0));
  });
}

iniciar().catch((error) => {
  console.error('[servidor] No se pudo iniciar:', error.message);
  process.exit(1);
});
