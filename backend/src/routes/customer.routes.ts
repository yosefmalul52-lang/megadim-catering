import express from 'express';
import {
  auditCustomersSync,
  deleteCustomer,
  getCustomers,
  migrateLegacyData,
  updateCustomerCrm
} from '../controllers/customer.controller';

const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

router.get('/', authenticate, requireAdmin, getCustomers);
router.post('/migrate', authenticate, requireAdmin, migrateLegacyData);
router.post('/audit', authenticate, requireAdmin, auditCustomersSync);
router.put('/:id/crm', authenticate, requireAdmin, updateCustomerCrm);
router.delete('/:id', authenticate, requireAdmin, deleteCustomer);

export default router;
