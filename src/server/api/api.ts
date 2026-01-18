import { Router } from 'express';
import { Service } from 'typedi';
import { userRoutes } from '../../app/users/user.controller';
import { appointmentRoutes } from '../../app/appointments/appointment.controller';
import { medicalRecordRoutes } from '../../app/medical-records/medical-record.controller';

@Service()
export class Api {
  private apiRouter: Router;

  constructor() {
    this.apiRouter = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Routes
    this.apiRouter.use('/users', userRoutes);
    this.apiRouter.use('/appointments', appointmentRoutes);
    this.apiRouter.use('/medical-records', medicalRecordRoutes);
    //this.apiRouter.use('/hospitals', hospitalRoutes);

  }

  getApiRouter(): Router {
    return this.apiRouter;
  }
}