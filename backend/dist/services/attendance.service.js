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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const Attendance_1 = __importDefault(require("../models/Attendance"));
const Employee_1 = __importDefault(require("../models/Employee"));
class AttendanceService {
    // Clock in/out by PIN code (for kiosk)
    clockByPin(pinCode) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find employee by PIN
                const employee = yield Employee_1.default.findOne({ pinCode: pinCode, isActive: true });
                if (!employee) {
                    throw new Error('Invalid PIN code');
                }
                // Check if employee is already clocked in
                const activeAttendance = yield Attendance_1.default.findOne({
                    employeeId: employee._id,
                    status: 'active'
                });
                if (activeAttendance) {
                    // Clock out
                    activeAttendance.clockOut = new Date();
                    activeAttendance.status = 'completed';
                    // Calculate total hours
                    const diffMs = activeAttendance.clockOut.getTime() - activeAttendance.clockIn.getTime();
                    activeAttendance.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
                    yield activeAttendance.save();
                    return {
                        attendance: activeAttendance,
                        employee: employee,
                        action: 'out'
                    };
                }
                else {
                    // Clock in
                    const attendance = new Attendance_1.default({
                        employeeId: employee._id,
                        clockIn: new Date(),
                        status: 'active'
                    });
                    yield attendance.save();
                    return {
                        attendance: attendance,
                        employee: employee,
                        action: 'in'
                    };
                }
            }
            catch (error) {
                console.error('❌ AttendanceService: Error clocking by PIN:', error);
                throw new Error(`Failed to clock: ${error.message}`);
            }
        });
    }
    // Clock in an employee
    clockIn(employeeId, pinCode) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Verify employee exists and is active
                const employee = yield Employee_1.default.findById(employeeId);
                if (!employee || !employee.isActive) {
                    throw new Error('Employee not found or inactive');
                }
                // Verify PIN if provided
                if (pinCode && employee.pinCode !== pinCode) {
                    throw new Error('Invalid PIN code');
                }
                // Check if employee is already clocked in
                const activeAttendance = yield Attendance_1.default.findOne({
                    employeeId: employeeId,
                    status: 'active'
                });
                if (activeAttendance) {
                    throw new Error('Employee is already clocked in');
                }
                // Create new attendance record
                const attendance = new Attendance_1.default({
                    employeeId: employeeId,
                    clockIn: new Date(),
                    status: 'active'
                });
                yield attendance.save();
                return attendance;
            }
            catch (error) {
                console.error('❌ AttendanceService: Error clocking in:', error);
                throw new Error(`Failed to clock in: ${error.message}`);
            }
        });
    }
    // Clock out an employee
    clockOut(employeeId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find active attendance
                const attendance = yield Attendance_1.default.findOne({
                    employeeId: employeeId,
                    status: 'active'
                });
                if (!attendance) {
                    throw new Error('No active shift found for this employee');
                }
                // Update attendance
                attendance.clockOut = new Date();
                attendance.status = 'completed';
                // Calculate total hours
                const diffMs = attendance.clockOut.getTime() - attendance.clockIn.getTime();
                attendance.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
                yield attendance.save();
                return attendance;
            }
            catch (error) {
                console.error('❌ AttendanceService: Error clocking out:', error);
                throw new Error(`Failed to clock out: ${error.message}`);
            }
        });
    }
    // Get attendance history for an employee
    getEmployeeHistory(employeeId_1) {
        return __awaiter(this, arguments, void 0, function* (employeeId, limit = 30) {
            try {
                const attendances = yield Attendance_1.default.find({ employeeId: employeeId })
                    .sort({ clockIn: -1 })
                    .limit(limit)
                    .lean();
                return attendances;
            }
            catch (error) {
                console.error('❌ AttendanceService: Error getting history:', error);
                throw new Error(`Failed to get attendance history: ${error.message}`);
            }
        });
    }
    // Get all active shifts
    getActiveShifts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const activeShifts = yield Attendance_1.default.find({ status: 'active' })
                    .populate('employeeId', 'firstName lastName role')
                    .sort({ clockIn: -1 })
                    .lean();
                return activeShifts;
            }
            catch (error) {
                console.error('❌ AttendanceService: Error getting active shifts:', error);
                throw new Error(`Failed to get active shifts: ${error.message}`);
            }
        });
    }
    // Get payroll report for a specific month and employee
    getPayrollReport(month, employeeId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Parse month (format: '2025-01')
                const [year, monthNum] = month.split('-').map(Number);
                const startDate = new Date(year, monthNum - 1, 1);
                const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
                // Build query
                const query = {
                    status: 'completed',
                    clockIn: { $gte: startDate, $lte: endDate }
                };
                if (employeeId) {
                    query.employeeId = employeeId;
                }
                // Fetch completed shifts with employee details
                const shifts = yield Attendance_1.default.find(query)
                    .populate('employeeId', 'firstName lastName hourlyRate')
                    .sort({ clockIn: 1 })
                    .lean();
                // Calculate payroll for each shift
                const detailedShifts = shifts.map((shift) => {
                    const employee = shift.employeeId;
                    const hourlyRate = (employee === null || employee === void 0 ? void 0 : employee.hourlyRate) || 0;
                    // Calculate duration
                    let duration = 0;
                    if (shift.clockOut && shift.clockIn) {
                        const diffMs = new Date(shift.clockOut).getTime() - new Date(shift.clockIn).getTime();
                        duration = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimals
                    }
                    // Calculate daily wage
                    const dailyWage = duration * hourlyRate;
                    return {
                        _id: shift._id,
                        date: new Date(shift.clockIn).toISOString().split('T')[0],
                        clockIn: new Date(shift.clockIn).toISOString(),
                        clockOut: shift.clockOut ? new Date(shift.clockOut).toISOString() : null,
                        duration: duration,
                        hourlyRate: hourlyRate,
                        dailyWage: Math.round(dailyWage * 100) / 100, // Round to 2 decimals
                        employee: {
                            _id: employee === null || employee === void 0 ? void 0 : employee._id,
                            firstName: employee === null || employee === void 0 ? void 0 : employee.firstName,
                            lastName: employee === null || employee === void 0 ? void 0 : employee.lastName,
                            fullName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'
                        }
                    };
                });
                // Calculate totals
                const totalHours = detailedShifts.reduce((sum, shift) => sum + shift.duration, 0);
                const totalCost = detailedShifts.reduce((sum, shift) => sum + shift.dailyWage, 0);
                return {
                    month: month,
                    shifts: detailedShifts,
                    totalHours: Math.round(totalHours * 100) / 100,
                    totalCost: Math.round(totalCost * 100) / 100,
                    shiftCount: detailedShifts.length
                };
            }
            catch (error) {
                console.error('❌ AttendanceService: Error getting payroll report:', error);
                throw new Error(`Failed to get payroll report: ${error.message}`);
            }
        });
    }
}
exports.AttendanceService = AttendanceService;
