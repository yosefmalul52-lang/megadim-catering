import express from 'express';
import { AttendanceController } from '../controllers/attendance.controller';

const router = express.Router();
const attendanceController = new AttendanceController();

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

export default router;

