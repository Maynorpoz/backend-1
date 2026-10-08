/**
 * CONFIGURACION DE LA APLICACION EXPRESS
 * ---------------------------------------
 * Express funciona como una cadena de middlewares: la peticion entra por
 * arriba y va bajando hasta que alguien responde. El orden importa.
 */
import express from 'express';
import { logger } from './middlewares/logger.js';
import { rutaNoEncontrada, manejadorErrores } from './middlewares/errores.js';
import categoriasRouter from './routes/categorias.routes.js';
import productosRouter from './routes/productos.routes.js';
import ventasRouter from './routes/ventas.routes.js';

const app = express();

// 1) Middlewares globales
app.use(express.json());  // convierte el body JSON de la peticion en req.body
app.use(logger);          // nuestro registro de peticiones

// 2) Ruta de bienvenida: documenta la API
app.get('/', (req, res) => {
  res.json({
    ok: true,
    api: 'Farmacia API',
    version: '1.0.0',
    descripcion: 'Demo de backend con Node.js + Express y persistencia en archivo JSON',
    endpoints: {
      categorias: {
        'GET    /api/categorias': 'Lista las categorias con su total de productos',
        'GET    /api/categorias/:id': 'Detalle de una categoria con sus productos',
        'POST   /api/categorias': 'Crea una categoria',
        'PUT    /api/categorias/:id': 'Actualiza una categoria',
        'DELETE /api/categorias/:id': 'Elimina una categoria sin productos',
      },
      productos: {
        'GET    /api/productos': 'Lista el inventario (?buscar= ?categoriaId= ?stockBajo=true ?porVencer=90)',
        'GET    /api/productos/:id': 'Detalle de un producto',
        'POST   /api/productos': 'Registra un producto',
        'PUT    /api/productos/:id': 'Actualiza un producto',
        'PATCH  /api/productos/:id/stock': 'Reabastece inventario',
        'DELETE /api/productos/:id': 'Elimina un producto',
      },
      ventas: {
        'GET    /api/ventas': 'Historial de ventas',
        'GET    /api/ventas/resumen': 'Reporte de ingresos, mas vendidos y stock bajo',
        'GET    /api/ventas/:id': 'Detalle de una venta',
        'POST   /api/ventas': 'Registra una venta y descuenta stock',
      },
    },
  });
});

// 3) Routers de cada recurso montados bajo su prefijo
app.use('/api/categorias', categoriasRouter);
app.use('/api/productos', productosRouter);
app.use('/api/ventas', ventasRouter);

// 4) Cierre de la cadena: 404 primero, manejador de errores al final
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

export default app;
