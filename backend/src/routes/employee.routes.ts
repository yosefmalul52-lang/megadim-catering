import express from 'express';
import { EmployeeController } from '../controllers/employee.controller';

const router = express.Router();
const employeeController = new EmployeeController();

// Import authenticate middleware
const { authenticate } = require('../middleware/auth');

// Get all employees with status (Protected - Admin only)
router.get('/', authenticate, employeeController.getEmployeesWithStatus);

// Get employee by ID
router.get('/:id', authenticate, employeeController.getEmployeeById);

// Create new employee
router.post('/', authenticate, employeeController.createEmployee);

// Update employee
router.put('/:id', authenticate, employeeController.updateEmployee);

// Delete employee (soft delete)
router.delete('/:id', authenticate, employeeController.deleteEmployee);

// Get my stats (employee self-service - requires employee auth)
router.get('/my/stats', authenticate, employeeController.getMyStats);

export default router;

