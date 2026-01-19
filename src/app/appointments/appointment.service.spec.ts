import 'reflect-metadata';
import { Container } from 'typedi';
import { AppointmentService } from './appointment.service';
import { AppointmentRepository } from './appointment.repository';
import { DatabaseService } from '../../database/database.service';
import { AppointmentStatus, AppointmentSettings } from './appointment.model';

// Mock dependencies
jest.mock('../../database/database.service');
jest.mock('./appointment.repository');

// Mock Container.get for DatabaseService
jest.mock('typedi', () => ({
    Container: {
        get: jest.fn(),
        set: jest.fn(),
        reset: jest.fn()
    },
    Service: () => (target: any) => target
}));

describe('AppointmentService', () => {
    let appointmentService: AppointmentService;
    let appointmentRepositoryMock: jest.Mocked<AppointmentRepository>;
    let databaseServiceMock: jest.Mocked<DatabaseService>;

    const mockAppointmentSettings: AppointmentSettings = {
        id: 1,
        startTime: '09:00',
        endTime: '18:00',
        duration: 20
    };

    const mockAppointment = {
        id: 1,
        date: new Date('2024-01-20T10:00:00'),
        idPatient: 1,
        idDoctor: 2,
        idSpeciality: 1,
        location: 'Room 101',
        status: AppointmentStatus.SCHEDULED
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock AppointmentRepository
        appointmentRepositoryMock = {
            create: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            checkDoctorAvailability: jest.fn(),
            findAppointmentsByPatient: jest.fn(),
            findAppointmentsByDoctor: jest.fn(),
            getAppointmentSettings: jest.fn(),
            updateAppointmentSettings: jest.fn()
        } as unknown as jest.Mocked<AppointmentRepository>;

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        // Mock Container.get to return our mock DatabaseService
        const { Container } = require('typedi');
        (Container.get as jest.Mock).mockReturnValue(databaseServiceMock);

        appointmentService = new AppointmentService(appointmentRepositoryMock);
    });

    describe('createAppointment', () => {
        const validAppointmentData = {
            date: new Date('2024-01-20T10:00:00'), // 10:00 (within hours and multiple of 20)
            idPatient: 1,
            idDoctor: 2,
            idSpeciality: 1,
            location: 'Room 101'
        };

        it('should create appointment with valid data', async () => {
            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);
            appointmentRepositoryMock.checkDoctorAvailability.mockResolvedValue(true);
            appointmentRepositoryMock.create.mockResolvedValue(1);

            const result = await appointmentService.createAppointment(validAppointmentData);

            expect(appointmentRepositoryMock.getAppointmentSettings).toHaveBeenCalled();
            expect(appointmentRepositoryMock.checkDoctorAvailability).toHaveBeenCalledWith(
                2,
                validAppointmentData.date
            );
            expect(appointmentRepositoryMock.create).toHaveBeenCalledWith(validAppointmentData);
            expect(result).toBe(1);
        });

        it('should throw error when appointment is outside allowed hours - too early', async () => {
            const earlyAppointment = {
                ...validAppointmentData,
                date: new Date('2024-01-20T08:00:00') // before 9:00
            };

            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);

            await expect(appointmentService.createAppointment(earlyAppointment))
                .rejects.toThrow('Appointment must be between 09:00 and 18:00');
        });

        it('should throw error when appointment is outside allowed hours - too late', async () => {
            const lateAppointment = {
                ...validAppointmentData,
                date: new Date('2024-01-20T17:50:00') // would end at 18:10
            };

            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);

            await expect(appointmentService.createAppointment(lateAppointment))
                .rejects.toThrow('Appointment must be between 09:00 and 18:00');
        });

        it('should throw error when appointment time is not a multiple of duration', async () => {
            const invalidTimeAppointment = {
                ...validAppointmentData,
                date: new Date('2024-01-20T10:10:00') // not multiple of 20
            };

            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);

            await expect(appointmentService.createAppointment(invalidTimeAppointment))
                .rejects.toThrow('Appointment time must be in 20-minute intervals');
        });

        it('should throw error when doctor is not available', async () => {
            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);
            appointmentRepositoryMock.checkDoctorAvailability.mockResolvedValue(false);

            await expect(appointmentService.createAppointment(validAppointmentData))
                .rejects.toThrow('Doctor is not available at the selected time');
        });
    });

    describe('getAppointmentById', () => {
        it('should return appointment when found', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);

            const result = await appointmentService.getAppointmentById(1);

            expect(appointmentRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockAppointment);
        });

        it('should return null when appointment not found', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(null);

            const result = await appointmentService.getAppointmentById(999);

            expect(result).toBeNull();
        });
    });

    describe('getAppointments', () => {
        it('should return all appointments with default query', async () => {
            const mockAppointments = [mockAppointment];
            appointmentRepositoryMock.findAll.mockResolvedValue(mockAppointments);

            const result = await appointmentService.getAppointments();

            expect(appointmentRepositoryMock.findAll).toHaveBeenCalledWith({});
            expect(result).toEqual(mockAppointments);
        });

        it('should return filtered appointments with query params', async () => {
            const mockAppointments = [mockAppointment];
            const queryParams = {
                idDoctor: 2,
                status: AppointmentStatus.SCHEDULED,
                page: 1,
                limit: 10
            };

            appointmentRepositoryMock.findAll.mockResolvedValue(mockAppointments);

            const result = await appointmentService.getAppointments(queryParams);

            expect(appointmentRepositoryMock.findAll).toHaveBeenCalledWith(queryParams);
            expect(result).toEqual(mockAppointments);
        });
    });

    describe('updateAppointment', () => {
        it('should update appointment when found', async () => {
            const updates = { location: 'Room 202' };
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);
            appointmentRepositoryMock.update.mockResolvedValue(true);

            const result = await appointmentService.updateAppointment(1, updates);

            expect(appointmentRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(appointmentRepositoryMock.update).toHaveBeenCalledWith(1, updates);
            expect(result).toBe(true);
        });

        it('should throw error when appointment not found', async () => {
            const updates = { location: 'Room 202' };
            appointmentRepositoryMock.findById.mockResolvedValue(null);

            await expect(appointmentService.updateAppointment(999, updates))
                .rejects.toThrow('Appointment not found');
        });

        it('should check doctor availability when updating date', async () => {
            const newDate = new Date('2024-01-21T10:00:00');
            const updates = { date: newDate };
            
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);
            appointmentRepositoryMock.checkDoctorAvailability.mockResolvedValue(true);
            appointmentRepositoryMock.update.mockResolvedValue(true);

            const result = await appointmentService.updateAppointment(1, updates);

            expect(appointmentRepositoryMock.checkDoctorAvailability).toHaveBeenCalledWith(
                2,
                newDate
            );
            expect(result).toBe(true);
        });

        it('should throw error when doctor not available for new date', async () => {
            const newDate = new Date('2024-01-21T10:00:00');
            const updates = { date: newDate };
            
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);
            appointmentRepositoryMock.checkDoctorAvailability.mockResolvedValue(false);

            await expect(appointmentService.updateAppointment(1, updates))
                .rejects.toThrow('Doctor is not available at the selected time');
        });
    });

    describe('cancelAppointment', () => {
        it('should cancel appointment when found and not already cancelled', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);
            appointmentRepositoryMock.update.mockResolvedValue(true);

            const result = await appointmentService.cancelAppointment(1);

            expect(appointmentRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(appointmentRepositoryMock.update).toHaveBeenCalledWith(1, {
                status: AppointmentStatus.CANCELLED
            });
            expect(result).toBe(true);
        });

        it('should throw error when appointment not found', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(null);

            await expect(appointmentService.cancelAppointment(999))
                .rejects.toThrow('Appointment not found');
        });

        it('should throw error when appointment already cancelled', async () => {
            const cancelledAppointment = {
                ...mockAppointment,
                status: AppointmentStatus.CANCELLED
            };
            
            appointmentRepositoryMock.findById.mockResolvedValue(cancelledAppointment);

            await expect(appointmentService.cancelAppointment(1))
                .rejects.toThrow('Appointment is already cancelled');
        });
    });

    describe('rescheduleAppointment', () => {
        const newDate = new Date('2024-01-21T10:00:00');

        it('should reschedule appointment when valid', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);
            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);
            appointmentRepositoryMock.checkDoctorAvailability.mockResolvedValue(true);
            appointmentRepositoryMock.update.mockResolvedValue(true);

            const result = await appointmentService.rescheduleAppointment(1, newDate);

            expect(appointmentRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(appointmentRepositoryMock.getAppointmentSettings).toHaveBeenCalled();
            expect(appointmentRepositoryMock.checkDoctorAvailability).toHaveBeenCalledWith(
                2,
                newDate
            );
            expect(appointmentRepositoryMock.update).toHaveBeenCalledWith(1, {
                date: newDate,
                status: AppointmentStatus.RESCHEDULED
            });
            expect(result).toBe(true);
        });

        it('should throw error when appointment not found', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(null);

            await expect(appointmentService.rescheduleAppointment(999, newDate))
                .rejects.toThrow('Appointment not found');
        });

        it('should throw error when appointment is cancelled', async () => {
            const cancelledAppointment = {
                ...mockAppointment,
                status: AppointmentStatus.CANCELLED
            };
            
            appointmentRepositoryMock.findById.mockResolvedValue(cancelledAppointment);

            await expect(appointmentService.rescheduleAppointment(1, newDate))
                .rejects.toThrow('Cannot reschedule a cancelled appointment');
        });

        it('should throw error when new time is outside allowed hours', async () => {
            const earlyDate = new Date('2024-01-21T08:00:00');
            
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);
            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);

            await expect(appointmentService.rescheduleAppointment(1, earlyDate))
                .rejects.toThrow('Appointment must be between 09:00 and 18:00');
        });

        it('should throw error when doctor not available at new time', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);
            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);
            appointmentRepositoryMock.checkDoctorAvailability.mockResolvedValue(false);

            await expect(appointmentService.rescheduleAppointment(1, newDate))
                .rejects.toThrow('Doctor is not available at the selected time');
        });
    });

    describe('deleteAppointment', () => {
        it('should delete appointment when found', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);
            appointmentRepositoryMock.delete.mockResolvedValue(true);

            const result = await appointmentService.deleteAppointment(1);

            expect(appointmentRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(appointmentRepositoryMock.delete).toHaveBeenCalledWith(1);
            expect(result).toBe(true);
        });

        it('should throw error when appointment not found', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(null);

            await expect(appointmentService.deleteAppointment(999))
                .rejects.toThrow('Appointment not found');
        });
    });

    describe('getPatientAppointments', () => {
        it('should return patient appointments', async () => {
            const mockAppointments = [mockAppointment];
            appointmentRepositoryMock.findAppointmentsByPatient.mockResolvedValue(mockAppointments);

            const result = await appointmentService.getPatientAppointments(1);

            expect(appointmentRepositoryMock.findAppointmentsByPatient).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockAppointments);
        });
    });

    describe('getDoctorAppointments', () => {
        it('should return doctor appointments', async () => {
            const mockAppointments = [mockAppointment];
            appointmentRepositoryMock.findAppointmentsByDoctor.mockResolvedValue(mockAppointments);

            const result = await appointmentService.getDoctorAppointments(2);

            expect(appointmentRepositoryMock.findAppointmentsByDoctor).toHaveBeenCalledWith(2);
            expect(result).toEqual(mockAppointments);
        });
    });

    describe('completeAppointment', () => {
        it('should complete appointment when found', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(mockAppointment);
            appointmentRepositoryMock.update.mockResolvedValue(true);

            const result = await appointmentService.completeAppointment(1);

            expect(appointmentRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(appointmentRepositoryMock.update).toHaveBeenCalledWith(1, {
                status: AppointmentStatus.COMPLETED
            });
            expect(result).toBe(true);
        });

        it('should throw error when appointment not found', async () => {
            appointmentRepositoryMock.findById.mockResolvedValue(null);

            await expect(appointmentService.completeAppointment(999))
                .rejects.toThrow('Appointment not found');
        });
    });

    describe('getAppointmentSettings', () => {
        it('should return appointment settings', async () => {
            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(mockAppointmentSettings);

            const result = await appointmentService.getAppointmentSettings();

            expect(appointmentRepositoryMock.getAppointmentSettings).toHaveBeenCalled();
            expect(result).toEqual(mockAppointmentSettings);
        });
    });

    describe('updateAppointmentSettings', () => {
        const validUpdates = {
            startTime: '10:00',
            endTime: '19:00',
            duration: 30
        };

        const updatedSettings = {
            ...mockAppointmentSettings,
            ...validUpdates
        };

        it('should update appointment settings with valid data', async () => {
            appointmentRepositoryMock.updateAppointmentSettings.mockResolvedValue(true);
            appointmentRepositoryMock.getAppointmentSettings.mockResolvedValue(updatedSettings);

            const result = await appointmentService.updateAppointmentSettings(validUpdates);

            expect(appointmentRepositoryMock.updateAppointmentSettings).toHaveBeenCalledWith(validUpdates);
            expect(appointmentRepositoryMock.getAppointmentSettings).toHaveBeenCalled();
            expect(result).toEqual(updatedSettings);
        });

        it('should throw error when startTime format is invalid', async () => {
            const invalidUpdates = {
                startTime: '25:00' // Invalid hour
            };

            await expect(appointmentService.updateAppointmentSettings(invalidUpdates))
                .rejects.toThrow('Invalid startTime format. Use "HH:MM"');
        });

        it('should throw error when endTime format is invalid', async () => {
            const invalidUpdates = {
                endTime: '12:60' // Invalid minutes
            };

            await expect(appointmentService.updateAppointmentSettings(invalidUpdates))
                .rejects.toThrow('Invalid endTime format. Use "HH:MM"');
        });

        it('should throw error when duration is too small', async () => {
            const invalidUpdates = {
                duration: -10
            };

            await expect(appointmentService.updateAppointmentSettings(invalidUpdates))
                .rejects.toThrow('Duration must be between 1 and 480 minutes');
        });

        it('should throw error when duration is too large', async () => {
            const invalidUpdates = {
                duration: 500
            };

            await expect(appointmentService.updateAppointmentSettings(invalidUpdates))
                .rejects.toThrow('Duration must be between 1 and 480 minutes');
        });

        it('should throw error when startTime is after endTime', async () => {
            const invalidUpdates = {
                startTime: '19:00',
                endTime: '09:00'
            };

            await expect(appointmentService.updateAppointmentSettings(invalidUpdates))
                .rejects.toThrow('startTime must be before endTime');
        });
    });
});