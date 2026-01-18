import { Router } from 'express';
import { Service } from 'typedi';
import { userRoutes } from '../../app/users/user.controller';
import { appointmentRoutes } from '../../app/appointments/appointment.controller';
import { medicalRecordRoutes } from '../../app/medical-records/medical-record.controller';
import { hospitalRoutes } from '../../app/hospitals/hospital.controller';
import { logRoutes, logMiddleware } from '../../app/logs/log.controller';

@Service()
export class Api {
  private apiRouter: Router;

  constructor() {
    this.apiRouter = Router();
    this.setupLogMiddleware();
    this.setupRoutes();
  }

  private setupLogMiddleware(): void {
    this.apiRouter.use(logMiddleware);
  }

  private setupRoutes(): void {
    // Routes
    this.apiRouter.use('/users', userRoutes);
    this.apiRouter.use('/appointments', appointmentRoutes);
    this.apiRouter.use('/medical-records', medicalRecordRoutes);
    this.apiRouter.use('/hospitals', hospitalRoutes);
    this.apiRouter.use('/logs', logRoutes);
  }

  getApiRouter(): Router {
    return this.apiRouter;
  }
}