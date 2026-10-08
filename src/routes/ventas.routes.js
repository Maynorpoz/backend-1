import { Router } from 'express';
import * as ventas from '../controllers/ventas.controller.js';

const router = Router();

// OJO: /resumen debe declararse ANTES que /:id, de lo contrario Express
// interpretaria la palabra "resumen" como si fuera un id.
router.get('/resumen', ventas.resumen);
router.get('/', ventas.listar);
router.get('/:id', ventas.obtener);
router.post('/', ventas.crear);

export default router;
