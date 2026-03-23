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
const { authenticate, authorize } = require('../middleware/auth');
// Clock by PIN (for kiosk - public access)
router.post('/clock', attendanceController.clockByPin);
// Admin-only: clock in/out and reports
router.post('/clock-in', authenticate, authorize('admin'), attendanceController.clockIn);
router.post('/clock-out', authenticate, authorize('admin'), attendanceController.clockOut);
router.get('/history/:employeeId', authenticate, authorize('admin'), attendanceController.getEmployeeHistory);
router.get('/active', authenticate, authorize('admin'), attendanceController.getActiveShifts);
router.get('/report', authenticate, authorize('admin'), attendanceController.getPayrollReport);
exports.default = router;
