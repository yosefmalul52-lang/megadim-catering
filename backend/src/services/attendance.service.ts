import Attendance from '../models/Attendance';
import Employee from '../models/Employee';

export class AttendanceService {
  // Clock in/out by PIN code (for kiosk)
  async clockByPin(pinCode: string): Promise<{ attendance: any; employee: any; action: 'in' | 'out' }> {
    try {
      // Find employee by PIN
      const employee = await Employee.findOne({ pinCode: pinCode, isActive: true });
      
      if (!employee) {
        throw new Error('Invalid PIN code');
      }

      // Check if employee is already clocked in
      const activeAttendance = await Attendance.findOne({
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

        await activeAttendance.save();
        
        return {
          attendance: activeAttendance,
          employee: employee,
          action: 'out'
        };
      } else {
        // Clock in
        const attendance = new Attendance({
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
    } catch (error: any) {
      console.error('❌ AttendanceService: Error clocking by PIN:', error);
      throw new Error(`Failed to clock: ${error.message}`);
    }
  }

  // Clock in an employee
  async clockIn(employeeId: string, pinCode?: string): Promise<any> {
    try {
      // Verify employee exists and is active
      const employee = await Employee.findById(employeeId);
      if (!employee || !employee.isActive) {
        throw new Error('Employee not found or inactive');
      }

      // Verify PIN if provided
      if (pinCode && employee.pinCode !== pinCode) {
        throw new Error('Invalid PIN code');
      }

      // Check if employee is already clocked in
      const activeAttendance = await Attendance.findOne({
        employeeId: employeeId,
        status: 'active'
      });

      if (activeAttendance) {
        throw new Error('Employee is already clocked in');
      }

      // Create new attendance record
      const attendance = new Attendance({
        employeeId: employeeId,
        clockIn: new Date(),
        status: 'active'
      });

      await attendance.save();
      return attendance;
    } catch (error: any) {
      console.error('❌ AttendanceService: Error clocking in:', error);
      throw new Error(`Failed to clock in: ${error.message}`);
    }
  }

  // Clock out an employee
  async clockOut(employeeId: string): Promise<any> {
    try {
      // Find active attendance
      const attendance = await Attendance.findOne({
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

      await attendance.save();
      return attendance;
    } catch (error: any) {
      console.error('❌ AttendanceService: Error clocking out:', error);
      throw new Error(`Failed to clock out: ${error.message}`);
    }
  }

  // Get attendance history for an employee
  async getEmployeeHistory(employeeId: string, limit: number = 30): Promise<any[]> {
    try {
      const attendances = await Attendance.find({ employeeId: employeeId })
        .sort({ clockIn: -1 })
        .limit(limit)
        .lean();
      
      return attendances;
    } catch (error: any) {
      console.error('❌ AttendanceService: Error getting history:', error);
      throw new Error(`Failed to get attendance history: ${error.message}`);
    }
  }

  // Get all active shifts
  async getActiveShifts(): Promise<any[]> {
    try {
      const activeShifts = await Attendance.find({ status: 'active' })
        .populate('employeeId', 'firstName lastName role')
        .sort({ clockIn: -1 })
        .lean();
      
      return activeShifts;
    } catch (error: any) {
      console.error('❌ AttendanceService: Error getting active shifts:', error);
      throw new Error(`Failed to get active shifts: ${error.message}`);
    }
  }

  // Get payroll report for a specific month and employee
  async getPayrollReport(month: string, employeeId?: string): Promise<any> {
    try {
      // Parse month (format: '2025-01')
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

      // Build query
      const query: any = {
        status: 'completed',
        clockIn: { $gte: startDate, $lte: endDate }
      };

      if (employeeId) {
        query.employeeId = employeeId;
      }

      // Fetch completed shifts with employee details
      const shifts = await Attendance.find(query)
        .populate('employeeId', 'firstName lastName hourlyRate')
        .sort({ clockIn: 1 })
        .lean();

      // Calculate payroll for each shift
      const detailedShifts = shifts.map((shift: any) => {
        const employee = shift.employeeId;
        const hourlyRate = employee?.hourlyRate || 0;
        
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
            _id: employee?._id,
            firstName: employee?.firstName,
            lastName: employee?.lastName,
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
    } catch (error: any) {
      console.error('❌ AttendanceService: Error getting payroll report:', error);
      throw new Error(`Failed to get payroll report: ${error.message}`);
    }
  }
}

