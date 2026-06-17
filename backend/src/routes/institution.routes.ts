import { Router } from 'express';
import {
  listInstitutions,
  getInstitution,
  createInstitution,
  updateInstitution,
  deleteInstitution
} from '../controllers/institution.controller';
import adminInstitutionsRoutes from './admin-institutions.routes';

const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const router = Router();

router.use(authenticate, requireAdmin);

// Menu & reports — must be registered before /:id
router.use(adminInstitutionsRoutes);

router.get('/', listInstitutions);
router.get('/:id', getInstitution);
router.post('/', createInstitution);
router.put('/:id', updateInstitution);
router.delete('/:id', deleteInstitution);

export default router;
