"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const attendance_controller_1 = require("../controllers/attendance.controller");
const router = express_1.default.Router();
const attendanceController = new attendance_controller_1.AttendanceController();
const { authenticate } = require('../middleware/auth');
router.post('/clock', attendanceController.clockByPin);
router.post('/clock-in', authenticate, attendanceController.clockIn);
router.post('/clock-out', authenticate, attendanceController.clockOut);
router.get('/history/:employeeId', authenticate, attendanceController.getEmployeeHistory);
router.get('/active', authenticate, attendanceController.getActiveShifts);
router.get('/report', authenticate, attendanceController.getPayrollReport);
exports.default = router;
//# sourceMappingURL=attendance.routes.js.map