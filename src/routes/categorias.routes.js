/**
 * RUTAS DE CATEGORIAS
 * El Router de Express agrupa endpoints relacionados y se monta luego
 * bajo un prefijo (/api/categorias) dentro de app.js.
 */
import { Router } from 'express';
import * as categorias from '../controllers/categorias.controller.js';

const router = Router();

router.get('/', categorias.listar);
router.get('/:id', categorias.obtener);
router.post('/', categorias.crear);
router.put('/:id', categorias.actualizar);
router.delete('/:id', categorias.eliminar);

export default router;
