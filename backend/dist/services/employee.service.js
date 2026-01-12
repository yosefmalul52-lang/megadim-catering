"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const Employee_1 = __importDefault(require("../models/Employee"));
const Attendance_1 = __importDefault(require("../models/Attendance"));
class EmployeeService {
    async getEmployeesWithStatus() {
        try {
            const employees = await Employee_1.default.find({ isActive: true }).lean();
            const activeAttendances = await Attendance_1.default.find({ status: 'active' }).lean();
            const attendanceMap = new Map();
            activeAttendances.forEach(attendance => {
                attendanceMap.set(attendance.employeeId.toString(), attendance);
            });
            const employeesWithStatus = employees.map((emp) => {
                const attendance = attendanceMap.get(emp._id.toString());
                return {
                    _id: emp._id.toString(),
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    fullName: `${emp.firstName} ${emp.lastName}`,
                    role: emp.role,
                    phone: emp.phone,
                    hourlyRate: emp.hourlyRate,
                    isActive: emp.isActive,
                    pinCode: emp.pinCode,
                    isClockedIn: !!attendance,
                    currentShiftId: attendance?._id?.toString(),
                    createdAt: emp.createdAt,
                    updatedAt: emp.updatedAt
                };
            });
            return employeesWithStatus;
        }
        catch (error) {
            console.error('❌ EmployeeService: Error getting employees with status:', error);
            throw new Error(`Failed to get employees: ${error.message}`);
        }
    }
    async createEmployee(employeeData) {
        try {
            const employee = new Employee_1.default(employeeData);
            await employee.save();
            return employee;
        }
        catch (error) {
            console.error('❌ EmployeeService: Error creating employee:', error);
            throw new Error(`Failed to create employee: ${error.message}`);
        }
    }
    async updateEmployee(employeeId, updateData) {
        try {
            const employee = await Employee_1.default.findByIdAndUpdate(employeeId, updateData, { new: true, runValidators: true });
            if (!employee) {
                throw new Error('Employee not found');
            }
            return employee;
        }
        catch (error) {
            console.error('❌ EmployeeService: Error updating employee:', error);
            throw new Error(`Failed to update employee: ${error.message}`);
        }
    }
    async deleteEmployee(employeeId) {
        try {
            await Employee_1.default.findByIdAndUpdate(employeeId, { isActive: false });
        }
        catch (error) {
            console.error('❌ EmployeeService: Error deleting employee:', error);
            throw new Error(`Failed to delete employee: ${error.message}`);
        }
    }
    async getEmployeeById(employeeId) {
        try {
            const employee = await Employee_1.default.findById(employeeId);
            if (!employee) {
                throw new Error('Employee not found');
            }
            return employee;
        }
        catch (error) {
            console.error('❌ EmployeeService: Error getting employee:', error);
            throw new Error(`Failed to get employee: ${error.message}`);
        }
    }
    async getEmployeeStats(employeeId, month) {
        try {
            const employee = await Employee_1.default.findById(employeeId).lean();
            if (!employee) {
                throw new Error('Employee not found');
            }
            let startDate;
            let endDate;
            if (month) {
                const [year, monthNum] = month.split('-').map(Number);
                startDate = new Date(year, monthNum - 1, 1);
                endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
            }
            else {
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            }
            const shifts = await Attendance_1.default.find({
                employeeId: employeeId,
                status: 'completed',
                clockIn: { $gte: startDate, $lte: endDate }
            })
                .sort({ clockIn: -1 })
                .lean();
            let totalHours = 0;
            const shiftsWithDetails = shifts.map((shift) => {
                let duration = 0;
                if (shift.clockOut && shift.clockIn) {
                    const diffMs = new Date(shift.clockOut).getTime() - new Date(shift.clockIn).getTime();
                    duration = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
                }
                totalHours += duration;
                return {
                    _id: shift._id,
                    date: new Date(shift.clockIn).toISOString().split('T')[0],
                    clockIn: new Date(shift.clockIn).toISOString(),
                    clockOut: shift.clockOut ? new Date(shift.clockOut).toISOString() : null,
                    duration: duration
                };
            });
            const hourlyRate = employee.hourlyRate || 0;
            const estimatedWage = Math.round(totalHours * hourlyRate * 100) / 100;
            return {
                employee: {
                    _id: employee._id,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    fullName: `${employee.firstName} ${employee.lastName}`,
                    phone: employee.phone,
                    role: employee.role,
                    hourlyRate: hourlyRate
                },
                monthlyHours: Math.round(totalHours * 100) / 100,
                estimatedWage: estimatedWage,
                shifts: shiftsWithDetails.slice(0, 20),
                shiftCount: shifts.length
            };
        }
        catch (error) {
            console.error('❌ EmployeeService: Error getting employee stats:', error);
            throw new Error(`Failed to get employee stats: ${error.message}`);
        }
    }
    async initializeDummyData() {
        try {
            const count = await Employee_1.default.countDocuments();
            if (count === 0) {
                console.log('📝 EmployeeService: No employees found, creating dummy data...');
                const dummyEmployees = [
                    {
                        firstName: 'משה',
                        lastName: 'כהן',
                        role: 'Driver',
                        phone: '050-123-4567',
                        hourlyRate: 50,
                        isActive: true,
                        pinCode: '1234'
                    },
                    {
                        firstName: 'דוד',
                        lastName: 'לוי',
                        role: 'Chef',
                        phone: '052-234-5678',
                        hourlyRate: 80,
                        isActive: true,
                        pinCode: '1234'
                    },
                    {
                        firstName: 'שרה',
                        lastName: 'ישראל',
                        role: 'Cleaner',
                        phone: '054-345-6789',
                        hourlyRate: 45,
                        isActive: true,
                        pinCode: '1234'
                    }
                ];
                await Employee_1.default.insertMany(dummyEmployees);
                console.log('✅ EmployeeService: Dummy employees created');
            }
        }
        catch (error) {
            console.error('❌ EmployeeService: Error initializing dummy data:', error);
        }
    }
}
exports.EmployeeService = EmployeeService;
//# sourceMappingURL=employee.service.js.map