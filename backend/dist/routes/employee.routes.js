"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const employee_controller_1 = require("../controllers/employee.controller");
const router = express_1.default.Router();
const employeeController = new employee_controller_1.EmployeeController();
const { authenticate } = require('../middleware/auth');
router.get('/', authenticate, employeeController.getEmployeesWithStatus);
router.get('/:id', authenticate, employeeController.getEmployeeById);
router.post('/', authenticate, employeeController.createEmployee);
router.put('/:id', authenticate, employeeController.updateEmployee);
router.delete('/:id', authenticate, employeeController.deleteEmployee);
router.get('/my/stats', authenticate, employeeController.getMyStats);
exports.default = router;
//# sourceMappingURL=employee.routes.js.map