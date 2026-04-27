import express from 'express';
import { EmployeeController } from '../controllers/employee.controller';

const router = express.Router();
const employeeController = new EmployeeController();

// Import authenticate and authorize middleware
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

// Admin-only: list and manage employees
router.get('/', authenticate, requireAdmin, employeeController.getEmployeesWithStatus);
router.get('/:id', authenticate, requireAdmin, employeeController.getEmployeeById);
router.post('/', authenticate, requireAdmin, employeeController.createEmployee);
router.put('/:id', authenticate, requireAdmin, employeeController.updateEmployee);
router.delete('/:id', authenticate, requireAdmin, employeeController.deleteEmployee);

// Employee self-service (authenticate only; controller checks employee role)
router.get('/my/stats', authenticate, employeeController.getMyStats);

export default router;

