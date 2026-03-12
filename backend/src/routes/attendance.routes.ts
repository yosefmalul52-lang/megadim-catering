import express from 'express';
import { AttendanceController } from '../controllers/attendance.controller';

const router = express.Router();
const attendanceController = new AttendanceController();

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

export default router;

