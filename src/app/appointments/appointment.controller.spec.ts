import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import { Container } from 'typedi';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { UserService } from '../users/user.service';
import { AppointmentRepository } from './appointment.repository';
import { UserRepository } from '../users/user.repository';
import { DatabaseService } from '../../database/database.service';
import { AppointmentStatus } from './appointment.model'; // Importar solo AppointmentStatus desde aquí
import { UserRole } from '../users/user.model'; // Importar UserRole desde user.model

// Mock all dependencies
jest.mock('./appointment.service');
jest.mock('../users/user.service');
jest.mock('./appointment.repository');
jest.mock('../users/user.repository');
jest.mock('../../database/database.service');

// Mock console.error and console.log
global.console.error = jest.fn();
global.console.log = jest.fn();

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

// Mock the entire user.controller module to override authenticate/authorize
jest.mock('../users/user.controller', () => {
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
        } else if (token === 'patient2-token') {
            req.user = { id: 4, role: UserRole.PATIENT };
            next();
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
        authenticate: mockAuthenticate,
        authorize: mockAuthorize
    };
});

describe('AppointmentController', () => {
    let app: express.Express;
    let appointmentServiceMock: jest.Mocked<AppointmentService>;
    let userServiceMock: jest.Mocked<UserService>;

    const createMockAppointment = (overrides = {}) => ({
        id: 1,
        date: new Date('2024-01-20T10:00:00'),
        idPatient: 1,
        idDoctor: 2,
        idSpeciality: 1,
        location: 'Room 101',
        status: AppointmentStatus.SCHEDULED,
        ...overrides
    });

    const createMockUser = (overrides = {}) => ({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        telephone: '123456789',
        role: UserRole.PATIENT,
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
        ...overrides
    });

    const mockAppointmentSettings = {
        id: 1,
        startTime: '09:00',
        endTime: '18:00',
        duration: 20
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});

        // Create service mocks
        appointmentServiceMock = {
            getPatientAppointments: jest.fn(),
            createAppointment: jest.fn(),
            getAppointmentById: jest.fn(),
            rescheduleAppointment: jest.fn(),
            cancelAppointment: jest.fn(),
            getDoctorAppointments: jest.fn(),
            completeAppointment: jest.fn(),
            getAppointments: jest.fn(),
            getAppointmentSettings: jest.fn(),
            updateAppointmentSettings: jest.fn()
        } as unknown as jest.Mocked<AppointmentService>;

        userServiceMock = {
            getUserById: jest.fn()
        } as unknown as jest.Mocked<UserService>;

        // Mock Container.get to return our mock DatabaseService
        const { Container } = require('typedi');
        
        // Mock service constructors
        const AppointmentServiceClass = require('./appointment.service').AppointmentService;
        const UserServiceClass = require('../users/user.service').UserService;
        
        (AppointmentServiceClass as jest.Mock).mockImplementation(() => appointmentServiceMock);
        (UserServiceClass as jest.Mock).mockImplementation(() => userServiceMock);

        // Create app with controller
        const { AppointmentController } = require('./appointment.controller');
        const appointmentController = new AppointmentController();

        app = express();
        app.use(express.json());
        app.use('/api/appointments', appointmentController.getRouter());
    });

    afterEach(() => {
        (console.error as jest.Mock).mockRestore();
        (console.log as jest.Mock).mockRestore();
    });

    // ==================== PATIENT ROUTES TESTS ====================
    describe('Patient Routes', () => {
        describe('GET /api/appointments - Get My Appointments', () => {
            it('should return patient appointments when authenticated', async () => {
                const mockAppointments = [createMockAppointment()];
                appointmentServiceMock.getPatientAppointments.mockResolvedValue(mockAppointments);

                const response = await request(app)
                    .get('/api/appointments')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(1);
                expect(response.body.appointments[0].id).toBe(1);
                expect(appointmentServiceMock.getPatientAppointments).toHaveBeenCalledWith(1);
            });

            it('should return 500 on internal error', async () => {
                appointmentServiceMock.getPatientAppointments.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/appointments')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
            });

            it('should return 403 for non-patient users', async () => {
                const response = await request(app)
                    .get('/api/appointments')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('POST /api/appointments - Create Appointment', () => {
            const validAppointmentData = {
                idDoctor: 2,
                date: '2024-01-20T10:00:00',
                idSpeciality: 1,
                location: 'Room 101'
            };

            it('should create appointment with valid data', async () => {
                appointmentServiceMock.createAppointment.mockResolvedValue(1);
                userServiceMock.getUserById.mockResolvedValueOnce(createMockDoctor());
                userServiceMock.getUserById.mockResolvedValueOnce(createMockUser());

                const response = await request(app)
                    .post('/api/appointments')
                    .set('Authorization', 'Bearer patient-token')
                    .send(validAppointmentData);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.id).toBe(1);
                expect(appointmentServiceMock.createAppointment).toHaveBeenCalledWith({
                    idPatient: 1,
                    idDoctor: 2,
                    date: new Date('2024-01-20T10:00:00'),
                    idSpeciality: 1,
                    location: 'Room 101'
                });
            });

            it('should return 400 when required data is missing', async () => {
                const incompleteData = {
                    idDoctor: 2,
                    date: '2024-01-20T10:00:00'
                    // Missing idSpeciality and location
                };

                const response = await request(app)
                    .post('/api/appointments')
                    .set('Authorization', 'Bearer patient-token')
                    .send(incompleteData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Missing data');
            });

            it('should return 409 when doctor is not available', async () => {
                appointmentServiceMock.createAppointment.mockRejectedValue(
                    new Error('Doctor is not available at the selected time')
                );

                const response = await request(app)
                    .post('/api/appointments')
                    .set('Authorization', 'Bearer patient-token')
                    .send(validAppointmentData);

                expect(response.status).toBe(409);
                expect(response.body.error).toBe('Time not available');
            });

            it('should return 400 on other creation errors', async () => {
                appointmentServiceMock.createAppointment.mockRejectedValue(
                    new Error('Invalid time format')
                );

                const response = await request(app)
                    .post('/api/appointments')
                    .set('Authorization', 'Bearer patient-token')
                    .send(validAppointmentData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Creation error');
            });
        });

        describe('GET /api/appointments/:id - Get Appointment', () => {
            it('should return appointment when it belongs to patient', async () => {
                const mockAppointment = createMockAppointment({ idPatient: 1 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);

                const response = await request(app)
                    .get('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.appointment.id).toBe(1);
                expect(appointmentServiceMock.getAppointmentById).toHaveBeenCalledWith(1);
            });

            it('should return 400 when ID is invalid', async () => {
                const response = await request(app)
                    .get('/api/appointments/invalid')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid ID');
            });

            it('should return 404 when appointment not found', async () => {
                appointmentServiceMock.getAppointmentById.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/appointments/999')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Appointment not found');
            });

            it('should return 403 when appointment belongs to another patient', async () => {
                const mockAppointment = createMockAppointment({ idPatient: 4 }); // Different patient
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);

                const response = await request(app)
                    .get('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token'); // Patient ID 1

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });

            it('should return 500 on internal error', async () => {
                appointmentServiceMock.getAppointmentById.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
            });
        });

        describe('PUT /api/appointments/:id - Reschedule Appointment', () => {
            const rescheduleData = {
                date: '2024-01-21T10:00:00'
            };

            it('should reschedule appointment when valid', async () => {
                const mockAppointment = createMockAppointment({ idPatient: 1 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);
                appointmentServiceMock.rescheduleAppointment.mockResolvedValue(true);
                userServiceMock.getUserById.mockResolvedValueOnce(createMockDoctor());
                userServiceMock.getUserById.mockResolvedValueOnce(createMockUser());

                const response = await request(app)
                    .put('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token')
                    .send(rescheduleData);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(appointmentServiceMock.rescheduleAppointment).toHaveBeenCalledWith(
                    1,
                    new Date('2024-01-21T10:00:00')
                );
            });

            it('should return 400 when date is missing', async () => {
                const response = await request(app)
                    .put('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token')
                    .send({});

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Missing data');
            });

            it('should return 409 when doctor is not available', async () => {
                const mockAppointment = createMockAppointment({ idPatient: 1 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);
                appointmentServiceMock.rescheduleAppointment.mockRejectedValue(
                    new Error('Doctor is not available at the selected time')
                );

                const response = await request(app)
                    .put('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token')
                    .send(rescheduleData);

                expect(response.status).toBe(409);
                expect(response.body.error).toBe('Time not available');
            });

            it('should return 400 when trying to reschedule cancelled appointment', async () => {
                const mockAppointment = createMockAppointment({ idPatient: 1 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);
                appointmentServiceMock.rescheduleAppointment.mockRejectedValue(
                    new Error('Cannot reschedule a cancelled appointment')
                );

                const response = await request(app)
                    .put('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token')
                    .send(rescheduleData);

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid operation');
            });

            it('should return 403 when appointment belongs to another patient', async () => {
                const mockAppointment = createMockAppointment({ idPatient: 4 }); // Different patient
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);

                const response = await request(app)
                    .put('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token') // Patient ID 1
                    .send(rescheduleData);

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('DELETE /api/appointments/:id - Cancel Appointment', () => {
            it('should cancel appointment when it belongs to patient', async () => {
                const mockAppointment = createMockAppointment({ idPatient: 1 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);
                appointmentServiceMock.cancelAppointment.mockResolvedValue(true);
                userServiceMock.getUserById.mockResolvedValueOnce(createMockDoctor());
                userServiceMock.getUserById.mockResolvedValueOnce(createMockUser());

                const response = await request(app)
                    .delete('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(204);
                expect(appointmentServiceMock.cancelAppointment).toHaveBeenCalledWith(1);
            });

            it('should return 400 when appointment is already cancelled', async () => {
                const mockAppointment = createMockAppointment({ idPatient: 1 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);
                appointmentServiceMock.cancelAppointment.mockRejectedValue(
                    new Error('Appointment is already cancelled')
                );

                const response = await request(app)
                    .delete('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Already cancelled');
            });

            it('should return 403 when appointment belongs to another patient', async () => {
                const mockAppointment = createMockAppointment({ idPatient: 4 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);

                const response = await request(app)
                    .delete('/api/appointments/1')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });
    });

    // ==================== DOCTOR ROUTES TESTS ====================
    describe('Doctor Routes', () => {
        describe('GET /api/appointments/doctor/schedule - Get Doctor Schedule', () => {
            it('should return doctor appointments when authenticated', async () => {
                const mockAppointments = [createMockAppointment()];
                appointmentServiceMock.getDoctorAppointments.mockResolvedValue(mockAppointments);

                const response = await request(app)
                    .get('/api/appointments/doctor/schedule')
                    .set('Authorization', 'Bearer doctor-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(1);
                expect(appointmentServiceMock.getDoctorAppointments).toHaveBeenCalledWith(2);
            });

            it('should return 500 on internal error', async () => {
                appointmentServiceMock.getDoctorAppointments.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/appointments/doctor/schedule')
                    .set('Authorization', 'Bearer doctor-token');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
            });

            it('should return 403 for non-doctor users', async () => {
                const response = await request(app)
                    .get('/api/appointments/doctor/schedule')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('DELETE /api/appointments/doctor/:id - Cancel Appointment (Doctor)', () => {
            it('should cancel appointment when it belongs to doctor', async () => {
                const mockAppointment = createMockAppointment({ idDoctor: 2 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);
                appointmentServiceMock.cancelAppointment.mockResolvedValue(true);
                userServiceMock.getUserById.mockResolvedValueOnce(createMockDoctor());
                userServiceMock.getUserById.mockResolvedValueOnce(createMockUser());

                const response = await request(app)
                    .delete('/api/appointments/doctor/1')
                    .set('Authorization', 'Bearer doctor-token');

                expect(response.status).toBe(204);
                expect(appointmentServiceMock.cancelAppointment).toHaveBeenCalledWith(1);
            });

            it('should return 403 when appointment belongs to another doctor', async () => {
                const mockAppointment = createMockAppointment({ idDoctor: 3 }); // Different doctor
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);

                const response = await request(app)
                    .delete('/api/appointments/doctor/1')
                    .set('Authorization', 'Bearer doctor-token'); // Doctor ID 2

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('PUT /api/appointments/doctor/:id/complete - Complete Appointment', () => {
            it('should complete appointment when it belongs to doctor', async () => {
                const mockAppointment = createMockAppointment({ idDoctor: 2 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);
                appointmentServiceMock.completeAppointment.mockResolvedValue(true);

                const response = await request(app)
                    .put('/api/appointments/doctor/1/complete')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({});

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(appointmentServiceMock.completeAppointment).toHaveBeenCalledWith(1);
            });

            it('should return 403 when appointment belongs to another doctor', async () => {
                const mockAppointment = createMockAppointment({ idDoctor: 3 });
                appointmentServiceMock.getAppointmentById.mockResolvedValue(mockAppointment);

                const response = await request(app)
                    .put('/api/appointments/doctor/1/complete')
                    .set('Authorization', 'Bearer doctor-token')
                    .send({});

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });
    });

    // ==================== ADMIN ROUTES TESTS ====================
    describe('Admin Routes', () => {
        describe('GET /api/appointments/admin/all - Get All Appointments', () => {
            it('should return all appointments when admin', async () => {
                const mockAppointments = [createMockAppointment()];
                appointmentServiceMock.getAppointments.mockResolvedValue(mockAppointments);

                const response = await request(app)
                    .get('/api/appointments/admin/all')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(appointmentServiceMock.getAppointments).toHaveBeenCalled();
            });

            it('should filter appointments with query parameters', async () => {
                const mockAppointments = [createMockAppointment()];
                appointmentServiceMock.getAppointments.mockResolvedValue(mockAppointments);

                const response = await request(app)
                    .get('/api/appointments/admin/all?idDoctor=2&status=scheduled')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(appointmentServiceMock.getAppointments).toHaveBeenCalled();
            });

            it('should return 403 for non-admin users', async () => {
                const response = await request(app)
                    .get('/api/appointments/admin/all')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('GET /api/appointments/admin/settings - Get Appointment Settings', () => {
            it('should return appointment settings when admin', async () => {
                appointmentServiceMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);

                const response = await request(app)
                    .get('/api/appointments/admin/settings')
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.settings).toEqual(mockAppointmentSettings);
                expect(appointmentServiceMock.getAppointmentSettings).toHaveBeenCalled();
            });

            it('should return 403 for non-admin users', async () => {
                const response = await request(app)
                    .get('/api/appointments/admin/settings')
                    .set('Authorization', 'Bearer patient-token');

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });

        describe('PUT /api/appointments/admin/settings - Update Appointment Settings', () => {
            const validUpdateData = {
                startTime: '10:00',
                endTime: '19:00',
                duration: 30
            };

            const updatedSettings = {
                ...mockAppointmentSettings,
                ...validUpdateData
            };

            it('should update appointment settings when admin', async () => {
                appointmentServiceMock.updateAppointmentSettings.mockResolvedValue(updatedSettings);

                const response = await request(app)
                    .put('/api/appointments/admin/settings')
                    .set('Authorization', 'Bearer admin-token')
                    .send(validUpdateData);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(appointmentServiceMock.updateAppointmentSettings).toHaveBeenCalledWith(validUpdateData);
            });

            it('should return 400 when no data provided', async () => {
                const response = await request(app)
                    .put('/api/appointments/admin/settings')
                    .set('Authorization', 'Bearer admin-token')
                    .send({});

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('No changes');
            });

            it('should return 400 when validation fails', async () => {
                appointmentServiceMock.updateAppointmentSettings.mockRejectedValue(
                    new Error('Invalid startTime format')
                );

                const response = await request(app)
                    .put('/api/appointments/admin/settings')
                    .set('Authorization', 'Bearer admin-token')
                    .send({ startTime: 'invalid' });

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Validation error');
            });

            it('should return 403 for non-admin users', async () => {
                const response = await request(app)
                    .put('/api/appointments/admin/settings')
                    .set('Authorization', 'Bearer patient-token')
                    .send(validUpdateData);

                expect(response.status).toBe(403);
                expect(response.body.error).toBe('Access denied');
            });
        });
    });
});