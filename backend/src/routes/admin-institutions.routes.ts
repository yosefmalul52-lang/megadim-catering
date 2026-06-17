import { Router } from 'express';
import {
  getInstitutionWeekMenu,
  upsertInstitutionWeekMenu,
  deleteInstitutionWeekMenu,
  getInstitutionWeekReports,
  getAdminInstitutionOrder,
  adminUpdateInstitutionOrder,
  adminDeleteInstitutionOrder
} from '../controllers/institution-admin.controller';

const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/menu', getInstitutionWeekMenu);
router.post('/menu', upsertInstitutionWeekMenu);
router.delete('/menu', deleteInstitutionWeekMenu);
router.get('/reports', getInstitutionWeekReports);
router.get('/order/:institutionId', getAdminInstitutionOrder);
router.put('/order/:institutionId', adminUpdateInstitutionOrder);
router.delete('/order/:institutionId', adminDeleteInstitutionOrder);

export default router;
