/**
 * CAPA DE DATOS (el "motor" de la base de datos)
 * ---------------------------------------------
 * En lugar de MySQL o Mongo, aqui los datos viven en un archivo JSON.
 * Node.js se encarga del acceso a disco con el modulo 'fs/promises',
 * que es ASINCRONO: no bloquea el hilo principal mientras lee o escribe.
 *
 * Estrategia:
 *   1. Al arrancar el servidor se carga el JSON una sola vez a memoria (cache).
 *   2. Las lecturas se responden desde memoria -> muy rapidas.
 *   3. Cada cambio se persiste al archivo en segundo plano (escritura en cola).
 */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Por defecto se usa el archivo real. La variable de entorno FARMACIA_DB
// permite apuntar a otro archivo: asi las pruebas trabajan sobre una copia
// y nunca modifican los datos de la farmacia.
const ARCHIVO = process.env.FARMACIA_DB
  ? path.resolve(process.env.FARMACIA_DB)
  : path.join(__dirname, '..', 'data', 'farmacia.json');

// Cache en memoria de todo el "esquema" de la farmacia
let datos = { categorias: [], productos: [], ventas: [] };

// Cola de escritura: evita que dos peticiones simultaneas corrompan el archivo
let escrituraEnCurso = Promise.resolve();

/** Carga el archivo JSON a memoria. Se llama una vez al iniciar el servidor. */
export async function conectar() {
  const contenido = await readFile(ARCHIVO, 'utf8');
  datos = JSON.parse(contenido);
  if (process.env.NODE_ENV === 'test') return;
  console.log(
    `[db] Datos cargados: ${datos.categorias.length} categorias, ` +
      `${datos.productos.length} productos, ${datos.ventas.length} ventas`
  );
}

/** Devuelve la coleccion pedida ('categorias' | 'productos' | 'ventas'). */
export function tabla(nombre) {
  return datos[nombre];
}

/** Genera el siguiente id autoincremental de una coleccion. */
export function siguienteId(nombre) {
  const coleccion = datos[nombre];
  return coleccion.length === 0 ? 1 : Math.max(...coleccion.map((r) => r.id)) + 1;
}

/**
 * Persiste la memoria al archivo JSON.
 * Escribe primero un archivo temporal y luego lo renombra: si el proceso
 * muere a mitad de la escritura, el JSON original no queda a medias.
 */
export function guardar() {
  escrituraEnCurso = escrituraEnCurso.then(async () => {
    const temporal = `${ARCHIVO}.tmp`;
    await writeFile(temporal, JSON.stringify(datos, null, 2), 'utf8');
    await rename(temporal, ARCHIVO);
  });
  return escrituraEnCurso;
}
