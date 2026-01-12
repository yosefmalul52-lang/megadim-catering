"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const employee_controller_1 = require("../controllers/employee.controller");
const router = express_1.default.Router();
const employeeController = new employee_controller_1.EmployeeController();
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
exports.default = router;
