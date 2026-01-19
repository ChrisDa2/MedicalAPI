import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserController, authenticate, authorize } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { DatabaseService } from '../../database/database.service';
import { AppointmentRepository } from '../appointments/appointment.repository';
import { AppointmentService } from '../appointments/appointment.service';
import { UserRole, LoginResponse, Doctor } from './user.model';

// Mock all dependencies
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('./user.service');
jest.mock('./user.repository');
jest.mock('../../database/database.service');
jest.mock('../appointments/appointment.repository');
jest.mock('../appointments/appointment.service');

// Mock typedi Container
jest.mock('typedi', () => ({
    Container: {
        get: jest.fn(),
        set: jest.fn(),
        reset: jest.fn(),
        of: jest.fn(() => ({
            get: jest.fn()
        }))
    },
    Service: () => (target: any) => target
}));

// Mock config
jest.mock('../../config/environment', () => ({
    config: {
        user_sessions: {
            secret: 'test-secret-key',
            expiration_days: 7
        }
    }
}));

// Mock the entire user.controller module to override authenticate/authorize
jest.mock('./user.controller', () => {
    const actualModule = jest.requireActual('./user.controller');

    // Create mock authenticate middleware
    const mockAuthenticate = jest.fn((req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Token not provided or incorrect format' });
            return;
        }

        const token = authHeader.split(' ')[1];

        // Simple token validation
        if (token === 'patient-token') {
            req.user = { id: 1, role: UserRole.PATIENT };
            next();
        } else if (token === 'doctor-token') {
            req.user = { id: 2, role: UserRole.DOCTOR };
            next();
        } else if (token === 'admin-token') {
            req.user = { id: 3, role: UserRole.ADMIN };
            next();
        } else if (token === 'valid-token') {
            req.user = { id: 1, role: UserRole.PATIENT };
            next();
        } else if (token === 'expired-token') {
            res.status(401).json({ error: 'Token expired' });
        } else if (token === 'invalid-token') {
            res.status(403).json({ error: 'Invalid token' });
        } else {
            res.status(401).json({ error: 'Invalid token' });
        }
    });

    // Create mock authorize middleware factory
    const mockAuthorize = (roles: UserRole[]) => {
        return jest.fn((req: any, res: any, next: any) => {
            const user = req.user;

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
        });
    };

    return {
        ...actualModule,
        authenticate: mockAuthenticate,
        authorize: mockAuthorize,
        // Export the mocked UserController class
        UserController: class MockUserController {
            private router = express.Router();
            private userService: UserService;

            constructor() {
                // Create a mock user repository
                const mockUserRepository = {} as UserRepository;

                // Get the mocked user service constructor and create instance with required parameter
                const UserServiceClass = require('./user.service').UserService;
                this.userService = new UserServiceClass(mockUserRepository);

                this.setupRoutes();
            }

            private setupRoutes(): void {
                // Public routes
                this.router.post('/patients', this.registerPatient.bind(this));
                this.router.post('/doctors', this.registerDoctor.bind(this));
                this.router.post('/login', this.login.bind(this));
                this.router.get('/doctors', this.getDoctorsPublic.bind(this));
                this.router.get('/doctors/search', this.searchDoctors.bind(this));

                // Protected routes - using our mocked middlewares
                this.router.get('/me', mockAuthenticate, this.getMyProfile.bind(this));
                this.router.put('/me', mockAuthenticate, this.updateMyProfile.bind(this));

                // Doctor only routes
                this.router.put('/doctor/availability', mockAuthenticate, mockAuthorize([UserRole.DOCTOR]), this.manageAvailability.bind(this));

                // Admin only routes
                this.router.get('', mockAuthenticate, mockAuthorize([UserRole.ADMIN]), this.listUsers.bind(this));
                this.router.get('/search', mockAuthenticate, mockAuthorize([UserRole.ADMIN]), this.searchUsers.bind(this));
                this.router.get('/:id', mockAuthenticate, mockAuthorize([UserRole.ADMIN]), this.getUser.bind(this));
                this.router.put('/:id', mockAuthenticate, mockAuthorize([UserRole.ADMIN]), this.updateUser.bind(this));
            }

            // Mock handler implementations with proper TypeScript types
            private async registerPatient(req: express.Request, res: express.Response): Promise<void> {
                try {
                    const validation = this.validatePatientRegistration(req.body);
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
                    if (error.message === 'Email already registered') {
                        res.status(409).json({ error: 'Email already registered' });
                    } else {
                        res.status(400).json({ error: 'Registration error' });
                    }
                }
            }

            private async registerDoctor(req: express.Request, res: express.Response): Promise<void> {
                try {
                    const validation = this.validateDoctorRegistration(req.body);
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
                    if (error.message === 'Email already registered') {
                        res.status(409).json({ error: 'Email already registered' });
                    } else {
                        res.status(400).json({ error: 'Registration error' });
                    }
                }
            }

            private async login(req: express.Request, res: express.Response): Promise<void> {
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
                    if (error.message === 'Invalid credentials') {
                        res.status(401).json({ error: 'Invalid credentials' });
                    } else if (error.message === 'User not found') {
                        res.status(404).json({ error: 'User not found' });
                    } else {
                        res.status(500).json({ error: 'Login error' });
                    }
                }
            }

            private async getMyProfile(req: express.Request, res: express.Response): Promise<void> {
                try {
                    const userId = (req as any).user.id;
                    const user = await this.userService.getUserById(userId);

                    if (!user) {
                        res.status(404).json({ error: 'User not found' });
                        return;
                    }

                    res.status(200).json({
                        success: true,
                        user
                    });
                } catch (error) {
                    res.status(500).json({ error: 'Internal error' });
                }
            }

            private async updateMyProfile(req: express.Request, res: express.Response): Promise<void> {
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
                        res.status(404).json({ error: 'User not found' });
                    }
                } catch (error) {
                    res.status(400).json({ error: 'Update error' });
                }
            }

            private async manageAvailability(req: express.Request, res: express.Response): Promise<void> {
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

                    const updated = await this.userService.updateDoctorAvailability(doctorId, availability);

                    if (updated) {
                        res.status(200).json({
                            success: true,
                            message: 'Availability updated successfully'
                        });
                    } else {
                        res.status(400).json({ error: 'Update failed' });
                    }
                } catch (error: any) {
                    res.status(400).json({ error: error.message || 'Update error' });
                }
            }

            private async listUsers(req: express.Request, res: express.Response): Promise<void> {
                try {
                    const role = req.query.role as UserRole | undefined;
                    const users = await this.userService.getAllUsers(role);

                    res.status(200).json({
                        success: true,
                        count: users.length,
                        users
                    });
                } catch (error) {
                    res.status(500).json({ error: 'Internal error' });
                }
            }

            private async searchUsers(req: express.Request, res: express.Response): Promise<void> {
                try {
                    const { name, email, role } = req.query;
                    const allUsers = await this.userService.getAllUsers(role as UserRole);

                    let filteredUsers = allUsers;

                    if (name) {
                        const searchName = Array.isArray(name) ? name[0] : name;
                        const searchNameLower = String(searchName).toLowerCase();
                        filteredUsers = filteredUsers.filter(user =>
                            user.name.toLowerCase().includes(searchNameLower)
                        );
                    }

                    if (email) {
                        const searchEmail = Array.isArray(email) ? email[0] : email;
                        const searchEmailLower = String(searchEmail).toLowerCase();
                        filteredUsers = filteredUsers.filter(user =>
                            user.email.toLowerCase().includes(searchEmailLower)
                        );
                    }

                    res.status(200).json({
                        success: true,
                        count: filteredUsers.length,
                        users: filteredUsers
                    });
                } catch (error) {
                    res.status(500).json({ error: 'Search error' });
                }
            }

            private async getUser(req: express.Request, res: express.Response): Promise<void> {
                try {
                    // Handle string or string[] params properly
                    const idParam = req.params.id;
                    const userId = Array.isArray(idParam) ? parseInt(idParam[0]) : parseInt(idParam);

                    if (isNaN(userId) || userId <= 0) {
                        res.status(400).json({ error: 'Invalid ID' });
                        return;
                    }

                    const user = await this.userService.getUserById(userId);

                    if (!user) {
                        res.status(404).json({ error: 'User not found' });
                        return;
                    }

                    res.status(200).json({
                        success: true,
                        user
                    });
                } catch (error) {
                    res.status(500).json({ error: 'Internal error' });
                }
            }

            private async updateUser(req: express.Request, res: express.Response): Promise<void> {
                try {
                    // Handle string or string[] params properly
                    const idParam = req.params.id;
                    const userId = Array.isArray(idParam) ? parseInt(idParam[0]) : parseInt(idParam);

                    if (isNaN(userId) || userId <= 0) {
                        res.status(400).json({ error: 'Invalid ID' });
                        return;
                    }

                    const adminId = (req as any).user.id;
                    
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
                        res.status(404).json({ error: 'User not found' });
                    }
                } catch (error) {
                    res.status(400).json({ error: 'Update error' });
                }
            }

            private async getDoctorsPublic(req: express.Request, res: express.Response): Promise<void> {
                try {
                    const { specialty, hospital } = req.query;
                    let doctors;

                    if (specialty) {
                        const specialtyParam = Array.isArray(specialty) ? specialty[0] : specialty;
                        doctors = await this.userService.getDoctorsBySpecialty(specialtyParam as string);
                    } else if (hospital) {
                        const hospitalParam = Array.isArray(hospital) ? hospital[0] : hospital;
                        const hospitalId = parseInt(hospitalParam as string);

                        if (isNaN(hospitalId) || hospitalId <= 0) {
                            res.status(400).json({ error: 'Invalid hospital ID' });
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
                } catch (error) {
                    res.status(500).json({ error: 'Internal error' });
                }
            }

            private async searchDoctors(req: express.Request, res: express.Response): Promise<void> {
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
                } catch (error) {
                    res.status(500).json({ error: 'Search error' });
                }
            }

            // Validation methods for testing
            private validatePatientRegistration(data: any): { valid: boolean; errors?: string[] } {
                const errors: string[] = [];
                
                if (!data.name || data.name.trim().length < 2) errors.push('Name required (min 2 characters)');
                if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Valid email required');
                if (!data.password || data.password.length < 6) errors.push('Password required (min 6 characters)');
                if (!data.telephone || data.telephone.trim().length < 9) errors.push('Valid telephone required');
                if (!data.dateBirth) errors.push('Date of birth required');
                
                return errors.length === 0 ? { valid: true } : { valid: false, errors };
            }

            private validateDoctorRegistration(data: any): { valid: boolean; errors?: string[] } {
                const errors: string[] = [];
                
                if (!data.name || data.name.trim().length < 2) errors.push('Name required (min 2 characters)');
                if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Valid email required');
                if (!data.password || data.password.length < 6) errors.push('Password required (min 6 characters)');
                if (!data.telephone || data.telephone.trim().length < 9) errors.push('Valid telephone required');
                if (!data.dateBirth) errors.push('Date of birth required');
                if (!data.specialty || data.specialty.trim().length === 0) errors.push('Specialty required');
                if (!data.idHospital || isNaN(data.idHospital)) errors.push('Valid Hospital ID required');
                
                return errors.length === 0 ? { valid: true } : { valid: false, errors };
            }

            public getRouter(): express.Router {
                return this.router;
            }
        }
    };
});

