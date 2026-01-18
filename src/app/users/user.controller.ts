import { Router, Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../../database/database.service';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { UserRole } from './user.model';
import { config } from '../../config/environment';
import { AppointmentRepository } from '../appointments/appointment.repository';
import { AppointmentService } from '../appointments/appointment.service';


// ==================== MIDDLEWARE ====================
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  //console.log('\n=== AUTHENTICATE MIDDLEWARE CALLED ===');
  //console.log('Request path:', req.path);
  //console.log('Authorization header:', req.headers.authorization);

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token not provided or incorrect format' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.user_sessions.secret) as { id: number; role: UserRole };
    //console.log('User from token:', decoded);
    (req as any).user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      res.status(403).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Authentication error' });
    }
  }
};

export const authorize = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      if (!roles.includes(user.role)) {
        res.status(403).json({ 
          error: 'Access denied', 
          message: `Required roles: ${roles.join(', ')}` 
        });
        return;
      }
      next();
    } catch (error) {
      res.status(500).json({ error: 'Authorization error' });
    }
  };
};


// ==================== VALIDATION ====================
const validatePatientRegistration = (data: any): { valid: boolean; errors?: string[] } => {
  const errors: string[] = [];
  
  if (!data.name || data.name.trim().length < 2) errors.push('Name required (min 2 characters)');
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Valid email required');
  if (!data.password || data.password.length < 6) errors.push('Password required (min 6 characters)');
  if (!data.telephone || data.telephone.trim().length < 9) errors.push('Valid telephone required');
  if (!data.dateBirth) errors.push('Date of birth required');
  
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
};

const validateDoctorRegistration = (data: any): { valid: boolean; errors?: string[] } => {
  const errors: string[] = [];
  
  if (!data.name || data.name.trim().length < 2) errors.push('Name required (min 2 characters)');
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Valid email required');
  if (!data.password || data.password.length < 6) errors.push('Password required (min 6 characters)');
  if (!data.telephone || data.telephone.trim().length < 9) errors.push('Valid telephone required');
  if (!data.dateBirth) errors.push('Date of birth required');
  if (!data.specialty || data.specialty.trim().length === 0) errors.push('Specialty required');
  if (!data.idHospital || isNaN(data.idHospital)) errors.push('Valid Hospital ID required');
  
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
};


// ==================== CONTROLLER ====================
export class UserController {
  private router: Router;
  private userService: UserService;

  constructor() {
    this.router = Router();
    const dbService = Container.get(DatabaseService);
    const userRepository = new UserRepository(dbService);
    this.userService = new UserService(userRepository);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // ========== PUBLIC ROUTES ==========
    this.router.post('/patients', this.registerPatient.bind(this));
    this.router.post('/doctors', this.registerDoctor.bind(this));
    this.router.post('/login', this.login.bind(this));
    this.router.get('/doctors', this.getDoctorsPublic.bind(this));
    this.router.get('/doctors/search', this.searchDoctors.bind(this));

    // ========== PROTECTED ROUTES ==========
    this.router.get('/me', authenticate, this.getMyProfile.bind(this));
    this.router.put('/me', authenticate, this.updateMyProfile.bind(this));

    // Doctor only routes
    this.router.put('/doctor/availability', authenticate, authorize([UserRole.DOCTOR]), this.manageAvailability.bind(this));

    // Admin only routes
    this.router.get('', authenticate, authorize([UserRole.ADMIN]), this.listUsers.bind(this));
    this.router.get('/search', authenticate, authorize([UserRole.ADMIN]), this.searchUsers.bind(this));
    this.router.get('/:id', authenticate, authorize([UserRole.ADMIN]), this.getUser.bind(this));
    this.router.put('/:id', authenticate, authorize([UserRole.ADMIN]), this.updateUser.bind(this));
  }


  // ========== HANDLERS ==========
  private async registerPatient(req: Request, res: Response): Promise<void> {
    try {
      const validation = validatePatientRegistration(req.body);
      if (!validation.valid) {
        res.status(400).json({ 
          error: 'Invalid data', 
          details: validation.errors 
        });
        return;
      }

      const patientId = await this.userService.registerPatient(req.body);
      
      res.status(201).json({ 
        success: true,
        message: 'Patient registered successfully', 
        id: patientId 
      });
      
    } catch (error: any) {
      console.error('Patient registration error:', error);
      
      if (error.message === 'Email already registered') {
        res.status(409).json({ 
          error: 'Email already registered',
          message: 'The provided email is already in use' 
        });
      } else {
        res.status(400).json({ 
          error: 'Registration error',
          message: error.message || 'Could not register patient' 
        });
      }
    }
  }

