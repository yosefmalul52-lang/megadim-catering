"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeController = void 0;
const employee_service_1 = require("../services/employee.service");
const errorHandler_1 = require("../middleware/errorHandler");
class EmployeeController {
    constructor() {
        // Get all employees with their clock-in status
        this.getEmployeesWithStatus = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const employees = yield this.employeeService.getEmployeesWithStatus();
                res.status(200).json({
                    success: true,
                    data: employees,
                    count: employees.length,
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                console.error('❌ EmployeeController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to get employees',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Create a new employee
        this.createEmployee = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const employeeData = req.body;
                // Validation
                if (!employeeData.firstName || !employeeData.lastName || !employeeData.role || !employeeData.phone) {
                    return res.status(400).json({
                        success: false,
                        message: 'Missing required fields: firstName, lastName, role, phone'
                    });
                }
                // Set default PIN if not provided
                if (!employeeData.pinCode) {
                    employeeData.pinCode = '1234';
                }
                const employee = yield this.employeeService.createEmployee(employeeData);
                res.status(201).json({
                    success: true,
                    data: employee,
                    message: 'Employee created successfully'
                });
            }
            catch (error) {
                console.error('❌ EmployeeController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to create employee',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Update an employee
        this.updateEmployee = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const updateData = req.body;
                const employee = yield this.employeeService.updateEmployee(id, updateData);
                res.status(200).json({
                    success: true,
                    data: employee,
                    message: 'Employee updated successfully'
                });
            }
            catch (error) {
                console.error('❌ EmployeeController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to update employee',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Delete an employee (soft delete)
        this.deleteEmployee = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                yield this.employeeService.deleteEmployee(id);
                res.status(200).json({
                    success: true,
                    message: 'Employee deleted successfully'
                });
            }
            catch (error) {
                console.error('❌ EmployeeController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to delete employee',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Get employee by ID
        this.getEmployeeById = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const employee = yield this.employeeService.getEmployeeById(id);
                res.status(200).json({
                    success: true,
                    data: employee
                });
            }
            catch (error) {
                console.error('❌ EmployeeController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to get employee',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Get my stats (for employee self-service)
        this.getMyStats = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const employeeId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const month = req.query.month;
                if (!employeeId) {
                    return res.status(401).json({
                        success: false,
                        message: 'Employee ID not found in token'
                    });
                }
                const stats = yield this.employeeService.getEmployeeStats(employeeId, month);
                res.status(200).json({
                    success: true,
                    data: stats
                });
            }
            catch (error) {
                console.error('❌ EmployeeController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to get employee stats',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        this.employeeService = new employee_service_1.EmployeeService();
        // Initialize dummy data on startup
        this.employeeService.initializeDummyData().catch(console.error);
    }
}
exports.EmployeeController = EmployeeController;
