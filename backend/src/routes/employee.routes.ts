import express from 'express';
import { EmployeeController } from '../controllers/employee.controller';

const router = express.Router();
const employeeController = new EmployeeController();

// Import authenticate and authorize middleware
const { authenticate, authorize } = require('../middleware/auth');

// Admin-only: list and manage employees
router.get('/', authenticate, authorize('admin'), employeeController.getEmployeesWithStatus);
router.get('/:id', authenticate, authorize('admin'), employeeController.getEmployeeById);
router.post('/', authenticate, authorize('admin'), employeeController.createEmployee);
router.put('/:id', authenticate, authorize('admin'), employeeController.updateEmployee);
router.delete('/:id', authenticate, authorize('admin'), employeeController.deleteEmployee);

// Employee self-service (authenticate only; controller checks employee role)
router.get('/my/stats', authenticate, employeeController.getMyStats);

export default router;

