import { Router, Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import { DatabaseService } from '../../database/database.service';
import { LogRepository } from './log.repository';
import { LogService } from './log.service';
import { UserRole } from '../users/user.model';
import { authenticate, authorize } from '../users/user.controller';
import { Log, LogQueryParams } from './log.model';

export class LogController {
  private router: Router;
  private logService: LogService;

  constructor() {
    this.router = Router();
    const dbService = Container.get(DatabaseService);
    const logRepository = new LogRepository(dbService);
    this.logService = new LogService(logRepository);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // ========== ADMIN ROUTES ONLY ==========
    this.router.get('/', authenticate, authorize([UserRole.ADMIN]), this.getAllLogs.bind(this));
    this.router.get('/:id', authenticate, authorize([UserRole.ADMIN]), this.getLogById.bind(this));
  }

  // ========== HANDLERS ==========

  private async getAllLogs(req: Request, res: Response): Promise<void> {
    try {
      const { 
        idUser, 
        action, 
        resource,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;
      
      const query: LogQueryParams = {
        idUser: idUser ? parseInt(String(idUser)) : undefined,
        action: action as string,
        resource: resource as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: parseInt(String(page)),
        limit: parseInt(String(limit))
      };
      
      const logs = await this.logService.getAllLogs(query);
      
      res.status(200).json({
        success: true,
        count: logs.length,
        logs
      });
      
    } catch (error: any) {
      console.error('Get all logs error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve logs' 
      });
    }
  }

  private async getLogById(req: Request, res: Response): Promise<void> {
    try {
      const logId = parseInt(String(req.params.id));
      
      if (isNaN(logId) || logId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'Log ID must be a positive number' 
        });
        return;
      }
      
      const log = await this.logService.getLogById(logId);
      
      if (!log) {
        res.status(404).json({ 
          error: 'Log not found',
          message: `Log with ID ${logId} not found` 
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        log
      });
      
    } catch (error: any) {
      console.error('Get log by ID error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve log' 
      });
    }
  }

  // ========== MIDDLEWARE ==========
  
  public static createLogMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Execute request handler first
      next();
      
      // Create log after response is sent
      res.on('finish', async () => {
        try {
          const user = (req as any).user;
          
          // Only log autenticated users' actions
          if (!user || !user.id) return;
          
          // Not log log retrieval actions
          if (req.path.includes('/logs') && req.method === 'GET') return;
          
          const dbService = Container.get(DatabaseService);
          const logRepository = new LogRepository(dbService);
          const logService = new LogService(logRepository);
          
          // Set Action
          let action = 'VIEW';
          switch (req.method) {
            case 'POST': action = 'CREATE'; break;
            case 'PUT': 
            case 'PATCH': action = 'UPDATE'; break;
            case 'DELETE': action = 'DELETE'; break;
          }
          
          // Set Resource
          let resource = 'OTHER';
          const path = req.path.toLowerCase();
          
          if (path.includes('users')) {
            resource = 'USER';
          } else if (path.includes('appointments')) {
            resource = 'APPOINTMENT';
          } else if (path.includes('medical-records')) {
            resource = 'MEDICAL_RECORD';
          } else if (path.includes('hospitals')) {
            resource = 'HOSPITAL';
          } else if (path.includes('auth') || path.includes('login')) {
            resource = 'AUTH';
          }
          
          // Create log entry
          logService.createLog({
            idUser: user.id,
            action,
            resource,
            details: `${req.method} ${req.path} - Status: ${res.statusCode}`
          }).catch(error => {
            console.error('Failed to save log:', error);
          });
          
        } catch (error) {
          console.error('Log middleware error:', error);
        }
      });
    };
  }

  public getRouter(): Router {
    return this.router;
  }
}

// ==================== EXPORT ====================
const logController = new LogController();
export const logRoutes = logController.getRouter();
export const logMiddleware = LogController.createLogMiddleware();