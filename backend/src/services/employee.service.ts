import Employee from '../models/Employee';
import Attendance from '../models/Attendance';

export interface EmployeeWithStatus {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  phone: string;
  hourlyRate: number;
  isActive: boolean;
  pinCode: string;
  isClockedIn: boolean;
  currentShiftId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EmployeeService {
  // Get all employees with their current clock-in status
  async getEmployeesWithStatus(): Promise<EmployeeWithStatus[]> {
    try {
      const employees = await Employee.find({ isActive: true }).lean();
      
      // Get all active attendances
      const activeAttendances = await Attendance.find({ status: 'active' }).lean();
      
      // Create a map of employeeId -> attendance
      const attendanceMap = new Map();
      activeAttendances.forEach(attendance => {
        attendanceMap.set(attendance.employeeId.toString(), attendance);
      });
      
      // Map employees with status
      const employeesWithStatus: EmployeeWithStatus[] = employees.map((emp: any) => {
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
    } catch (error: any) {
      console.error('❌ EmployeeService: Error getting employees with status:', error);
      throw new Error(`Failed to get employees: ${error.message}`);
    }
  }

  // Create a new employee
  async createEmployee(employeeData: any): Promise<any> {
    try {
      const employee = new Employee(employeeData);
      await employee.save();
      return employee;
    } catch (error: any) {
      console.error('❌ EmployeeService: Error creating employee:', error);
      throw new Error(`Failed to create employee: ${error.message}`);
    }
  }

  // Update an employee
  async updateEmployee(employeeId: string, updateData: any): Promise<any> {
    try {
      const employee = await Employee.findByIdAndUpdate(
        employeeId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      return employee;
    } catch (error: any) {
      console.error('❌ EmployeeService: Error updating employee:', error);
      throw new Error(`Failed to update employee: ${error.message}`);
    }
  }

  // Delete an employee (soft delete - set isActive to false)
  async deleteEmployee(employeeId: string): Promise<void> {
    try {
      await Employee.findByIdAndUpdate(employeeId, { isActive: false });
    } catch (error: any) {
      console.error('❌ EmployeeService: Error deleting employee:', error);
      throw new Error(`Failed to delete employee: ${error.message}`);
    }
  }

  // Get employee by ID
  async getEmployeeById(employeeId: string): Promise<any> {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }
      return employee;
    } catch (error: any) {
      console.error('❌ EmployeeService: Error getting employee:', error);
      throw new Error(`Failed to get employee: ${error.message}`);
    }
  }

  // Get employee stats (monthly hours, estimated wage, recent shifts)
  async getEmployeeStats(employeeId: string, month?: string): Promise<any> {
    try {
      const employee = await Employee.findById(employeeId).lean();
      
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Calculate month range
      let startDate: Date;
      let endDate: Date;
      
      if (month) {
        const [year, monthNum] = month.split('-').map(Number);
        startDate = new Date(year, monthNum - 1, 1);
        endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
      } else {
        // Current month
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      // Fetch completed shifts for this month
      const shifts = await Attendance.find({
        employeeId: employeeId,
        status: 'completed',
        clockIn: { $gte: startDate, $lte: endDate }
      })
        .sort({ clockIn: -1 })
        .lean();

      // Calculate totals
      let totalHours = 0;
      const shiftsWithDetails = shifts.map((shift: any) => {
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

      // Calculate estimated wage
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
        shifts: shiftsWithDetails.slice(0, 20), // Last 20 shifts
        shiftCount: shifts.length
      };
    } catch (error: any) {
      console.error('❌ EmployeeService: Error getting employee stats:', error);
      throw new Error(`Failed to get employee stats: ${error.message}`);
    }
  }

  // Initialize with dummy data if no employees exist
  async initializeDummyData(): Promise<void> {
    try {
      const count = await Employee.countDocuments();
      
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
        
        await Employee.insertMany(dummyEmployees);
        console.log('✅ EmployeeService: Dummy employees created');
      }
    } catch (error: any) {
      console.error('❌ EmployeeService: Error initializing dummy data:', error);
    }
  }
}

