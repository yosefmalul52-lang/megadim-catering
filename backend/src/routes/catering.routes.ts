import { Router } from 'express';
import { CateringController } from '../controllers/catering.controller';

const router = Router();
const cateringController = new CateringController();

router.post('/', cateringController.submitCateringOrder);
router.post('/events', cateringController.submitEventCateringOrder);

export default router;
