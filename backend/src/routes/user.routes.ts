import express from 'express';
import {
  getUsers,
  updateUserCrm,
  updateUserRole,
  resolveUserByUsername,
  getDriverUsers
} from '../controllers/user.controller';
import { requireAdmin } from '../config/role-access';

const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.get('/resolve', authenticate, requireAdmin, resolveUserByUsername);
router.get('/drivers', authenticate, requireAdmin, getDriverUsers);
router.patch('/:id/role', authenticate, requireAdmin, updateUserRole);
router.get('/', authenticate, requireAdmin, getUsers);
router.put('/:id/crm', authenticate, requireAdmin, updateUserCrm);

export default router;