  private async registerDoctor(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateDoctorRegistration(req.body);
      if (!validation.valid) {
        res.status(400).json({ 
          error: 'Invalid data', 
          details: validation.errors 
        });
        return;
      }

      const doctorId = await this.userService.registerDoctor(req.body);
      
      res.status(201).json({ 
        success: true,
        message: 'Doctor registered successfully', 
        id: doctorId 
      });
      
    } catch (error: any) {
      console.error('Doctor registration error:', error);
      
      if (error.message === 'Email already registered') {
        res.status(409).json({ 
          error: 'Email already registered',
          message: 'The provided email is already in use' 
        });
      } else {
        res.status(400).json({ 
          error: 'Registration error',
          message: error.message || 'Could not register doctor' 
        });
      }
    }
  }

  private async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        res.status(400).json({ 
          error: 'Incomplete data',
          message: 'Email and password are required' 
        });
        return;
      }

      const result = await this.userService.login({ email, password });
      
      res.status(200).json({
        success: true,
        message: 'Login successful',
        ...result
      });
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message === 'Invalid credentials') {
        res.status(401).json({ 
          error: 'Invalid credentials',
          message: 'Incorrect email or password' 
        });
      } else if (error.message === 'User not found') {
        res.status(404).json({ 
          error: 'User not found',
          message: 'No user found with this email' 
        });
      } else {
        res.status(500).json({ 
          error: 'Login error',
          message: 'Internal server error' 
        });
      }
    }
  }

  private async updateMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { password, ...updates } = req.body;
      
      if (Object.keys(updates).length === 0 && !password) {
        res.status(400).json({ 
          error: 'No changes',
          message: 'No data provided for update' 
        });
        return;
      }
      
      const updateData = password ? { ...updates, password } : updates;
      const updated = await this.userService.updateProfile(userId, updateData);
      
      if (updated) {
        res.status(200).json({ 
          success: true,
          message: 'Your profile updated successfully' 
        });
      } else {
        res.status(404).json({ 
          error: 'User not found',
          message: 'User not found or no changes made' 
        });
      }

    } catch (error: any) {
      console.error('Update my profile error:', error);
      
      res.status(400).json({ 
        error: 'Update error',
        message: error.message || 'Could not update your profile' 
      });
    }
  }

  private async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(String(req.params.id));
      const adminId = (req as any).user.id;
      
      if (isNaN(userId) || userId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'User ID must be a positive number' 
        });
        return;
      }

      // Avoid admin updating own profile via this route
      if (userId === adminId) {
        res.status(400).json({ 
          error: 'Use /me endpoint',
          message: 'To update your own profile, use PUT /api/users/me' 
        });
        return;
      }

      const { password, role, ...updates } = req.body;
      
      if (Object.keys(updates).length === 0 && !password) {
        res.status(400).json({ 
          error: 'No changes',
          message: 'No data provided for update' 
        });
        return;
      }
      
      const updateData = password ? { ...updates, password } : updates;
      const updated = await this.userService.updateProfile(userId, updateData);
      
      if (updated) {
        res.status(200).json({ 
          success: true,
          message: 'User profile updated successfully' 
        });
      } else {
        res.status(404).json({ 
          error: 'User not found',
          message: `User with ID ${userId} not found` 
        });
      }
      
    } catch (error: any) {
      console.error('Update user error:', error);
      
      res.status(400).json({ 
        error: 'Update error',
        message: error.message || 'Could not update user profile' 
      });
    }
  }

  private async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const role = req.query.role as UserRole | undefined;
      const users = await this.userService.getAllUsers(role);
      
      res.status(200).json({
        success: true,
        count: users.length,
        users
      });
      
    } catch (error: any) {
      console.error('List users error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve users' 
      });
    }
  }

  private async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, role } = req.query;
      
      const allUsers = await this.userService.getAllUsers(role as UserRole);
      
      let filteredUsers = allUsers;
      
      if (name) {
        const searchName = (name as string).toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          user.name.toLowerCase().includes(searchName)
        );
      }
      
      if (email) {
        const searchEmail = (email as string).toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          user.email.toLowerCase().includes(searchEmail)
        );
      }
      
      res.status(200).json({
        success: true,
        count: filteredUsers.length,
        users: filteredUsers
      });
      
    } catch (error: any) {
      console.error('Search users error:', error);
      
      res.status(500).json({ 
        error: 'Search error',
        message: 'Could not perform search' 
      });
    }
  }

  private async getUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(String(req.params.id));
      
      if (isNaN(userId) || userId <= 0) {
        res.status(400).json({ 
          error: 'Invalid ID',
          message: 'User ID must be a positive number' 
        });
        return;
      }

      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        res.status(404).json({ 
          error: 'User not found',
          message: `User with ID ${userId} not found` 
        });
        return;
      }

      res.status(200).json({
        success: true,
        user
      });
      
    } catch (error: any) {
      console.error('Get user error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve user' 
      });
    }
  }

  private async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        res.status(404).json({ 
          error: 'User not found',
          message: 'Your user does not exist in the system' 
        });
        return;
      }

      res.status(200).json({
        success: true,
        user
      });
      
    } catch (error: any) {
      console.error('Get my profile error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve your profile' 
      });
    }
  }

  private async getDoctorsPublic(req: Request, res: Response): Promise<void> {
    try {
      const { specialty, hospital } = req.query;
      
      let doctors;
      
      if (specialty) {
        doctors = await this.userService.getDoctorsBySpecialty(specialty as string);
      } else if (hospital) {
        const hospitalId = parseInt(hospital as string);
        
        if (isNaN(hospitalId) || hospitalId <= 0) {
          res.status(400).json({ 
            error: 'Invalid hospital ID',
            message: 'Hospital ID must be a positive number' 
          });
          return;
        }
        
        doctors = await this.userService.getDoctorsByHospital(hospitalId);
      } else {
        doctors = await this.userService.getDoctors();
      }
      
      res.status(200).json({
        success: true,
        count: doctors.length,
        doctors
      });
      
    } catch (error: any) {
      console.error('Get doctors error:', error);
      
      res.status(500).json({ 
        error: 'Internal error',
        message: 'Could not retrieve doctors' 
      });
    }
  }

  private async searchDoctors(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.body;
      
      if (filters && typeof filters !== 'object') {
        res.status(400).json({ 
          error: 'Invalid filters',
          message: 'Filters must be a JSON object' 
        });
        return;
      }

      const doctors = await this.userService.searchDoctors(filters);
      
      res.status(200).json({
        success: true,
        count: doctors.length,
        doctors
      });
      
    } catch (error: any) {
      console.error('Search doctors error:', error);
      
      if (error.message === 'Invalid filter parameters') {
        res.status(400).json({ 
          error: 'Invalid filters',
          message: error.message 
        });
      } else {
        res.status(500).json({ 
          error: 'Search error',
          message: 'Could not perform doctor search' 
        });
      }
    }
  }

  private async manageAvailability(req: Request, res: Response): Promise<void> {
    try {
      const doctorId = (req as any).user.id;
      const { availability } = req.body;
      
      if (!availability || !Array.isArray(availability)) {
        res.status(400).json({ 
          error: 'Invalid data',
          message: 'Availability must be an array of time slots' 
        });
        return;
      }
      
      // Validate each slot
      const validationResult = await this.validateDoctorAvailability(availability);
      if (!validationResult.valid) {
        res.status(400).json({ 
          error: 'Invalid availability',
          message: validationResult.error 
        });
        return;
      }
      
      const updated = await this.userService.updateDoctorAvailability(doctorId, availability);
      
      if (updated) {
        res.status(200).json({ 
          success: true,
          message: 'Availability updated successfully',
          availability 
        });
      } else {
        res.status(400).json({ 
          error: 'Update failed',
          message: 'Could not update availability' 
        });
      }
      
    } catch (error: any) {
      console.error('Manage availability error:', error);
      
      if (error.message.includes('outside allowed hours') || 
          error.message.includes('must be before')) {
        res.status(400).json({ 
          error: 'Validation error',
          message: error.message 
        });
      } else {
        res.status(500).json({ 
          error: 'Update error',
          message: error.message || 'Could not update availability' 
        });
      }
    }
  }

  private async validateDoctorAvailability(availability: any[]): Promise<{ valid: boolean; error?: string }> {
    try {
      // Obtener configuración de appointments
      const dbService = Container.get(DatabaseService);
      const appointmentRepository = new AppointmentRepository(dbService);
      const appointmentService = new AppointmentService(appointmentRepository);
      
      const settings = await appointmentService.getAppointmentSettings();
      const startMinutes = this.timeToMinutes(settings.startTime);
      const endMinutes = this.timeToMinutes(settings.endTime);
      
      for (const slot of availability) {
        if (!slot.dayOfWeek || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
          return {
            valid: false,
            error: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)'
          };
        }
        
        if (!slot.startTime || !this.isValidTimeFormat(slot.startTime)) {
          return {
            valid: false,
            error: `Invalid startTime format: ${slot.startTime}. Use "HH:MM"`
          };
        }
        
        if (!slot.endTime || !this.isValidTimeFormat(slot.endTime)) {
          return {
            valid: false,
            error: `Invalid endTime format: ${slot.endTime}. Use "HH:MM"`
          };
        }
        
        const slotStart = this.timeToMinutes(slot.startTime);
        const slotEnd = this.timeToMinutes(slot.endTime);
        
        if (slotStart < startMinutes || slotEnd > endMinutes) {
          return {
            valid: false,
            error: `Availability slot ${slot.startTime}-${slot.endTime} is outside allowed hours (${settings.startTime}-${settings.endTime})`
          };
        }
        
        // Start time must be before end time
        if (slotStart >= slotEnd) {
          return {
            valid: false,
            error: `Start time must be before end time in slot ${slot.startTime}-${slot.endTime}`
          };
        }
        
        // validate minimum duration
        const slotDuration = slotEnd - slotStart;
        if (slotDuration < settings.duration) {
          return {
            valid: false,
            error: `Slot duration (${slotDuration}min) is less than minimum appointment duration (${settings.duration}min)`
          };
        }
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: 'Error validating availability' };
    }
  }

  private isValidTimeFormat(time: string): boolean {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  public getRouter(): Router {
    return this.router;
  }
}

// ==================== EXPORT ====================
const userController = new UserController();
export const userRoutes = userController.getRouter();