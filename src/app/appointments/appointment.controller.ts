import { Router, Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import { DatabaseService } from '../../database/database.service';
import { AppointmentRepository } from './appointment.repository';
import { AppointmentService } from './appointment.service';
import { UserService } from '../users/user.service';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/user.model';
import { authenticate, authorize } from '../users/user.controller';
import { AppointmentStatus } from './appointment.model';

export class AppointmentController {
  private router: Router;
  private appointmentService: AppointmentService;
  private userService: UserService;

  constructor() {
    this.router = Router();
    const dbService = Container.get(DatabaseService);
    const appointmentRepository = new AppointmentRepository(dbService);
    this.appointmentService = new AppointmentService(appointmentRepository);

    // User variables to send notifications
    const userRepository = new UserRepository(dbService);
    this.userService = new UserService(userRepository);

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // ========== PUBLIC ROUTES ==========
    // No public routes for appointments

    // ========== PROTECTED ROUTES ==========
    // Patient routes
    this.router.get('/', authenticate, authorize([UserRole.PATIENT]), this.getMyAppointments.bind(this));
    this.router.post('/', authenticate, authorize([UserRole.PATIENT]), this.createAppointment.bind(this));
    this.router.get('/:id', authenticate, authorize([UserRole.PATIENT]), this.getAppointment.bind(this));
    this.router.put('/:id', authenticate, authorize([UserRole.PATIENT]), this.rescheduleAppointment.bind(this));
    this.router.delete('/:id', authenticate, authorize([UserRole.PATIENT]), this.cancelAppointment.bind(this));

    // Doctor routes
    this.router.get('/doctor/schedule', authenticate, authorize([UserRole.DOCTOR]), this.getDoctorSchedule.bind(this));
    this.router.delete('/doctor/:id', authenticate, authorize([UserRole.DOCTOR]), this.cancelAppointmentDoctor.bind(this));
    this.router.put('/doctor/:id/complete', authenticate, authorize([UserRole.DOCTOR]), this.completeAppointment.bind(this));

    // Admin routes
    this.router.get('/admin/all', authenticate, authorize([UserRole.ADMIN]), this.getAllAppointments.bind(this));
    this.router.get('/admin/settings', authenticate, authorize([UserRole.ADMIN]), this.getAppointmentSettings.bind(this));
    this.router.put('/admin/settings', authenticate, authorize([UserRole.ADMIN]), this.updateAppointmentSettings.bind(this));
  }

  // ========== HANDLERS ==========

  private async getMyAppointments(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { page, limit, sortBy, sortOrder } = req.query;
      
      const appointments = await this.appointmentService.getPatientAppointments(userId);
      
      res.status(200).json({
        success: true,
        count: appointments.length,
        appointments
      });
      
    } catch (error: any) {
      console.error('Get my appointments error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve appointments' 
      });
    }
  }

  private async createAppointment(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { idDoctor, date, idSpeciality, location } = req.body;
      
      // Validation
      if (!idDoctor || !date || !idSpeciality || !location) {
        res.status(400).json({ 
          error: 'Missing data',
          message: 'idDoctor, date, idSpeciality and location are required' 
        });
        return;
      }
      
      const appointmentData = {
        idPatient: userId,
        idDoctor: parseInt(String(idDoctor)),
        date: new Date(date),
        idSpeciality: parseInt(String(idSpeciality)),
        location: String(location)
      };
      
      const appointmentId = await this.appointmentService.createAppointment(appointmentData);
      // Send notification to doctor
      const doctor = await this.userService.getUserById(appointmentData.idDoctor);
      const patient = await this.userService.getUserById(userId);
      console.log(`[NOTIFICATION] Appointment created: Appointment ID ${appointmentId} with Dr. ${doctor?.name} has been scheduled by patient ${patient?.name}`);
      
      res.status(201).json({ 
        success: true,
        message: 'Appointment created successfully', 
        id: appointmentId 
      });
      
    } catch (error: any) {
      console.error('Create appointment error:', error);
      
      if (error.message === 'Doctor is not available at the selected time') {
        res.status(409).json({ 
          error: 'Time not available',
          message: error.message 
        });
      } else {
        res.status(400).json({ 
          error: 'Creation error',
          message: error.message || 'Could not create appointment' 
        });
      }
    }
  }

  private async getAppointment(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const appointmentId = parseInt(String(req.params.id));
      
      if (isNaN(appointmentId) || appointmentId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Appointment ID must be a positive number' 
        });
        return;
      }
      
      const appointment = await this.appointmentService.getAppointmentById(appointmentId);
      
      if (!appointment) {
        res.status(404).json({ 
          error: 'Appointment not found',
          message: `Appointment with ID ${appointmentId} not found` 
        });
        return;
      }
      
      // Patient can only see their own appointments
      if (appointment.idPatient !== userId) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only view your own appointments' 
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        appointment
      });
      
    } catch (error: any) {
      console.error('Get appointment error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve appointment' 
      });
    }
  }

  private async rescheduleAppointment(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const appointmentId = parseInt(String(req.params.id));
      const { date } = req.body;
      
      if (isNaN(appointmentId) || appointmentId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Appointment ID must be a positive number' 
        });
        return;
      }
      
      if (!date) {
        res.status(400).json({ 
          error: 'Missing data',
          message: 'New date is required' 
        });
        return;
      }
      
      // Check if appointment exists and belongs to patient
      const appointment = await this.appointmentService.getAppointmentById(appointmentId);
      
      if (!appointment) {
        res.status(404).json({ 
          error: 'Appointment not found',
          message: `Appointment with ID ${appointmentId} not found` 
        });
        return;
      }
      
      if (appointment.idPatient !== userId) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only reschedule your own appointments' 
        });
        return;
      }
      
      const newDate = new Date(date);
      const updated = await this.appointmentService.rescheduleAppointment(appointmentId, newDate);
      
      if (updated) {
        // Send notification to doctor
        const doctor = await this.userService.getUserById(appointment.idDoctor);
        const patient = await this.userService.getUserById(userId);
        console.log(`[NOTIFICATION] Appointment rescheduled: Appointment ID ${appointmentId} with Dr. ${doctor?.name} has been moved to ${newDate.toISOString()} by patient ${patient?.name}`);
        
        res.status(200).json({ 
          success: true,
          message: 'Appointment rescheduled successfully' 
        });
      } else {
        res.status(400).json({ 
          error: 'Update failed',
          message: 'Could not reschedule appointment' 
        });
      }
      
    } catch (error: any) {
      console.error('Reschedule appointment error:', error);
      
      if (error.message === 'Doctor is not available at the selected time') {
        res.status(409).json({ 
          error: 'Time not available',
          message: error.message 
        });
      } else if (error.message === 'Cannot reschedule a cancelled appointment') {
        res.status(400).json({ 
          error: 'Invalid operation',
          message: error.message 
        });
      } else {
        res.status(400).json({ 
          error: 'Reschedule error',
          message: error.message || 'Could not reschedule appointment' 
        });
      }
    }
  }

  private async cancelAppointment(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const appointmentId = parseInt(String(req.params.id));
      
      if (isNaN(appointmentId) || appointmentId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Appointment ID must be a positive number' 
        });
        return;
      }
      
      // Check if appointment exists and belongs to patient
      const appointment = await this.appointmentService.getAppointmentById(appointmentId);
      
      if (!appointment) {
        res.status(404).json({ 
          error: 'Appointment not found',
          message: `Appointment with ID ${appointmentId} not found` 
        });
        return;
      }
      
      if (appointment.idPatient !== userId) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only cancel your own appointments' 
        });
        return;
      }
      
      const cancelled = await this.appointmentService.cancelAppointment(appointmentId);
      
      if (cancelled) {
        // Send notification to doctor
        const doctor = await this.userService.getUserById(appointment.idDoctor);
        const patient = await this.userService.getUserById(userId);
        console.log(`[NOTIFICATION] Appointment cancelled: Appointment ID ${appointmentId} with Dr. ${doctor?.name} has been cancelled by patient ${patient?.name}`);
        
        res.status(204).send();
      } else {
        res.status(400).json({ 
          error: 'Cancellation failed',
          message: 'Could not cancel appointment' 
        });
      }
      
    } catch (error: any) {
      console.error('Cancel appointment error:', error);
      
      if (error.message === 'Appointment is already cancelled') {
        res.status(400).json({ 
          error: 'Already cancelled',
          message: error.message 
        });
      } else {
        res.status(400).json({ 
          error: 'Cancellation error',
          message: error.message || 'Could not cancel appointment' 
        });
      }
    }
  }

  private async getDoctorSchedule(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const appointments = await this.appointmentService.getDoctorAppointments(doctorId);
      
      res.status(200).json({
        success: true,
        count: appointments.length,
        appointments
      });
      
    } catch (error: any) {
      console.error('Get doctor schedule error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve schedule' 
      });
    }
  }

  private async cancelAppointmentDoctor(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const appointmentId = parseInt(String(req.params.id));
      
      if (isNaN(appointmentId) || appointmentId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Appointment ID must be a positive number' 
        });
        return;
      }
      
      // Check if appointment exists and belongs to doctor
      const appointment = await this.appointmentService.getAppointmentById(appointmentId);
      
      if (!appointment) {
        res.status(404).json({ 
          error: 'Appointment not found',
          message: `Appointment with ID ${appointmentId} not found` 
        });
        return;
      }
      
      if (appointment.idDoctor !== doctorId) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only cancel your own appointments' 
        });
        return;
      }
      
      const cancelled = await this.appointmentService.cancelAppointment(appointmentId);
      
      if (cancelled) {
        // Send notification to patient
        const doctor = await this.userService.getUserById(appointment.idDoctor);
        const patient = await this.userService.getUserById(appointment.idPatient);
        console.log(`[NOTIFICATION] Appointment cancelled: Appointment ID ${appointmentId} with patient ${patient?.name} has been cancelled by Dr. ${doctor?.name}`);
        
        res.status(204).send();
      } else {
        res.status(400).json({ 
          error: 'Cancellation failed',
          message: 'Could not cancel appointment' 
        });
      }
      
    } catch (error: any) {
      console.error('Doctor cancel appointment error:', error);
      
      res.status(400).json({ 
        error: 'Cancellation error',
        message: error.message || 'Could not cancel appointment' 
      });
    }
  }

  private async completeAppointment(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const appointmentId = parseInt(String(req.params.id));
      
      if (isNaN(appointmentId) || appointmentId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Appointment ID must be a positive number' 
        });
        return;
      }
      
      // Check if appointment exists and belongs to doctor
      const appointment = await this.appointmentService.getAppointmentById(appointmentId);
      
      if (!appointment) {
        res.status(404).json({ 
          error: 'Appointment not found',
          message: `Appointment with ID ${appointmentId} not found` 
        });
        return;
      }
      
      if (appointment.idDoctor !== doctorId) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only complete your own appointments' 
        });
        return;
      }
      
      const completed = await this.appointmentService.completeAppointment(appointmentId);
      
      if (completed) {
        res.status(200).json({ 
          success: true,
          message: 'Appointment marked as completed' 
        });
      } else {
        res.status(400).json({ 
          error: 'Update failed',
          message: 'Could not complete appointment' 
        });
      }
      
    } catch (error: any) {
      console.error('Complete appointment error:', error);
      
      res.status(400).json({ 
        error: 'Completion error',
        message: error.message || 'Could not complete appointment' 
      });
    }
  }

  private async getAllAppointments(req: Request, res: Response): Promise<void> {
    try {
      const { 
        idPatient, 
        idDoctor, 
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'date',
        sortOrder = 'ASC'
      } = req.query;
      
      const query = {
        idPatient: idPatient ? parseInt(String(idPatient)) : undefined,
        idDoctor: idDoctor ? parseInt(String(idDoctor)) : undefined,
        status: status as AppointmentStatus,
        startDate: startDate ? new Date(String(startDate)) : undefined,
        endDate: endDate ? new Date(String(endDate)) : undefined,
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        sortBy: String(sortBy),
        sortOrder: sortOrder as 'ASC' | 'DESC'
      };
      
      const appointments = await this.appointmentService.getAppointments(query);
      
      res.status(200).json({
        success: true,
        count: appointments.length,
        appointments
      });
      
    } catch (error: any) {
      console.error('Get all appointments error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve appointments' 
      });
    }
  }

  private async updateAppointmentSettings(req: Request, res: Response): Promise<void> {
    try {
      const { startTime, endTime, duration } = req.body;
      
      if (!startTime && !endTime && !duration) {
        res.status(400).json({ 
          error: 'No changes',
          message: 'No data provided for update' 
        });
        return;
      }
      
      const updates: any = {};
      if (startTime) updates.startTime = startTime;
      if (endTime) updates.endTime = endTime;
      if (duration) updates.duration = parseInt(String(duration));
      
      const updatedSettings = await this.appointmentService.updateAppointmentSettings(updates);
      
      res.status(200).json({ 
        success: true,
        message: 'Appointment settings updated successfully',
        settings: updatedSettings
      });
      
    } catch (error: any) {
        console.error('Update appointment settings error:', error);
        
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          res.status(400).json({ 
            error: 'Validation error',
            message: error.message 
          });
        } else {
          res.status(500).json({ 
            error: 'Update error',
            message: error.message || 'Could not update settings' 
          });
        }
      }
  }

  public getRouter(): Router {
    return this.router;
  }


  //  ==========  APPOINTMENT-SETTINGS ==========

  private async getAppointmentSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await this.appointmentService.getAppointmentSettings();
      
      res.status(200).json({
        success: true,
        settings
      });
      
    } catch (error: any) {
      console.error('Get appointment settings error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve appointment settings' 
      });
    }
  }
}

// ==================== EXPORT ====================
const appointmentController = new AppointmentController();
export const appointmentRoutes = appointmentController.getRouter();