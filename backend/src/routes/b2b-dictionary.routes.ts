import { Router } from 'express';
import {
  listB2BMenuItems,
  createB2BMenuItem,
  updateB2BMenuItem,
  deleteB2BMenuItem
} from '../controllers/b2b-dictionary.controller';

const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', listB2BMenuItems);
router.post('/', createB2BMenuItem);
router.put('/:id', updateB2BMenuItem);
router.delete('/:id', deleteB2BMenuItem);

export default router;