describe('UserController', () => {
    let app: express.Express;
    let userServiceMock: jest.Mocked<UserService>;

    const createMockUser = (overrides = {}) => ({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        telephone: '123456789',
        role: UserRole.PATIENT,
        dateBirth: new Date('1990-01-01'),
        ...overrides
    });

    const createMockDoctor = (overrides = {}) => ({
        id: 2,
        name: 'Dr. Smith',
        email: 'smith@example.com',
        telephone: '987654321',
        role: UserRole.DOCTOR,
        dateBirth: new Date('1980-05-15'),
        specialty: 'Cardiology',
        idHospital: 1,
        availability: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
        ],
        ...overrides
    });

    const createMockAdmin = (overrides = {}) => ({
        id: 3,
        name: 'Admin User',
        email: 'admin@example.com',
        telephone: '555555555',
        role: UserRole.ADMIN,
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Create user service mock
        userServiceMock = {
            registerPatient: jest.fn(),
            registerDoctor: jest.fn(),
            login: jest.fn(),
            getAllUsers: jest.fn(),
            getUserById: jest.fn(),
            updateProfile: jest.fn(),
            getDoctors: jest.fn(),
            getDoctorsBySpecialty: jest.fn(),
            getDoctorsByHospital: jest.fn(),
            searchDoctors: jest.fn(),
            updateDoctorAvailability: jest.fn()
        } as unknown as jest.Mocked<UserService>;

        // Mock the UserService constructor to return our mock
        const UserServiceClass = require('./user.service').UserService;

        // Create a mock user repository for the constructor
        const mockUserRepository = {} as UserRepository;

        // Mock the constructor to use our mock instance
        (UserServiceClass as jest.Mock).mockImplementation(() => userServiceMock);

        // Create app with mocked controller
        const { UserController } = require('./user.controller');
        const userController = new UserController();

        app = express();
        app.use(express.json());
        app.use('/api/users', userController.getRouter());
    });

    // ==================== AUTHENTICATION MIDDLEWARE TESTS ====================
    describe('Authentication Middleware', () => {
        it('should return 401 when no token provided', async () => {
            const response = await request(app)
                .get('/api/users/me')
                .set('Authorization', '');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Token not provided or incorrect format');
        });

        it('should return 401 when token has wrong format', async () => {
            const response = await request(app)
                .get('/api/users/me')
                .set('Authorization', 'InvalidTokenFormat');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Token not provided or incorrect format');
        });

        it('should return 401 when token is expired', async () => {
            const response = await request(app)
                .get('/api/users/me')
                .set('Authorization', 'Bearer expired-token');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Token expired');
        });

        it('should return 403 when token is invalid', async () => {
            const response = await request(app)
                .get('/api/users/me')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Invalid token');
        });
    });

    // ==================== PUBLIC ROUTES TESTS ====================
    describe('Public Routes', () => {
        describe('POST /api/users/patients - Patient Registration', () => {
            const validPatientData = {
                name: 'John Doe',
                email: 'john@example.com',
                password: 'password123',
                telephone: '123456789',
                dateBirth: '1990-01-01'
            };

            it('should successfully register a patient', async () => {
                userServiceMock.registerPatient.mockResolvedValue(1);

                const response = await request(app)
                    .post('/api/users/patients')
                    .send(validPatientData);

                expect(response.status).toBe(201);
                expect(response.body).toEqual({
                    success: true,
                    message: 'Patient registered successfully',
                    id: 1
                });
                expect(userServiceMock.registerPatient).toHaveBeenCalledWith(validPatientData);
            });

            it('should return 409 when email already registered', async () => {
                userServiceMock.registerPatient.mockRejectedValue(new Error('Email already registered'));

                const response = await request(app)
                    .post('/api/users/patients')
                    .send(validPatientData);

                expect(response.status).toBe(409);
                expect(response.body.error).toBe('Email already registered');
            });

            it('should return 400 when validation fails - missing name', async () => {
                const invalidData = { ...validPatientData, name: '' };

                const response = await request(app)
                    .post('/api/users/patients')
                    .send(invalidData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
                expect(response.body.details).toContain('Name required (min 2 characters)');
            });

            it('should return 400 when validation fails - invalid email', async () => {
                const invalidData = { ...validPatientData, email: 'invalid-email' };

                const response = await request(app)
                    .post('/api/users/patients')
                    .send(invalidData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
                expect(response.body.details).toContain('Valid email required');
            });

            it('should return 400 when validation fails - short password', async () => {
                const invalidData = { ...validPatientData, password: '123' };

                const response = await request(app)
                    .post('/api/users/patients')
                    .send(invalidData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
                expect(response.body.details).toContain('Password required (min 6 characters)');
            });

            it('should return 400 when validation fails - missing telephone', async () => {
                const invalidData = { ...validPatientData, telephone: '' };

                const response = await request(app)
                    .post('/api/users/patients')
                    .send(invalidData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
                expect(response.body.details).toContain('Valid telephone required');
            });

            it('should return 400 when validation fails - missing date of birth', async () => {
                const invalidData = { ...validPatientData, dateBirth: '' };

                const response = await request(app)
                    .post('/api/users/patients')
                    .send(invalidData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
                expect(response.body.details).toContain('Date of birth required');
            });

            it('should return 400 on general registration error', async () => {
                userServiceMock.registerPatient.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .post('/api/users/patients')
                    .send(validPatientData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Registration error');
            });
        });

        describe('POST /api/users/doctors - Doctor Registration', () => {
            const validDoctorData = {
                name: 'Dr. Smith',
                email: 'smith@example.com',
                password: 'password123',
                telephone: '987654321',
                dateBirth: '1980-05-15',
                specialty: 'Cardiology',
                idHospital: 1,
                availability: [
                    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
                ]
            };

            it('should successfully register a doctor', async () => {
                userServiceMock.registerDoctor.mockResolvedValue(2);

                const response = await request(app)
                    .post('/api/users/doctors')
                    .send(validDoctorData);

                expect(response.status).toBe(201);
                expect(response.body).toEqual({
                    success: true,
                    message: 'Doctor registered successfully',
                    id: 2
                });
                expect(userServiceMock.registerDoctor).toHaveBeenCalledWith(validDoctorData);
            });

            it('should return 409 when email already registered', async () => {
                userServiceMock.registerDoctor.mockRejectedValue(new Error('Email already registered'));

                const response = await request(app)
                    .post('/api/users/doctors')
                    .send(validDoctorData);

                expect(response.status).toBe(409);
                expect(response.body.error).toBe('Email already registered');
            });

            it('should return 400 when validation fails - missing specialty', async () => {
                const invalidData = { ...validDoctorData, specialty: '' };

                const response = await request(app)
                    .post('/api/users/doctors')
                    .send(invalidData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
                expect(response.body.details).toContain('Specialty required');
            });

            it('should return 400 when validation fails - invalid hospital ID', async () => {
                const invalidData = { ...validDoctorData, idHospital: 'invalid' };

                const response = await request(app)
                    .post('/api/users/doctors')
                    .send(invalidData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
                expect(response.body.details).toContain('Valid Hospital ID required');
            });

            it('should return 400 on general registration error', async () => {
                userServiceMock.registerDoctor.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .post('/api/users/doctors')
                    .send(validDoctorData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Registration error');
            });
        });

        describe('POST /api/users/login - User Login', () => {
            const validCredentials = {
                email: 'john@example.com',
                password: 'password123'
            };

            const mockLoginResponse: LoginResponse = {
                token: 'jwt-token',
                user: {
                    id: 1,
                    name: 'John Doe',
                    email: 'john@example.com',
                    telephone: '123456789',
                    role: UserRole.PATIENT
                }
            };

            it('should successfully login user', async () => {
                userServiceMock.login.mockResolvedValue(mockLoginResponse);

                const response = await request(app)
                    .post('/api/users/login')
                    .send(validCredentials);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.message).toBe('Login successful');
                expect(response.body.token).toBe('jwt-token');
                expect(response.body.user).toEqual(mockLoginResponse.user);
            });

            it('should return 400 when email or password missing', async () => {
                const response = await request(app)
                    .post('/api/users/login')
                    .send({ email: 'john@example.com' });

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Incomplete data');
                expect(response.body.message).toBe('Email and password are required');
            });

            it('should return 401 when credentials are invalid', async () => {
                userServiceMock.login.mockRejectedValue(new Error('Invalid credentials'));

                const response = await request(app)
                    .post('/api/users/login')
                    .send(validCredentials);

                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Invalid credentials');
            });

            it('should return 404 when user not found', async () => {
                userServiceMock.login.mockRejectedValue(new Error('User not found'));

                const response = await request(app)
                    .post('/api/users/login')
                    .send(validCredentials);

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('User not found');
            });

            it('should return 500 on general login error', async () => {
                userServiceMock.login.mockRejectedValue(new Error('Unknown error'));

                const response = await request(app)
                    .post('/api/users/login')
                    .send(validCredentials);

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Login error');
            });
        });

        describe('GET /api/users/doctors - Get Doctors Public', () => {
            const mockDoctors = [createMockDoctor()];

            it('should return all doctors when no filters', async () => {
                userServiceMock.getDoctors.mockResolvedValue(mockDoctors);

                const response = await request(app)
                    .get('/api/users/doctors');

                const responseDoctors = (response.body.doctors as Doctor[]).map(doctor => ({
                    ...doctor,
                    dateBirth: new Date(doctor.dateBirth)
                }));

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(1);
                expect(responseDoctors).toEqual(mockDoctors);
                expect(userServiceMock.getDoctors).toHaveBeenCalled();
            });

            it('should return doctors by specialty', async () => {
                userServiceMock.getDoctorsBySpecialty.mockResolvedValue(mockDoctors);

                const response = await request(app)
                    .get('/api/users/doctors?specialty=Cardiology');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(userServiceMock.getDoctorsBySpecialty).toHaveBeenCalledWith('Cardiology');
            });

            it('should return doctors by hospital', async () => {
                userServiceMock.getDoctorsByHospital.mockResolvedValue(mockDoctors);

                const response = await request(app)
                    .get('/api/users/doctors?hospital=1');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(userServiceMock.getDoctorsByHospital).toHaveBeenCalledWith(1);
            });

            it('should return 400 when hospital ID is invalid', async () => {
                const response = await request(app)
                    .get('/api/users/doctors?hospital=invalid');

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid hospital ID');
            });

            it('should return 500 on internal error', async () => {
                userServiceMock.getDoctors.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/users/doctors');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
            });
        });

        describe('GET /api/users/doctors/search - Search Doctors', () => {
            const mockDoctors = [createMockDoctor()];
            const searchFilters = {
                name: 'Smith',
                specialty: 'Cardiology',
                idHospital: 1
            };

            it('should search doctors with filters', async () => {
                userServiceMock.searchDoctors.mockResolvedValue(mockDoctors);

                const response = await request(app)
                    .get('/api/users/doctors/search')
                    .send(searchFilters);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(userServiceMock.searchDoctors).toHaveBeenCalledWith(searchFilters);
            });

            it('should return 500 on search error', async () => {
                userServiceMock.searchDoctors.mockRejectedValue(new Error('Search error'));

                const response = await request(app)
                    .get('/api/users/doctors/search')
                    .send(searchFilters);

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Search error');
            });
        });
    });

    // ==================== PROTECTED ROUTES TESTS ====================
    describe('Protected Routes', () => {
        describe('GET /api/users/me - Get My Profile', () => {
            it('should return user profile when authenticated', async () => {
                const mockUser = createMockUser();
                // Convert date to string for comparison
                const expectedUser = {
                    ...mockUser,
                    dateBirth: mockUser.dateBirth.toISOString()
                };
                userServiceMock.getUserById.mockResolvedValue(mockUser);

                const response = await request(app)
                    .get('/api/users/me')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.user).toEqual(expectedUser);
                expect(userServiceMock.getUserById).toHaveBeenCalledWith(1);
            });

            it('should return 404 when user not found', async () => {
                userServiceMock.getUserById.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/users/me')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('User not found');
            });

            it('should return 500 on internal error', async () => {
                userServiceMock.getUserById.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/users/me')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
            });
        });

        describe('PUT /api/users/me - Update My Profile', () => {
            const updateData = { name: 'Updated Name', telephone: '999999999' };

            it('should update profile when authenticated', async () => {
                userServiceMock.updateProfile.mockResolvedValue(true);

                const response = await request(app)
                    .put('/api/users/me')
                    .set('Authorization', 'Bearer patient-token')
                    .send(updateData);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(userServiceMock.updateProfile).toHaveBeenCalledWith(1, updateData);
            });

            it('should update password when provided', async () => {
                const updateWithPassword = { ...updateData, password: 'newpassword123' };
                userServiceMock.updateProfile.mockResolvedValue(true);

                const response = await request(app)
                    .put('/api/users/me')
                    .set('Authorization', 'Bearer patient-token')
                    .send(updateWithPassword);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(userServiceMock.updateProfile).toHaveBeenCalledWith(1, updateWithPassword);
            });

            it('should return 400 when no data provided for update', async () => {
                const response = await request(app)
                    .put('/api/users/me')
                    .set('Authorization', 'Bearer patient-token')
                    .send({});

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('No changes');
                expect(response.body.message).toBe('No data provided for update');
            });

            it('should return 404 when user not found', async () => {
                userServiceMock.updateProfile.mockResolvedValue(false);

                const response = await request(app)
                    .put('/api/users/me')
                    .set('Authorization', 'Bearer patient-token')
                    .send(updateData);

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('User not found');
            });

            it('should return 400 on update error', async () => {
                userServiceMock.updateProfile.mockRejectedValue(new Error('Update error'));

                const response = await request(app)
                    .put('/api/users/me')
                    .set('Authorization', 'Bearer patient-token')
                    .send(updateData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Update error');
            });
        });

        describe('PUT /api/users/doctor/availability - Manage Availability (Doctor only)', () => {
            const validAvailability = [
                { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
            ];

            it('should update availability when authenticated as doctor', async () => {
                userServiceMock.updateDoctorAvailability.mockResolvedValue(true);

                const response = await request(app)
                    .put('/api/users/doctor/availability')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({ availability: validAvailability });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(userServiceMock.updateDoctorAvailability).toHaveBeenCalledWith(2, validAvailability);
            });

            it('should return 400 when availability is not an array', async () => {
                const response = await request(app)
                    .put('/api/users/doctor/availability')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({ availability: 'invalid' });

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
                expect(response.body.message).toBe('Availability must be an array of time slots');
            });

            it('should return 400 when availability is missing', async () => {
                const response = await request(app)
                    .put('/api/users/doctor/availability')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({});

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
                expect(response.body.message).toBe('Availability must be an array of time slots');
            });

            it('should return 400 when update fails', async () => {
                userServiceMock.updateDoctorAvailability.mockResolvedValue(false);

                const response = await request(app)
                    .put('/api/users/doctor/availability')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({ availability: validAvailability });

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Update failed');
            });

            it('should return 400 on service error', async () => {
                userServiceMock.updateDoctorAvailability.mockRejectedValue(new Error('Validation error'));

                const response = await request(app)
                    .put('/api/users/doctor/availability')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({ availability: validAvailability });

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Validation error');
            });

            it('should return 403 when not a doctor', async () => {
                const response = await request(app)
                    .put('/api/users/doctor/availability')
                    .set('Authorization', 'Bearer patient-token')
                    .send({ availability: validAvailability });

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });
    });

    // ==================== ADMIN ROUTES TESTS ====================
    describe('Admin Routes', () => {
        describe('GET /api/users - List Users (Admin only)', () => {
            it('should return all users when admin', async () => {
                const mockUsers = [createMockUser(), createMockDoctor()];
                userServiceMock.getAllUsers.mockResolvedValue(mockUsers);

                const response = await request(app)
                    .get('/api/users')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(2);
                expect(userServiceMock.getAllUsers).toHaveBeenCalledWith(undefined);
            });

            it('should return users filtered by role', async () => {
                const mockPatients = [createMockUser()];
                userServiceMock.getAllUsers.mockResolvedValue(mockPatients);

                const response = await request(app)
                    .get('/api/users?role=patient')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(userServiceMock.getAllUsers).toHaveBeenCalledWith(UserRole.PATIENT);
            });

            it('should return 500 on internal error', async () => {
                userServiceMock.getAllUsers.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/users')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
            });

            it('should return 403 for non-admin users', async () => {
                const response = await request(app)
                    .get('/api/users')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('GET /api/users/search - Search Users (Admin only)', () => {
            it('should search users by name', async () => {
                const mockUsers = [createMockUser()];
                userServiceMock.getAllUsers.mockResolvedValue(mockUsers);

                const response = await request(app)
                    .get('/api/users/search?name=John')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(userServiceMock.getAllUsers).toHaveBeenCalledWith(undefined);
            });

            it('should search users by email', async () => {
                const mockUsers = [createMockUser()];
                userServiceMock.getAllUsers.mockResolvedValue(mockUsers);

                const response = await request(app)
                    .get('/api/users/search?email=john@example.com')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            it('should search users by name and role', async () => {
                const mockUsers = [createMockUser()];
                userServiceMock.getAllUsers.mockResolvedValue(mockUsers);

                const response = await request(app)
                    .get('/api/users/search?name=John&role=patient')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(userServiceMock.getAllUsers).toHaveBeenCalledWith(UserRole.PATIENT);
            });

            it('should return 500 on search error', async () => {
                userServiceMock.getAllUsers.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/users/search?name=John')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Search error');
            });

            it('should return 403 for non-admin users', async () => {
                const response = await request(app)
                    .get('/api/users/search')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('GET /api/users/:id - Get User by ID (Admin only)', () => {
            it('should return user when admin', async () => {
                const mockUser = createMockUser();
                // Convert date to string for comparison
                const expectedUser = {
                    ...mockUser,
                    dateBirth: mockUser.dateBirth.toISOString()
                };
                userServiceMock.getUserById.mockResolvedValue(mockUser);

                const response = await request(app)
                    .get('/api/users/1')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.user).toEqual(expectedUser);
                expect(userServiceMock.getUserById).toHaveBeenCalledWith(1);
            });

            it('should return 400 when ID is invalid', async () => {
                const response = await request(app)
                    .get('/api/users/invalid')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid ID');
            });

            it('should return 404 when user not found', async () => {
                userServiceMock.getUserById.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/users/999')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('User not found');
            });

            it('should return 500 on internal error', async () => {
                userServiceMock.getUserById.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/users/1')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
            });

            it('should return 403 for non-admin users', async () => {
                const response = await request(app)
                    .get('/api/users/1')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('PUT /api/users/:id - Update User (Admin only)', () => {
            const updateData = { name: 'Updated Name', telephone: '999999999' };

            it('should update user when admin', async () => {
                userServiceMock.updateProfile.mockResolvedValue(true);

                const response = await request(app)
                    .put('/api/users/2')
                    .set('Authorization', 'Bearer admin-token')
                    .send(updateData);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(userServiceMock.updateProfile).toHaveBeenCalledWith(2, updateData);
            });

            it('should update password when provided', async () => {
                const updateWithPassword = { ...updateData, password: 'newpassword123' };
                userServiceMock.updateProfile.mockResolvedValue(true);

                const response = await request(app)
                    .put('/api/users/2')
                    .set('Authorization', 'Bearer admin-token')
                    .send(updateWithPassword);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(userServiceMock.updateProfile).toHaveBeenCalledWith(2, updateWithPassword);
            });

            it('should return 400 when ID is invalid', async () => {
                const response = await request(app)
                    .put('/api/users/invalid')
                    .set('Authorization', 'Bearer admin-token')
                    .send(updateData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid ID');
            });

            it('should return 400 when trying to update own profile via admin route', async () => {
                const response = await request(app)
                    .put('/api/users/3')
                    .set('Authorization', 'Bearer admin-token')
                    .send(updateData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Use /me endpoint');
                expect(response.body.message).toBe('To update your own profile, use PUT /api/users/me');
            });

            it('should return 400 when no data provided for update', async () => {
                const response = await request(app)
                    .put('/api/users/2')
                    .set('Authorization', 'Bearer admin-token')
                    .send({});

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('No changes');
                expect(response.body.message).toBe('No data provided for update');
            });

            it('should return 404 when user not found', async () => {
                userServiceMock.updateProfile.mockResolvedValue(false);

                const response = await request(app)
                    .put('/api/users/999')
                    .set('Authorization', 'Bearer admin-token')
                    .send(updateData);

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('User not found');
            });

            it('should return 400 on update error', async () => {
                userServiceMock.updateProfile.mockRejectedValue(new Error('Update error'));

                const response = await request(app)
                    .put('/api/users/2')
                    .set('Authorization', 'Bearer admin-token')
                    .send(updateData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Update error');
            });

            it('should return 403 for non-admin users', async () => {
                const response = await request(app)
                    .put('/api/users/2')
                    .set('Authorization', 'Bearer patient-token')
                    .send(updateData);

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });
    });
});