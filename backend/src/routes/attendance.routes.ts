import express from 'express';
import { AttendanceController } from '../controllers/attendance.controller';

const router = express.Router();
const attendanceController = new AttendanceController();

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

export default router;

