"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const Attendance_1 = __importDefault(require("../models/Attendance"));
const Employee_1 = __importDefault(require("../models/Employee"));
class AttendanceService {
    async clockByPin(pinCode) {
        try {
            const employee = await Employee_1.default.findOne({ pinCode: pinCode, isActive: true });
            if (!employee) {
                throw new Error('Invalid PIN code');
            }
            const activeAttendance = await Attendance_1.default.findOne({
                employeeId: employee._id,
                status: 'active'
            });
            if (activeAttendance) {
                activeAttendance.clockOut = new Date();
                activeAttendance.status = 'completed';
                const diffMs = activeAttendance.clockOut.getTime() - activeAttendance.clockIn.getTime();
                activeAttendance.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
                await activeAttendance.save();
                return {
                    attendance: activeAttendance,
                    employee: employee,
                    action: 'out'
                };
            }
            else {
                const attendance = new Attendance_1.default({
                    employeeId: employee._id,
                    clockIn: new Date(),
                    status: 'active'
                });
                await attendance.save();
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
    }
    async clockIn(employeeId, pinCode) {
        try {
            const employee = await Employee_1.default.findById(employeeId);
            if (!employee || !employee.isActive) {
                throw new Error('Employee not found or inactive');
            }
            if (pinCode && employee.pinCode !== pinCode) {
                throw new Error('Invalid PIN code');
            }
            const activeAttendance = await Attendance_1.default.findOne({
                employeeId: employeeId,
                status: 'active'
            });
            if (activeAttendance) {
                throw new Error('Employee is already clocked in');
            }
            const attendance = new Attendance_1.default({
                employeeId: employeeId,
                clockIn: new Date(),
                status: 'active'
            });
            await attendance.save();
            return attendance;
        }
        catch (error) {
            console.error('❌ AttendanceService: Error clocking in:', error);
            throw new Error(`Failed to clock in: ${error.message}`);
        }
    }
    async clockOut(employeeId) {
        try {
            const attendance = await Attendance_1.default.findOne({
                employeeId: employeeId,
                status: 'active'
            });
            if (!attendance) {
                throw new Error('No active shift found for this employee');
            }
            attendance.clockOut = new Date();
            attendance.status = 'completed';
            const diffMs = attendance.clockOut.getTime() - attendance.clockIn.getTime();
            attendance.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
            await attendance.save();
            return attendance;
        }
        catch (error) {
            console.error('❌ AttendanceService: Error clocking out:', error);
            throw new Error(`Failed to clock out: ${error.message}`);
        }
    }
    async getEmployeeHistory(employeeId, limit = 30) {
        try {
            const attendances = await Attendance_1.default.find({ employeeId: employeeId })
                .sort({ clockIn: -1 })
                .limit(limit)
                .lean();
            return attendances;
        }
        catch (error) {
            console.error('❌ AttendanceService: Error getting history:', error);
            throw new Error(`Failed to get attendance history: ${error.message}`);
        }
    }
    async getActiveShifts() {
        try {
            const activeShifts = await Attendance_1.default.find({ status: 'active' })
                .populate('employeeId', 'firstName lastName role')
                .sort({ clockIn: -1 })
                .lean();
            return activeShifts;
        }
        catch (error) {
            console.error('❌ AttendanceService: Error getting active shifts:', error);
            throw new Error(`Failed to get active shifts: ${error.message}`);
        }
    }
    async getPayrollReport(month, employeeId) {
        try {
            const [year, monthNum] = month.split('-').map(Number);
            const startDate = new Date(year, monthNum - 1, 1);
            const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
            const query = {
                status: 'completed',
                clockIn: { $gte: startDate, $lte: endDate }
            };
            if (employeeId) {
                query.employeeId = employeeId;
            }
            const shifts = await Attendance_1.default.find(query)
                .populate('employeeId', 'firstName lastName hourlyRate')
                .sort({ clockIn: 1 })
                .lean();
            const detailedShifts = shifts.map((shift) => {
                const employee = shift.employeeId;
                const hourlyRate = employee?.hourlyRate || 0;
                let duration = 0;
                if (shift.clockOut && shift.clockIn) {
                    const diffMs = new Date(shift.clockOut).getTime() - new Date(shift.clockIn).getTime();
                    duration = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
                }
                const dailyWage = duration * hourlyRate;
                return {
                    _id: shift._id,
                    date: new Date(shift.clockIn).toISOString().split('T')[0],
                    clockIn: new Date(shift.clockIn).toISOString(),
                    clockOut: shift.clockOut ? new Date(shift.clockOut).toISOString() : null,
                    duration: duration,
                    hourlyRate: hourlyRate,
                    dailyWage: Math.round(dailyWage * 100) / 100,
                    employee: {
                        _id: employee?._id,
                        firstName: employee?.firstName,
                        lastName: employee?.lastName,
                        fullName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'
                    }
                };
            });
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
    }
}
exports.AttendanceService = AttendanceService;
//# sourceMappingURL=attendance.service.js.map