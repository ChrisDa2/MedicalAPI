import { Router, Request, Response } from 'express';
import { Container } from 'typedi';
import { DatabaseService } from '../../database/database.service';
import { HospitalRepository } from './hospital.repository';
import { HospitalService } from './hospital.service';

export class HospitalController {
  private router: Router;
  private hospitalService: HospitalService;

  constructor() {
    this.router = Router();
    const dbService = Container.get(DatabaseService);
    const hospitalRepository = new HospitalRepository(dbService);
    this.hospitalService = new HospitalService(hospitalRepository);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // ========== PUBLIC ROUTES ==========

    this.router.get('/', this.getAllHospitals.bind(this));
    this.router.get('/search', this.searchHospitals.bind(this));
    this.router.get('/:id', this.getHospitalById.bind(this));
  }

  // ========== HANDLERS ==========

  private async getAllHospitals(req: Request, res: Response): Promise<void> {
    try {
      const { 
        page = 1,
        limit = 20
      } = req.query;
      
      const hospitals = await this.hospitalService.getAllHospitals({
        page: parseInt(String(page)),
        limit: parseInt(String(limit))
      });
      
      res.status(200).json({
        success: true,
        count: hospitals.length,
        hospitals
      });
      
    } catch (error: any) {
      console.error('Get all hospitals error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve hospitals' 
      });
    }
  }

  private async getHospitalById(req: Request, res: Response): Promise<void> {
    try {
      const hospitalId = parseInt(String(req.params.id));
      
      if (isNaN(hospitalId) || hospitalId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Hospital ID must be a positive number' 
        });
        return;
      }
      
      const hospital = await this.hospitalService.getHospitalById(hospitalId);
      
      if (!hospital) {
        res.status(404).json({ 
          error: 'Hospital not found',
          message: `Hospital with ID ${hospitalId} not found` 
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        hospital
      });
      
    } catch (error: any) {
      console.error('Get hospital by ID error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve hospital' 
      });
    }
  }

  private async searchHospitals(req: Request, res: Response): Promise<void> {
    try {
      const { 
        name, 
        department, 
        service, 
        location,
        page = 1,
        limit = 20
      } = req.body;
      
      const query = {
        name: name as string,
        department: department as string,
        service: service as string,
        location: location as string,
        page: parseInt(String(page)),
        limit: parseInt(String(limit))
      };
      
      const hospitals = await this.hospitalService.getAllHospitals(query);
      
      res.status(200).json({
        success: true,
        count: hospitals.length,
        hospitals
      });
      
    } catch (error: any) {
      console.error('Search hospitals error:', error);
      
      res.status(500).json({ 
        error: 'Search error',
        message: 'Could not search hospitals' 
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}

// ==================== EXPORT ====================
const hospitalController = new HospitalController();
export const hospitalRoutes = hospitalController.getRouter();