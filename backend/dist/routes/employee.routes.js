"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const employee_controller_1 = require("../controllers/employee.controller");
const router = express_1.default.Router();
const employeeController = new employee_controller_1.EmployeeController();
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
exports.default = router;
