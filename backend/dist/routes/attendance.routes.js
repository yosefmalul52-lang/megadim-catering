"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const attendance_controller_1 = require("../controllers/attendance.controller");
const router = express_1.default.Router();
const attendanceController = new attendance_controller_1.AttendanceController();
// Import authenticate middleware
const { authenticate } = require('../middleware/auth');
// Clock by PIN (for kiosk - public access)
router.post('/clock', attendanceController.clockByPin);
// Clock in (admin)
router.post('/clock-in', authenticate, attendanceController.clockIn);
// Clock out
router.post('/clock-out', authenticate, attendanceController.clockOut);
// Get employee attendance history
router.get('/history/:employeeId', authenticate, attendanceController.getEmployeeHistory);
// Get all active shifts
router.get('/active', authenticate, attendanceController.getActiveShifts);
// Get payroll report
router.get('/report', authenticate, attendanceController.getPayrollReport);
exports.default = router;
