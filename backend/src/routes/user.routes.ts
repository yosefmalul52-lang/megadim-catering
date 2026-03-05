import express from 'express';
import { getUsers, updateUserCrm } from '../controllers/user.controller';

const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin'), getUsers);
router.put('/:id/crm', authenticate, authorize('admin'), updateUserCrm);

export default router;
