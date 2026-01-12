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
exports.AttendanceController = void 0;
const attendance_service_1 = require("../services/attendance.service");
const errorHandler_1 = require("../middleware/errorHandler");
class AttendanceController {
    constructor() {
        // Clock by PIN (for kiosk)
        this.clockByPin = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { pinCode } = req.body;
                if (!pinCode) {
                    return res.status(400).json({
                        success: false,
                        message: 'PIN code is required'
                    });
                }
                const result = yield this.attendanceService.clockByPin(pinCode);
                res.status(200).json({
                    success: true,
                    data: {
                        employee: {
                            _id: result.employee._id,
                            firstName: result.employee.firstName,
                            lastName: result.employee.lastName,
                            fullName: `${result.employee.firstName} ${result.employee.lastName}`,
                            role: result.employee.role
                        },
                        attendance: result.attendance,
                        action: result.action,
                        clockTime: result.action === 'in' ? result.attendance.clockIn : result.attendance.clockOut
                    },
                    message: result.action === 'in' ? 'Clocked in successfully' : 'Clocked out successfully'
                });
            }
            catch (error) {
                console.error('❌ AttendanceController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to clock',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Clock in
        this.clockIn = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { employeeId, pinCode } = req.body;
                if (!employeeId) {
                    return res.status(400).json({
                        success: false,
                        message: 'employeeId is required'
                    });
                }
                const attendance = yield this.attendanceService.clockIn(employeeId, pinCode);
                res.status(200).json({
                    success: true,
                    data: attendance,
                    message: 'Clocked in successfully'
                });
            }
            catch (error) {
                console.error('❌ AttendanceController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to clock in',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Clock out
        this.clockOut = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { employeeId } = req.body;
                if (!employeeId) {
                    return res.status(400).json({
                        success: false,
                        message: 'employeeId is required'
                    });
                }
                const attendance = yield this.attendanceService.clockOut(employeeId);
                res.status(200).json({
                    success: true,
                    data: attendance,
                    message: 'Clocked out successfully'
                });
            }
            catch (error) {
                console.error('❌ AttendanceController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to clock out',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Get employee attendance history
        this.getEmployeeHistory = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { employeeId } = req.params;
                const limit = parseInt(req.query.limit) || 30;
                const history = yield this.attendanceService.getEmployeeHistory(employeeId, limit);
                res.status(200).json({
                    success: true,
                    data: history,
                    count: history.length
                });
            }
            catch (error) {
                console.error('❌ AttendanceController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to get attendance history',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Get all active shifts
        this.getActiveShifts = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const activeShifts = yield this.attendanceService.getActiveShifts();
                res.status(200).json({
                    success: true,
                    data: activeShifts,
                    count: activeShifts.length
                });
            }
            catch (error) {
                console.error('❌ AttendanceController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to get active shifts',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Get payroll report
        this.getPayrollReport = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { month, employeeId } = req.query;
                if (!month || typeof month !== 'string') {
                    return res.status(400).json({
                        success: false,
                        message: 'Month parameter is required (format: YYYY-MM)'
                    });
                }
                const report = yield this.attendanceService.getPayrollReport(month, employeeId);
                res.status(200).json({
                    success: true,
                    data: report
                });
            }
            catch (error) {
                console.error('❌ AttendanceController: Error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to get payroll report',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        this.attendanceService = new attendance_service_1.AttendanceService();
    }
}
exports.AttendanceController = AttendanceController;
