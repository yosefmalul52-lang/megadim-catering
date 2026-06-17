import { Router } from 'express';
import { getPortalStatus, submitPortalOrder } from '../controllers/portal.controller';
import { requireInstitution } from '../config/role-access';

const { authenticate } = require('../middleware/auth');

const router = Router();

router.use(authenticate, requireInstitution);
router.get('/status', getPortalStatus);
router.post('/submit', submitPortalOrder);

export default router;
