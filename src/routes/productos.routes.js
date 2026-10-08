import { Router } from 'express';
import * as productos from '../controllers/productos.controller.js';

const router = Router();

router.get('/', productos.listar);
router.get('/:id', productos.obtener);
router.post('/', productos.crear);
router.put('/:id', productos.actualizar);
router.patch('/:id/stock', productos.reabastecer);
router.delete('/:id', productos.eliminar);

export default router;
