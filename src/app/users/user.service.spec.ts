import 'reflect-metadata';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Container } from 'typedi';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { UserRole, DoctorSearchFilters } from './user.model';
import { DatabaseService } from '../../database/database.service';
import { AppointmentRepository } from '../appointments/appointment.repository';
import { AppointmentService } from '../appointments/appointment.service';

// Mock dependencies
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../database/database.service');
jest.mock('../appointments/appointment.repository');
jest.mock('../appointments/appointment.service');

// Mock Container.get for DatabaseService
jest.mock('typedi', () => ({
    Container: {
        get: jest.fn(),
        set: jest.fn(),
        reset: jest.fn()
    },
    Service: () => (target: any) => target
}));

describe('UserService', () => {
    let userService: UserService;
    let userRepositoryMock: jest.Mocked<UserRepository>;
    let appointmentServiceMock: jest.Mocked<AppointmentService>;
    let databaseServiceMock: jest.Mocked<DatabaseService>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock UserRepository
        userRepositoryMock = {
            findByEmail: jest.fn(),
            createPatient: jest.fn(),
            createDoctor: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            findAll: jest.fn(),
            findDoctorsBySpecialty: jest.fn(),
            findDoctorsByHospital: jest.fn()
        } as unknown as jest.Mocked<UserRepository>;

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        // Create mock AppointmentService
        appointmentServiceMock = {
            getAppointmentSettings: jest.fn()
        } as unknown as jest.Mocked<AppointmentService>;

        // Mock Container.get to return our mock DatabaseService
        const { Container } = require('typedi');
        (Container.get as jest.Mock).mockReturnValue(databaseServiceMock);

        // Mock AppointmentService constructor to return our mock
        (AppointmentService as jest.Mock).mockImplementation(() => appointmentServiceMock);

        userService = new UserService(userRepositoryMock);
    });

    describe('registerPatient', () => {
        it('should register patient with hashed password', async () => {
            const date = new Date('1990-01-01');
            const patientData = {
                name: 'John Doe',
                email: 'john@example.com',
                password: 'password123',
                telephone: '123456789',
                dateBirth: date
            };

            userRepositoryMock.findByEmail.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword123');
            userRepositoryMock.createPatient.mockResolvedValue(5);

            const result = await userService.registerPatient(patientData);

            expect(userRepositoryMock.findByEmail).toHaveBeenCalledWith('john@example.com');
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
            expect(userRepositoryMock.createPatient).toHaveBeenCalledWith({
                ...patientData,
                password: 'hashedpassword123',
                role: UserRole.PATIENT
            });
            expect(result).toBe(5);
        });

        it('should throw error when email already registered', async () => {
            const date = new Date('1990-01-01');
            const patientData = {
                name: 'John Doe',
                email: 'john@example.com',
                password: 'password123',
                telephone: '123456789',
                dateBirth: date
            };

            userRepositoryMock.findByEmail.mockResolvedValue({
                id: 1,
                email: 'john@example.com',
                name: 'Existing User',
                role: UserRole.PATIENT
            } as any);

            await expect(userService.registerPatient(patientData))
                .rejects.toThrow('Email already registered');
        });
    });

    describe('registerDoctor', () => {
        it('should register doctor with validated availability', async () => {
            const date = new Date('1980-05-15');
            const doctorData = {
                name: 'Dr. Smith',
                email: 'smith@example.com',
                password: 'password123',
                telephone: '987654321',
                dateBirth: date,
                specialty: 'Cardiology',
                idHospital: 1,
                availability: [
                    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
                ]
            };

            userRepositoryMock.findByEmail.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword123');

            // Mock appointment settings validation
            appointmentServiceMock.getAppointmentSettings.mockResolvedValue({
                id: 1,
                startTime: '09:00',
                endTime: '18:00',
                duration: 20
            });

            userRepositoryMock.createDoctor.mockResolvedValue(6);

            const result = await userService.registerDoctor(doctorData);

            expect(userRepositoryMock.findByEmail).toHaveBeenCalledWith('smith@example.com');
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
            expect(appointmentServiceMock.getAppointmentSettings).toHaveBeenCalled();
            expect(userRepositoryMock.createDoctor).toHaveBeenCalledWith({
                ...doctorData,
                password: 'hashedpassword123',
                role: UserRole.DOCTOR
            });
            expect(result).toBe(6);
        });

        it('should throw error when availability is invalid', async () => {
            const date = new Date('1980-05-15');
            const doctorData = {
                name: 'Dr. Smith',
                email: 'smith@example.com',
                password: 'password123',
                telephone: '987654321',
                dateBirth: date,
                specialty: 'Cardiology',
                idHospital: 1,
                availability: [
                    { dayOfWeek: 1, startTime: '07:00', endTime: '19:00' } // Outside allowed hours
                ]
            };

            userRepositoryMock.findByEmail.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword123');

            appointmentServiceMock.getAppointmentSettings.mockResolvedValue({
                id: 1,
                startTime: '09:00',
                endTime: '18:00',
                duration: 20
            });

            await expect(userService.registerDoctor(doctorData))
                .rejects.toThrow('Start time (07:00) is before system opening time (09:00)');
        });
    });

    describe('login', () => {
        it('should return token and user without password on successful login', async () => {
            const credentials = {
                email: 'john@example.com',
                password: 'password123'
            };

            const mockUser = {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                password: 'hashedpassword123',
                telephone: '123456789',
                role: UserRole.PATIENT,
                dateBirth: '1990-01-01'
            };

            userRepositoryMock.findByEmail.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (jwt.sign as jest.Mock).mockReturnValue('jwt-token-123');

            const result = await userService.login(credentials);

            expect(userRepositoryMock.findByEmail).toHaveBeenCalledWith('john@example.com');
            expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword123');
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 1, role: UserRole.PATIENT },
                expect.any(String),
                { expiresIn: expect.any(String) }
            );
            expect(result.token).toBe('jwt-token-123');
            expect(result.user.id).toBe(1);
            expect(result.user).not.toHaveProperty('password');
        });

        it('should throw error when user not found', async () => {
            const credentials = {
                email: 'nonexistent@example.com',
                password: 'password123'
            };

            userRepositoryMock.findByEmail.mockResolvedValue(null);

            await expect(userService.login(credentials))
                .rejects.toThrow('User not found');
        });

        it('should throw error when password is incorrect', async () => {
            const credentials = {
                email: 'john@example.com',
                password: 'wrongpassword'
            };

            const mockUser = {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                password: 'hashedpassword123',
                telephone: '123456789',
                role: UserRole.PATIENT,
                dateBirth: '1990-01-01'
            };

            userRepositoryMock.findByEmail.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(userService.login(credentials))
                .rejects.toThrow('Invalid credentials');
        });
    });

    describe('updateProfile', () => {
        it('should update user profile with hashed password if provided', async () => {
            const updates = {
                name: 'Updated Name',
                password: 'newpassword123'
            };

            (bcrypt.hash as jest.Mock).mockResolvedValue('hashednewpassword');
            userRepositoryMock.update.mockResolvedValue(true);

            const result = await userService.updateProfile(1, updates);

            expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
            expect(userRepositoryMock.update).toHaveBeenCalledWith(1, {
                name: 'Updated Name',
                password: 'hashednewpassword'
            });
            expect(result).toBe(true);
        });

        it('should update user profile without password if not provided', async () => {
            const updates = {
                name: 'Updated Name',
                telephone: '999999999'
            };

            userRepositoryMock.update.mockResolvedValue(true);

            const result = await userService.updateProfile(1, updates);

            expect(bcrypt.hash).not.toHaveBeenCalled();
            expect(userRepositoryMock.update).toHaveBeenCalledWith(1, updates);
            expect(result).toBe(true);
        });
    });

    describe('getUserById', () => {
        it('should return user without password', async () => {
            const mockUser = {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                password: 'hashedpassword123',
                telephone: '123456789',
                role: UserRole.PATIENT,
                dateBirth: '1990-01-01'
            };

            userRepositoryMock.findById.mockResolvedValue(mockUser);

            const result = await userService.getUserById(1);

            expect(userRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(result).toEqual({
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                telephone: '123456789',
                role: UserRole.PATIENT,
                dateBirth: '1990-01-01'
            });
            expect(result).not.toHaveProperty('password');
        });

        it('should return null when user not found', async () => {
            userRepositoryMock.findById.mockResolvedValue(null);

            const result = await userService.getUserById(999);

            expect(result).toBeNull();
        });
    });

    describe('getAllUsers', () => {
        it('should return all users without passwords', async () => {
            const mockUsers = [
                {
                    id: 1,
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'hashed1',
                    telephone: '123456789',
                    role: UserRole.PATIENT,
                    dateBirth: '1990-01-01'
                },
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    password: 'hashed2',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: '1980-05-15',
                    specialty: 'Cardiology',
                    idHospital: 1
                }
            ];

            userRepositoryMock.findAll.mockResolvedValue(mockUsers);

            const result = await userService.getAllUsers();

            expect(userRepositoryMock.findAll).toHaveBeenCalledWith(undefined);
            expect(result).toHaveLength(2);
            result.forEach(user => {
                expect(user).not.toHaveProperty('password');
            });
        });

        it('should filter users by role', async () => {
            const mockUsers = [
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    password: 'hashed2',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: '1980-05-15',
                    specialty: 'Cardiology',
                    idHospital: 1
                }
            ];

            userRepositoryMock.findAll.mockResolvedValue(mockUsers);

            const result = await userService.getAllUsers(UserRole.DOCTOR);

            expect(userRepositoryMock.findAll).toHaveBeenCalledWith(UserRole.DOCTOR);
            expect(result).toHaveLength(1);
            expect(result[0].role).toBe(UserRole.DOCTOR);
        });
    });

    describe('getDoctorsBySpecialty', () => {
        it('should return doctors by specialty without passwords', async () => {
            const date = new Date('1980-05-15');
            const mockDoctors = [
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    password: 'hashedpassword',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: date,
                    specialty: 'Cardiology',
                    idHospital: 1
                }
            ];

            userRepositoryMock.findDoctorsBySpecialty.mockResolvedValue(mockDoctors);

            const result = await userService.getDoctorsBySpecialty('Cardiology');

            expect(userRepositoryMock.findDoctorsBySpecialty).toHaveBeenCalledWith('Cardiology');
            expect(result).toHaveLength(1);
            expect(result[0].specialty).toBe('Cardiology');
            expect(result[0]).not.toHaveProperty('password');
        });
    });

    describe('getDoctorsByHospital', () => {
        it('should return doctors by hospital without passwords', async () => {
            const date = new Date('1980-05-15');
            const mockDoctors = [
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    password: 'hashedpassword',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: date,
                    specialty: 'Cardiology',
                    idHospital: 1
                }
            ];

            userRepositoryMock.findDoctorsByHospital.mockResolvedValue(mockDoctors);

            const result = await userService.getDoctorsByHospital(1);

            expect(userRepositoryMock.findDoctorsByHospital).toHaveBeenCalledWith(1);
            expect(result).toHaveLength(1);
            expect(result[0].idHospital).toBe(1);
            expect(result[0]).not.toHaveProperty('password');
        });
    });

    describe('searchDoctors', () => {
        it('should filter doctors by name', async () => {
            const date1 = new Date('1980-05-15');
            const date2 = new Date('1975-03-20');
            const mockDoctors = [
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: date1,
                    specialty: 'Cardiology',
                    idHospital: 1,
                    availability: []
                },
                {
                    id: 3,
                    name: 'Dr. Johnson',
                    email: 'johnson@example.com',
                    telephone: '111111111',
                    role: UserRole.DOCTOR,
                    dateBirth: date2,
                    specialty: 'Neurology',
                    idHospital: 1,
                    availability: []
                }
            ];

            // Mock getDoctors to return all doctors
            jest.spyOn(userService, 'getDoctors').mockResolvedValue(mockDoctors);

            const filters: DoctorSearchFilters = {
                name: 'Smith'
            };

            const result = await userService.searchDoctors(filters);

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Dr. Smith');
        });

        it('should filter doctors by specialty', async () => {
            const date1 = new Date('1980-05-15');
            const date2 = new Date('1975-03-20');
            const mockDoctors = [
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: date1,
                    specialty: 'Cardiology',
                    idHospital: 1,
                    availability: []
                },
                {
                    id: 3,
                    name: 'Dr. Johnson',
                    email: 'johnson@example.com',
                    telephone: '111111111',
                    role: UserRole.DOCTOR,
                    dateBirth: date2,
                    specialty: 'Neurology',
                    idHospital: 1,
                    availability: []
                }
            ];

            jest.spyOn(userService, 'getDoctors').mockResolvedValue(mockDoctors);

            const filters: DoctorSearchFilters = {
                specialty: 'Cardiology'
            };

            const result = await userService.searchDoctors(filters);

            expect(result).toHaveLength(1);
            expect(result[0].specialty).toBe('Cardiology');
        });

        it('should return empty array when no doctors match filters', async () => {
            const date = new Date('1980-05-15');
            const mockDoctors = [
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: date,
                    specialty: 'Cardiology',
                    idHospital: 1,
                    availability: []
                }
            ];

            jest.spyOn(userService, 'getDoctors').mockResolvedValue(mockDoctors);

            const filters: DoctorSearchFilters = {
                specialty: 'NonExistentSpecialty'
            };

            const result = await userService.searchDoctors(filters);

            expect(result).toHaveLength(0);
        });
    });

    describe('updateDoctorAvailability', () => {
        it('should update doctor availability when doctor exists', async () => {
            const mockDoctor = {
                id: 2,
                name: 'Dr. Smith',
                email: 'smith@example.com',
                password: 'hashedpassword',
                telephone: '987654321',
                role: UserRole.DOCTOR,
                dateBirth: '1980-05-15',
                specialty: 'Cardiology',
                idHospital: 1
            };

            const availability = [
                { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
            ];

            userRepositoryMock.findById.mockResolvedValue(mockDoctor);
            appointmentServiceMock.getAppointmentSettings.mockResolvedValue({
                id: 1,
                startTime: '09:00',
                endTime: '18:00',
                duration: 20
            });
            userRepositoryMock.update.mockResolvedValue(true);

            const result = await userService.updateDoctorAvailability(2, availability);

            expect(userRepositoryMock.findById).toHaveBeenCalledWith(2);
            expect(appointmentServiceMock.getAppointmentSettings).toHaveBeenCalled();
            expect(userRepositoryMock.update).toHaveBeenCalledWith(2, { availability });
            expect(result).toBe(true);
        });

        it('should throw error when user is not a doctor', async () => {
            const mockPatient = {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                password: 'hashedpassword',
                telephone: '123456789',
                role: UserRole.PATIENT,
                dateBirth: '1990-01-01'
            };

            userRepositoryMock.findById.mockResolvedValue(mockPatient);

            await expect(userService.updateDoctorAvailability(1, []))
                .rejects.toThrow('Doctor not found');
        });

        it('should throw error when user not found', async () => {
            userRepositoryMock.findById.mockResolvedValue(null);

            await expect(userService.updateDoctorAvailability(999, []))
                .rejects.toThrow('Doctor not found');
        });
    });
});