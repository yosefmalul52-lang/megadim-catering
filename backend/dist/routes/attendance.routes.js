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
const { requireAdmin } = require('../config/role-access');
// Clock by PIN (for kiosk - public access)
router.post('/clock', attendanceController.clockByPin);
// Admin-only: clock in/out and reports
router.post('/clock-in', authenticate, requireAdmin, attendanceController.clockIn);
router.post('/clock-out', authenticate, requireAdmin, attendanceController.clockOut);
router.get('/history/:employeeId', authenticate, requireAdmin, attendanceController.getEmployeeHistory);
router.get('/active', authenticate, requireAdmin, attendanceController.getActiveShifts);
router.get('/report', authenticate, requireAdmin, attendanceController.getPayrollReport);
exports.default = router;
