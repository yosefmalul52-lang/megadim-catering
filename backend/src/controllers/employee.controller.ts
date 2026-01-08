import { Request, Response } from 'express';
import { EmployeeService } from '../services/employee.service';
import { asyncHandler } from '../middleware/errorHandler';

export class EmployeeController {
  private employeeService: EmployeeService;

  constructor() {
    this.employeeService = new EmployeeService();
    // Initialize dummy data on startup
    this.employeeService.initializeDummyData().catch(console.error);
  }

  // Get all employees with their clock-in status
  getEmployeesWithStatus = asyncHandler(async (req: Request, res: Response) => {
    try {
      const employees = await this.employeeService.getEmployeesWithStatus();
      
      res.status(200).json({
        success: true,
        data: employees,
        count: employees.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ EmployeeController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get employees',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Create a new employee
  createEmployee = asyncHandler(async (req: Request, res: Response) => {
    try {
      const employeeData = req.body;
      
      // Validation
      if (!employeeData.firstName || !employeeData.lastName || !employeeData.role || !employeeData.phone) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: firstName, lastName, role, phone'
        });
      }

      // Set default PIN if not provided
      if (!employeeData.pinCode) {
        employeeData.pinCode = '1234';
      }

      const employee = await this.employeeService.createEmployee(employeeData);
      
      res.status(201).json({
        success: true,
        data: employee,
        message: 'Employee created successfully'
      });
    } catch (error: any) {
      console.error('❌ EmployeeController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create employee',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Update an employee
  updateEmployee = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const employee = await this.employeeService.updateEmployee(id, updateData);
      
      res.status(200).json({
        success: true,
        data: employee,
        message: 'Employee updated successfully'
      });
    } catch (error: any) {
      console.error('❌ EmployeeController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update employee',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Delete an employee (soft delete)
  deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await this.employeeService.deleteEmployee(id);
      
      res.status(200).json({
        success: true,
        message: 'Employee deleted successfully'
      });
    } catch (error: any) {
      console.error('❌ EmployeeController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete employee',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Get employee by ID
  getEmployeeById = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const employee = await this.employeeService.getEmployeeById(id);
      
      res.status(200).json({
        success: true,
        data: employee
      });
    } catch (error: any) {
      console.error('❌ EmployeeController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get employee',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Get my stats (for employee self-service)
  getMyStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const employeeId = (req as any).user?.id;
      const month = req.query.month as string | undefined;

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: 'Employee ID not found in token'
        });
      }

      const stats = await this.employeeService.getEmployeeStats(employeeId, month);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('❌ EmployeeController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get employee stats',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
}

