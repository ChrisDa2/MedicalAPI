import { Router, Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import { DatabaseService } from '../../database/database.service';
import { MedicalRecordRepository } from './medical-record.repository';
import { MedicalRecordService } from './medical-record.service';
import { UserService } from '../users/user.service';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/user.model';
import { authenticate, authorize } from '../users/user.controller';

export class MedicalRecordController {
  private router: Router;
  private medicalRecordService: MedicalRecordService;
  private userService: UserService;

  constructor() {
    this.router = Router();
    const dbService = Container.get(DatabaseService);
    const medicalRecordRepository = new MedicalRecordRepository(dbService);
    const userRepository = new UserRepository(dbService);
    this.medicalRecordService = new MedicalRecordService(medicalRecordRepository);
    this.userService = new UserService(userRepository);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // ========== PROTECTED ROUTES ==========
    // Patient routes
    this.router.get('/', authenticate, authorize([UserRole.PATIENT]), this.getMyMedicalRecords.bind(this));
    this.router.get('/:id', authenticate, authorize([UserRole.PATIENT]), this.getMyMedicalRecord.bind(this));

    // Doctor routes
    this.router.get('/doctor/records', authenticate, authorize([UserRole.DOCTOR]), this.getDoctorMedicalRecords.bind(this));
    this.router.post('/doctor/', authenticate, authorize([UserRole.DOCTOR]), this.createMedicalRecord.bind(this));
    this.router.get('/doctor/:id', authenticate, authorize([UserRole.DOCTOR]), this.getMedicalRecord.bind(this));
    this.router.put('/doctor/:id/tests', authenticate, authorize([UserRole.DOCTOR]), this.updateTestResults.bind(this));
    this.router.put('/doctor/:id/treatment', authenticate, authorize([UserRole.DOCTOR]), this.updateTreatment.bind(this));

    // Admin routes
    this.router.get('/admin/all', authenticate, authorize([UserRole.ADMIN]), this.getAllMedicalRecords.bind(this));
    this.router.get('/admin/search', authenticate, authorize([UserRole.ADMIN]), this.searchMedicalRecords.bind(this));
    this.router.get('/admin/:id', authenticate, authorize([UserRole.ADMIN]), this.getMedicalRecordAdmin.bind(this));
    this.router.put('/admin/:id', authenticate, authorize([UserRole.ADMIN]), this.updateMedicalRecord.bind(this));
  }

  // ========== HANDLERS ==========

  private async getMyMedicalRecords(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { page, limit, sortBy, sortOrder } = req.query;
      
      const medicalRecords = await this.medicalRecordService.getPatientMedicalRecords(userId);
      
      res.status(200).json({
        success: true,
        count: medicalRecords.length,
        medicalRecords
      });
      
    } catch (error: any) {
      console.error('Get my medical records error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve medical records' 
      });
    }
  }

  private async getMyMedicalRecord(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const medicalRecordId = parseInt(String(req.params.id));
      
      if (isNaN(medicalRecordId) || medicalRecordId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Medical record ID must be a positive number' 
        });
        return;
      }
      
      const medicalRecord = await this.medicalRecordService.getMedicalRecordById(medicalRecordId);
      
      if (!medicalRecord) {
        res.status(404).json({ 
          error: 'Medical record not found',
          message: `Medical record with ID ${medicalRecordId} not found` 
        });
        return;
      }
      
      // Patient can only see their own medical records
      if (medicalRecord.idPatient !== userId) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only view your own medical records' 
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        medicalRecord
      });
      
    } catch (error: any) {
      console.error('Get my medical record error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve medical record' 
      });
    }
  }

  private async getDoctorMedicalRecords(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const medicalRecords = await this.medicalRecordService.getDoctorMedicalRecords(doctorId);
      
      res.status(200).json({
        success: true,
        count: medicalRecords.length,
        medicalRecords
      });
      
    } catch (error: any) {
      console.error('Get doctor medical records error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve medical records' 
      });
    }
  }

  private async createMedicalRecord(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const { idAppointment, idPatient, idSpeciality, description, treatment, testResults } = req.body;
      
      // Validation
      if (!idAppointment || !idPatient || !idSpeciality || !description || !treatment) {
        res.status(400).json({ 
          error: 'Missing data',
          message: 'idAppointment, idPatient, idSpeciality, description and treatment are required' 
        });
        return;
      }
      
      const medicalRecordData = {
        idAppointment: parseInt(String(idAppointment)),
        idDoctor: doctorId,
        idPatient: parseInt(String(idPatient)),
        idSpeciality: parseInt(String(idSpeciality)),
        description: String(description),
        treatment: String(treatment),
        testResults: testResults || []
      };
      
      const medicalRecordId = await this.medicalRecordService.createMedicalRecord(medicalRecordData);
      
      // Send notification log
      if(medicalRecordId)
      {
        const doctor = await this.userService.getUserById(doctorId);
        const patient = await this.userService.getUserById(medicalRecordData.idPatient);
        const medicalRecord = await this.medicalRecordService.getMedicalRecordById(medicalRecordId);
        if(medicalRecord) console.log(`[NOTIFICATION] Medical record created: Dr. ${doctor?.name} created medical record for patient ${patient?.name} at ${medicalRecord.date}`);
      }
      
      res.status(201).json({ 
        success: true,
        message: 'Medical record created successfully', 
        id: medicalRecordId 
      });
      
    } catch (error: any) {
      console.error('Create medical record error:', error);
      
      if (error.message === 'Medical record already exists for this appointment') {
        res.status(409).json({ 
          error: 'Record exists',
          message: error.message 
        });
      } else {
        res.status(400).json({ 
          error: 'Creation error',
          message: error.message || 'Could not create medical record' 
        });
      }
    }
  }

  private async getMedicalRecord(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const medicalRecordId = parseInt(String(req.params.id));
      
      if (isNaN(medicalRecordId) || medicalRecordId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Medical record ID must be a positive number' 
        });
        return;
      }
      
      const medicalRecord = await this.medicalRecordService.getMedicalRecordById(medicalRecordId);
      
      if (!medicalRecord) {
        res.status(404).json({ 
          error: 'Medical record not found',
          message: `Medical record with ID ${medicalRecordId} not found` 
        });
        return;
      }
      
      // Doctor can only see medical records they created
      if (medicalRecord.idDoctor !== doctorId) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only view medical records you created' 
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        medicalRecord
      });
      
    } catch (error: any) {
      console.error('Get medical record error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve medical record' 
      });
    }
  }

  private async updateTestResults(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const medicalRecordId = parseInt(String(req.params.id));
      const { testResults } = req.body;
      
      if (isNaN(medicalRecordId) || medicalRecordId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Medical record ID must be a positive number' 
        });
        return;
      }
      
      if (!testResults || !Array.isArray(testResults)) {
        res.status(400).json({ 
          error: 'Invalid data',
          message: 'testResults must be an array' 
        });
        return;
      }
      
      // Check if medical record exists and belongs to doctor
      const medicalRecord = await this.medicalRecordService.getMedicalRecordById(medicalRecordId);
      
      if (!medicalRecord) {
        res.status(404).json({ 
          error: 'Medical record not found',
          message: `Medical record with ID ${medicalRecordId} not found` 
        });
        return;
      }
      
      if (medicalRecord.idDoctor !== doctorId) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only update medical records you created' 
        });
        return;
      }
      
      const updated = await this.medicalRecordService.updateTestResults(medicalRecordId, testResults);
      
      if (updated) {
        console.log(`[NOTIFICATION] Test results updated: Doctor updated test results for medical record ID ${medicalRecordId} from appointment at ${medicalRecord.date}`);
        
        res.status(200).json({ 
          success: true,
          message: 'Test results updated successfully' 
        });
      } else {
        res.status(400).json({ 
          error: 'Update failed',
          message: 'Could not update test results' 
        });
      }
      
    } catch (error: any) {
      console.error('Update test results error:', error);
      
      res.status(400).json({ 
        error: 'Update error',
        message: error.message || 'Could not update test results' 
      });
    }
  }

  private async updateTreatment(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const medicalRecordId = parseInt(String(req.params.id));
      const { treatment } = req.body;
      
      if (isNaN(medicalRecordId) || medicalRecordId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Medical record ID must be a positive number' 
        });
        return;
      }
      
      if (!treatment || treatment.trim().length === 0) {
        res.status(400).json({ 
          error: 'Invalid data',
          message: 'treatment is required' 
        });
        return;
      }
      
      // Check if medical record exists and belongs to doctor
      const medicalRecord = await this.medicalRecordService.getMedicalRecordById(medicalRecordId);
      
      if (!medicalRecord) {
        res.status(404).json({ 
          error: 'Medical record not found',
          message: `Medical record with ID ${medicalRecordId} not found` 
        });
        return;
      }
      
      if (medicalRecord.idDoctor !== doctorId) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only update medical records you created' 
        });
        return;
      }
      
      const updated = await this.medicalRecordService.updateTreatment(medicalRecordId, treatment);
      
      if (updated) {
        console.log(`[NOTIFICATION] Treatment updated: Doctor updated treatment for medical record ID ${medicalRecordId} from appointment at ${medicalRecord.date}`);
        
        res.status(200).json({ 
          success: true,
          message: 'Treatment updated successfully' 
        });
      } else {
        res.status(400).json({ 
          error: 'Update failed',
          message: 'Could not update treatment' 
        });
      }
      
    } catch (error: any) {
      console.error('Update treatment error:', error);
      
      res.status(400).json({ 
        error: 'Update error',
        message: error.message || 'Could not update treatment' 
      });
    }
  }

  private async getAllMedicalRecords(req: Request, res: Response): Promise<void> {
    try {
      const { 
        idPatient, 
        idDoctor, 
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'date',
        sortOrder = 'DESC'
      } = req.query;
      
      const query = {
        idPatient: idPatient ? parseInt(String(idPatient)) : undefined,
        idDoctor: idDoctor ? parseInt(String(idDoctor)) : undefined,
        startDate: startDate ? new Date(String(startDate)) : undefined,
        endDate: endDate ? new Date(String(endDate)) : undefined,
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        sortBy: String(sortBy),
        sortOrder: sortOrder as 'ASC' | 'DESC'
      };
      
      const medicalRecords = await this.medicalRecordService.getMedicalRecords(query);
      
      res.status(200).json({
        success: true,
        count: medicalRecords.length,
        medicalRecords
      });
      
    } catch (error: any) {
      console.error('Get all medical records error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve medical records' 
      });
    }
  }

  private async getMedicalRecordAdmin(req: Request, res: Response): Promise<void> {
    try {
      const medicalRecordId = parseInt(String(req.params.id));
      
      if (isNaN(medicalRecordId) || medicalRecordId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Medical record ID must be a positive number' 
        });
        return;
      }
      
      const medicalRecord = await this.medicalRecordService.getMedicalRecordById(medicalRecordId);
      
      if (!medicalRecord) {
        res.status(404).json({ 
          error: 'Medical record not found',
          message: `Medical record with ID ${medicalRecordId} not found` 
        });
        return;
      }
      
      // Admin can see any medical record, no restrictions
      res.status(200).json({
        success: true,
        medicalRecord
      });
      
    } catch (error: any) {
      console.error('Get medical record (admin) error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve medical record' 
      });
    }
  }

  private async searchMedicalRecords(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.query;
      
      if (!name || typeof name !== 'string') {
        res.status(400).json({ 
          error: 'Missing data',
          message: 'Patient name is required for search' 
        });
        return;
      }
      
      const medicalRecords = await this.medicalRecordService.searchMedicalRecordsByPatientName(name);
      
      res.status(200).json({
        success: true,
        count: medicalRecords.length,
        medicalRecords
      });
      
    } catch (error: any) {
      console.error('Search medical records error:', error);
      
      res.status(500).json({ 
        error: 'Search error',
        message: 'Could not search medical records' 
      });
    }
  }

  private async updateMedicalRecord(req: Request, res: Response): Promise<void> {
    try {
      const medicalRecordId = parseInt(String(req.params.id));
      const { description, treatment, testResults } = req.body;
      
      if (isNaN(medicalRecordId) || medicalRecordId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Medical record ID must be a positive number' 
        });
        return;
      }
      
      if (!description && !treatment && !testResults) {
        res.status(400).json({ 
          error: 'No changes',
          message: 'No data provided for update' 
        });
        return;
      }
      
      const updateData: any = {};
      if (description) updateData.description = description;
      if (treatment) updateData.treatment = treatment;
      if (testResults) updateData.testResults = testResults;
      
      const updated = await this.medicalRecordService.updateMedicalRecord(medicalRecordId, updateData);
      
      if (updated) {
        const medicalRecord = await this.medicalRecordService.getMedicalRecordById(medicalRecordId);
        if (medicalRecord) console.log(`[NOTIFICATION] Admin updated medical record: Medical record ID ${medicalRecordId} was updated by admin from appointment at ${medicalRecord.date}`);
        
        res.status(200).json({ 
          success: true,
          message: 'Medical record updated successfully' 
        });
      } else {
        res.status(404).json({ 
          error: 'Medical record not found',
          message: `Medical record with ID ${medicalRecordId} not found` 
        });
      }
      
    } catch (error: any) {
      console.error('Update medical record error:', error);
      
      res.status(400).json({ 
        error: 'Update error',
        message: error.message || 'Could not update medical record' 
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}

// ==================== EXPORT ====================
const medicalRecordController = new MedicalRecordController();
export const medicalRecordRoutes = medicalRecordController.getRouter();