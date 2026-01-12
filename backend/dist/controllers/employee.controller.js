"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeController = void 0;
const employee_service_1 = require("../services/employee.service");
const errorHandler_1 = require("../middleware/errorHandler");
class EmployeeController {
    employeeService;
    constructor() {
        this.employeeService = new employee_service_1.EmployeeService();
        this.employeeService.initializeDummyData().catch(console.error);
    }
    getEmployeesWithStatus = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const employees = await this.employeeService.getEmployeesWithStatus();
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
    });
    createEmployee = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const employeeData = req.body;
            if (!employeeData.firstName || !employeeData.lastName || !employeeData.role || !employeeData.phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: firstName, lastName, role, phone'
                });
            }
            if (!employeeData.pinCode) {
                employeeData.pinCode = '1234';
            }
            const employee = await this.employeeService.createEmployee(employeeData);
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
    });
    updateEmployee = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const employee = await this.employeeService.updateEmployee(id, updateData);
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
    });
    deleteEmployee = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const { id } = req.params;
            await this.employeeService.deleteEmployee(id);
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
    });
    getEmployeeById = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const { id } = req.params;
            const employee = await this.employeeService.getEmployeeById(id);
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
    });
    getMyStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const employeeId = req.user?.id;
            const month = req.query.month;
            if (!employeeId) {
                return res.status(401).json({
                    success: false,
                    message: 'Employee ID not found in token'
                });
            }
            const stats = await this.employeeService.getEmployeeStats(employeeId, month);
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
    });
}
exports.EmployeeController = EmployeeController;
//# sourceMappingURL=employee.controller.js.map