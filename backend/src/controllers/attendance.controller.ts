import { Request, Response } from 'express';
import { AttendanceService } from '../services/attendance.service';
import { asyncHandler } from '../middleware/errorHandler';

export class AttendanceController {
  private attendanceService: AttendanceService;

  constructor() {
    this.attendanceService = new AttendanceService();
  }

  // Clock by PIN (for kiosk)
  clockByPin = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { pinCode } = req.body;

      if (!pinCode) {
        return res.status(400).json({
          success: false,
          message: 'PIN code is required'
        });
      }

      const result = await this.attendanceService.clockByPin(pinCode);
      
      res.status(200).json({
        success: true,
        data: {
          employee: {
            _id: result.employee._id,
            firstName: result.employee.firstName,
            lastName: result.employee.lastName,
            fullName: `${result.employee.firstName} ${result.employee.lastName}`,
            role: result.employee.role
          },
          attendance: result.attendance,
          action: result.action,
          clockTime: result.action === 'in' ? result.attendance.clockIn : result.attendance.clockOut
        },
        message: result.action === 'in' ? 'Clocked in successfully' : 'Clocked out successfully'
      });
    } catch (error: any) {
      console.error('❌ AttendanceController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to clock',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Clock in
  clockIn = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { employeeId, pinCode } = req.body;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'employeeId is required'
        });
      }

      const attendance = await this.attendanceService.clockIn(employeeId, pinCode);
      
      res.status(200).json({
        success: true,
        data: attendance,
        message: 'Clocked in successfully'
      });
    } catch (error: any) {
      console.error('❌ AttendanceController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to clock in',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Clock out
  clockOut = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.body;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'employeeId is required'
        });
      }

      const attendance = await this.attendanceService.clockOut(employeeId);
      
      res.status(200).json({
        success: true,
        data: attendance,
        message: 'Clocked out successfully'
      });
    } catch (error: any) {
      console.error('❌ AttendanceController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to clock out',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Get employee attendance history
  getEmployeeHistory = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const limit = parseInt(req.query.limit as string) || 30;

      const history = await this.attendanceService.getEmployeeHistory(employeeId, limit);
      
      res.status(200).json({
        success: true,
        data: history,
        count: history.length
      });
    } catch (error: any) {
      console.error('❌ AttendanceController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get attendance history',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Get all active shifts
  getActiveShifts = asyncHandler(async (req: Request, res: Response) => {
    try {
      const activeShifts = await this.attendanceService.getActiveShifts();
      
      res.status(200).json({
        success: true,
        data: activeShifts,
        count: activeShifts.length
      });
    } catch (error: any) {
      console.error('❌ AttendanceController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get active shifts',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Get payroll report
  getPayrollReport = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { month, employeeId } = req.query;

      if (!month || typeof month !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Month parameter is required (format: YYYY-MM)'
        });
      }

      const report = await this.attendanceService.getPayrollReport(
        month,
        employeeId as string | undefined
      );
      
      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('❌ AttendanceController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get payroll report',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
}

