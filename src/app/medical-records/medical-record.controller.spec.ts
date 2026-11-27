import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';
import { UserService } from '../users/user.service';
import { UserRepository } from '../users/user.repository';
import { MedicalRecordRepository } from './medical-record.repository';
import { DatabaseService } from '../../database/database.service';
import { UserRole } from '../users/user.model';

// Mock ONLY the dependencies that the controller uses
jest.mock('../../database/database.service');
jest.mock('./medical-record.repository');
jest.mock('../users/user.repository');
jest.mock('./medical-record.service');
jest.mock('../users/user.service');

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

// Mock authenticate and authorize from user.controller
jest.mock('../users/user.controller', () => ({
    authenticate: jest.fn((req: any, res: any, next: any) => {
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
        } else {
            res.status(401).json({ error: 'Invalid token' });
        }
    }),
    
    authorize: (roles: UserRole[]) => {
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
    }
}));

// Mock console.error and console.log
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('MedicalRecordController', () => {
    let app: express.Express;
    let medicalRecordServiceMock: jest.Mocked<MedicalRecordService>;
    let userServiceMock: jest.Mocked<UserService>;
    let databaseServiceMock: jest.Mocked<DatabaseService>;

    const createMockMedicalRecord = (overrides = {}) => ({
        id: 1,
        idAppointment: 101,
        date: new Date('2024-01-15T10:00:00Z'),
        idPatient: 1,
        idDoctor: 2,
        idSpeciality: 1,
        description: 'Regular checkup',
        treatment: 'Prescribed medication',
        testResults: ['blood_test.pdf'],
        ...overrides
    });

    const createMockUser = (overrides = {}) => ({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        telephone: '123456789',
        role: UserRole.PATIENT,
        dateBirth: new Date('1990-01-01'),
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock console methods
        console.error = jest.fn();
        console.log = jest.fn();

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        // Create mock services
        medicalRecordServiceMock = {
            getPatientMedicalRecords: jest.fn(),
            getMedicalRecordById: jest.fn(),
            getDoctorMedicalRecords: jest.fn(),
            createMedicalRecord: jest.fn(),
            updateTestResults: jest.fn(),
            updateTreatment: jest.fn(),
            getMedicalRecords: jest.fn(),
            searchMedicalRecordsByPatientName: jest.fn(),
            updateMedicalRecord: jest.fn()
        } as unknown as jest.Mocked<MedicalRecordService>;

        userServiceMock = {
            getUserById: jest.fn()
        } as unknown as jest.Mocked<UserService>;

        // Mock constructors
        const MedicalRecordServiceClass = require('./medical-record.service').MedicalRecordService;
        const UserServiceClass = require('../users/user.service').UserService;
        const MedicalRecordRepositoryClass = require('./medical-record.repository').MedicalRecordRepository;
        const UserRepositoryClass = require('../users/user.repository').UserRepository;

        const { Container } = require('typedi');
        (Container.get as jest.Mock).mockReturnValue(databaseServiceMock);

        (MedicalRecordRepositoryClass as jest.Mock).mockImplementation(() => {
            return { db: databaseServiceMock };
        });

        (UserRepositoryClass as jest.Mock).mockImplementation(() => {
            return { db: databaseServiceMock };
        });

        (MedicalRecordServiceClass as jest.Mock).mockImplementation(() => medicalRecordServiceMock);
        (UserServiceClass as jest.Mock).mockImplementation(() => userServiceMock);

        const medicalRecordController = new MedicalRecordController();

        app = express();
        app.use(express.json());
        app.use('/api/medical-records', medicalRecordController.getRouter());
    });

    afterEach(() => {
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
    });

    // ==================== PATIENT ROUTES TESTS ====================
    describe('Patient Routes', () => {
        describe('GET /api/medical-records - Get My Medical Records', () => {
            it('should return patient medical records when authenticated as patient', async () => {
                const mockRecords = [createMockMedicalRecord()];
                medicalRecordServiceMock.getPatientMedicalRecords.mockResolvedValue(mockRecords);

                const response = await request(app)
                    .get('/api/medical-records')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(1);
                expect(response.body.medicalRecords[0].id).toBe(1);
                expect(medicalRecordServiceMock.getPatientMedicalRecords).toHaveBeenCalledWith(1);
            });

            it('should return 403 when not a patient', async () => {
                const response = await request(app)
                    .get('/api/medical-records')
                    .set('Authorization', 'Bearer doctor-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });

            it('should return 500 on internal error', async () => {
                medicalRecordServiceMock.getPatientMedicalRecords.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/medical-records')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
                expect(console.error).toHaveBeenCalledWith('Get my medical records error:', expect.any(Error));
            });
        });

        describe('GET /api/medical-records/:id - Get My Medical Record', () => {
            it('should return patient medical record when authenticated and authorized', async () => {
                const mockRecord = createMockMedicalRecord();
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(mockRecord);

                const response = await request(app)
                    .get('/api/medical-records/1')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.medicalRecord.id).toBe(1);
                expect(medicalRecordServiceMock.getMedicalRecordById).toHaveBeenCalledWith(1);
            });

            it('should return 400 when ID is invalid', async () => {
                const response = await request(app)
                    .get('/api/medical-records/invalid')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid ID');
            });

            it('should return 404 when medical record not found', async () => {
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/medical-records/999')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Medical record not found');
            });

            it('should return 403 when patient tries to access another patient record', async () => {
                const mockRecord = createMockMedicalRecord({ idPatient: 999 }); // Different patient
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(mockRecord);

                const response = await request(app)
                    .get('/api/medical-records/1')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });
    });

    // ==================== DOCTOR ROUTES TESTS ====================
    describe('Doctor Routes', () => {
        describe('GET /api/medical-records/doctor/records - Get Doctor Medical Records', () => {
            it('should return doctor medical records when authenticated as doctor', async () => {
                const mockRecords = [createMockMedicalRecord()];
                medicalRecordServiceMock.getDoctorMedicalRecords.mockResolvedValue(mockRecords);

                const response = await request(app)
                    .get('/api/medical-records/doctor/records')
                    .set('Authorization', 'Bearer doctor-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(1);
                expect(medicalRecordServiceMock.getDoctorMedicalRecords).toHaveBeenCalledWith(2);
            });

            it('should return 403 when not a doctor', async () => {
                const response = await request(app)
                    .get('/api/medical-records/doctor/records')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('POST /api/medical-records/doctor/ - Create Medical Record', () => {
            const validMedicalRecordData = {
                idAppointment: 101,
                idPatient: 1,
                idSpeciality: 1,
                description: 'Regular checkup',
                treatment: 'Prescribed medication',
                testResults: ['blood_test.pdf']
            };

            it('should create medical record when authenticated as doctor', async () => {
                medicalRecordServiceMock.createMedicalRecord.mockResolvedValue(1);
                userServiceMock.getUserById
                    .mockResolvedValueOnce(createMockUser({ id: 2, name: 'Dr. Smith', role: UserRole.DOCTOR }))
                    .mockResolvedValueOnce(createMockUser({ id: 1, name: 'John Doe', role: UserRole.PATIENT }));
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(createMockMedicalRecord());

                const response = await request(app)
                    .post('/api/medical-records/doctor/')
                    .set('Authorization', 'Bearer doctor-token')
                    .send(validMedicalRecordData);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.message).toBe('Medical record created successfully');
                expect(response.body.id).toBe(1);
                expect(medicalRecordServiceMock.createMedicalRecord).toHaveBeenCalledWith({
                    ...validMedicalRecordData,
                    idDoctor: 2
                });
            });

            it('should return 400 when required fields are missing', async () => {
                const invalidData = {
                    idAppointment: 101,
                    idPatient: 1
                    // Missing other required fields
                };

                const response = await request(app)
                    .post('/api/medical-records/doctor/')
                    .set('Authorization', 'Bearer doctor-token')
                    .send(invalidData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Missing data');
            });

            it('should return 409 when medical record already exists for appointment', async () => {
                medicalRecordServiceMock.createMedicalRecord.mockRejectedValue(
                    new Error('Medical record already exists for this appointment')
                );

                const response = await request(app)
                    .post('/api/medical-records/doctor/')
                    .set('Authorization', 'Bearer doctor-token')
                    .send(validMedicalRecordData);

                expect(response.status).toBe(409);
                expect(response.body.error).toBe('Record exists');
                // Verify console.error was called
                expect(console.error).toHaveBeenCalledWith(
                    'Create medical record error:', 
                    expect.any(Error)
                );
            });

            it('should return 400 on general creation error', async () => {
                medicalRecordServiceMock.createMedicalRecord.mockRejectedValue(
                    new Error('Database error')
                );

                const response = await request(app)
                    .post('/api/medical-records/doctor/')
                    .set('Authorization', 'Bearer doctor-token')
                    .send(validMedicalRecordData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Creation error');
            });
        });

        describe('PUT /api/medical-records/doctor/:id/tests - Update Test Results', () => {
            const validTestResults = ['blood_test.pdf', 'xray.pdf'];

            it('should update test results when authenticated as doctor and authorized', async () => {
                const mockRecord = createMockMedicalRecord({ idDoctor: 2 });
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(mockRecord);
                medicalRecordServiceMock.updateTestResults.mockResolvedValue(true);

                const response = await request(app)
                    .put('/api/medical-records/doctor/1/tests')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({ testResults: validTestResults });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(medicalRecordServiceMock.updateTestResults).toHaveBeenCalledWith(1, validTestResults);
                // Verify console.log was called for notification
                expect(console.log).toHaveBeenCalledWith(
                    expect.stringContaining('[NOTIFICATION] Test results updated:')
                );
            });

            it('should return 400 when testResults is not an array', async () => {
                const response = await request(app)
                    .put('/api/medical-records/doctor/1/tests')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({ testResults: 'not-an-array' });

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
            });

            it('should return 403 when doctor tries to update another doctor record', async () => {
                const mockRecord = createMockMedicalRecord({ idDoctor: 999 }); // Different doctor
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(mockRecord);

                const response = await request(app)
                    .put('/api/medical-records/doctor/1/tests')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({ testResults: validTestResults });

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('PUT /api/medical-records/doctor/:id/treatment - Update Treatment', () => {
            it('should update treatment when authenticated as doctor and authorized', async () => {
                const mockRecord = createMockMedicalRecord({ idDoctor: 2 });
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(mockRecord);
                medicalRecordServiceMock.updateTreatment.mockResolvedValue(true);

                const response = await request(app)
                    .put('/api/medical-records/doctor/1/treatment')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({ treatment: 'Updated treatment plan' });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(medicalRecordServiceMock.updateTreatment).toHaveBeenCalledWith(1, 'Updated treatment plan');
                // Verify console.log was called for notification
                expect(console.log).toHaveBeenCalledWith(
                    expect.stringContaining('[NOTIFICATION] Treatment updated:')
                );
            });

            it('should return 400 when treatment is empty', async () => {
                const response = await request(app)
                    .put('/api/medical-records/doctor/1/treatment')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({ treatment: '' });

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid data');
            });
        });
    });

    // ==================== ADMIN ROUTES TESTS ====================
    describe('Admin Routes', () => {
        describe('GET /api/medical-records/admin/all - Get All Medical Records', () => {
            it('should return all medical records when authenticated as admin', async () => {
                const mockRecords = [createMockMedicalRecord()];
                medicalRecordServiceMock.getMedicalRecords.mockResolvedValue(mockRecords);

                const response = await request(app)
                    .get('/api/medical-records/admin/all')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(1);
                expect(medicalRecordServiceMock.getMedicalRecords).toHaveBeenCalled();
            });

            it('should apply query filters when provided', async () => {
                const mockRecords = [createMockMedicalRecord()];
                medicalRecordServiceMock.getMedicalRecords.mockResolvedValue(mockRecords);

                const response = await request(app)
                    .get('/api/medical-records/admin/all?idPatient=1&idDoctor=2')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(medicalRecordServiceMock.getMedicalRecords).toHaveBeenCalledWith(
                    expect.objectContaining({
                        idPatient: 1,
                        idDoctor: 2
                    })
                );
            });

            it('should return 403 when not an admin', async () => {
                const response = await request(app)
                    .get('/api/medical-records/admin/all')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });
        
        describe('GET /api/medical-records/admin/:id - Get Medical Record Admin', () => {
            it('should return medical record when authenticated as admin', async () => {
                const mockRecord = createMockMedicalRecord();
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(mockRecord);

                const response = await request(app)
                    .get('/api/medical-records/admin/1')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.medicalRecord.id).toBe(1);
                expect(medicalRecordServiceMock.getMedicalRecordById).toHaveBeenCalledWith(1);
            });

            it('should return 400 when ID is invalid', async () => {
                const response = await request(app)
                    .get('/api/medical-records/admin/invalid')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid ID');
            });

            it('should return 404 when medical record not found', async () => {
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/medical-records/admin/999')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Medical record not found');
            });
        });

        describe('GET /api/medical-records/admin/search - Search Medical Records', () => {
            it('should search medical records by patient name when admin', async () => {
                const mockRecords = [createMockMedicalRecord()];
                medicalRecordServiceMock.searchMedicalRecordsByPatientName.mockResolvedValue(mockRecords);

                const response = await request(app)
                    .get('/api/medical-records/admin/search')
                    .query({ name: 'John' })
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(1);
                expect(response.body.medicalRecords[0].id).toBe(1);
                expect(medicalRecordServiceMock.searchMedicalRecordsByPatientName).toHaveBeenCalledWith('John');
            });

            it('should return 400 when name is not provided', async () => {
                const response = await request(app)
                    .get('/api/medical-records/admin/search')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Missing data');
                expect(response.body.message).toBe('Patient name is required for search');
            });

            it('should return 403 when not an admin', async () => {
                const response = await request(app)
                    .get('/api/medical-records/admin/search')
                    .query({ name: 'John' })
                    .set('Authorization', 'Bearer doctor-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('PUT /api/medical-records/admin/:id - Update Medical Record', () => {
            const updateData = {
                description: 'Updated description',
                treatment: 'Updated treatment',
                testResults: ['updated_test.pdf']
            };

            it('should update medical record when authenticated as admin', async () => {
                medicalRecordServiceMock.updateMedicalRecord.mockResolvedValue(true);
                medicalRecordServiceMock.getMedicalRecordById.mockResolvedValue(createMockMedicalRecord());

                const response = await request(app)
                    .put('/api/medical-records/admin/1')
                    .set('Authorization', 'Bearer admin-token')
                    .send(updateData);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(medicalRecordServiceMock.updateMedicalRecord).toHaveBeenCalledWith(1, updateData);
                // Verify console.log was called for notification
                expect(console.log).toHaveBeenCalledWith(
                    expect.stringContaining('[NOTIFICATION] Admin updated medical record:')
                );
            });

            it('should return 400 when no data provided for update', async () => {
                const response = await request(app)
                    .put('/api/medical-records/admin/1')
                    .set('Authorization', 'Bearer admin-token')
                    .send({});

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('No changes');
            });

            it('should return 404 when medical record not found', async () => {
                medicalRecordServiceMock.updateMedicalRecord.mockResolvedValue(false);

                const response = await request(app)
                    .put('/api/medical-records/admin/999')
                    .set('Authorization', 'Bearer admin-token')
                    .send(updateData);

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Medical record not found');
            });
        });
    });
});