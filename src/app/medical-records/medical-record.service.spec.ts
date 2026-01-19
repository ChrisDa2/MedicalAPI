import 'reflect-metadata';
import { MedicalRecordService } from './medical-record.service';
import { MedicalRecordRepository } from './medical-record.repository';
import { DatabaseService } from '../../database/database.service';
import { AppointmentRepository } from '../appointments/appointment.repository';
import { AppointmentService } from '../appointments/appointment.service';

// Mock dependencies
jest.mock('./medical-record.repository');
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

describe('MedicalRecordService', () => {
    let medicalRecordService: MedicalRecordService;
    let medicalRecordRepositoryMock: jest.Mocked<MedicalRecordRepository>;
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

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock MedicalRecordRepository
        medicalRecordRepositoryMock = {
            create: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findByPatientId: jest.fn(),
            findByDoctorId: jest.fn(),
            findByAppointmentId: jest.fn(),
            searchByPatientName: jest.fn()
        } as unknown as jest.Mocked<MedicalRecordRepository>;

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        // Mock Container.get to return our mock DatabaseService
        const { Container } = require('typedi');
        (Container.get as jest.Mock).mockReturnValue(databaseServiceMock);

        medicalRecordService = new MedicalRecordService(medicalRecordRepositoryMock);
    });

    describe('createMedicalRecord', () => {
        const validMedicalRecordData = {
            idAppointment: 101,
            idDoctor: 2,
            idPatient: 1,
            idSpeciality: 1,
            description: 'Regular checkup',
            treatment: 'Prescribed medication',
            testResults: ['blood_test.pdf']
        };

        it('should create medical record when no record exists for appointment', async () => {
            medicalRecordRepositoryMock.findByAppointmentId.mockResolvedValue(null);
            medicalRecordRepositoryMock.create.mockResolvedValue(1);

            const result = await medicalRecordService.createMedicalRecord(validMedicalRecordData);

            expect(medicalRecordRepositoryMock.findByAppointmentId).toHaveBeenCalledWith(101);
            expect(medicalRecordRepositoryMock.create).toHaveBeenCalledWith(validMedicalRecordData);
            expect(result).toBe(1);
        });

        it('should throw error when medical record already exists for appointment', async () => {
            const existingRecord = createMockMedicalRecord();
            medicalRecordRepositoryMock.findByAppointmentId.mockResolvedValue(existingRecord);

            await expect(medicalRecordService.createMedicalRecord(validMedicalRecordData))
                .rejects.toThrow('Medical record already exists for this appointment');
        });
    });

    describe('getMedicalRecordById', () => {
        it('should return medical record when found', async () => {
            const mockRecord = createMockMedicalRecord();
            medicalRecordRepositoryMock.findById.mockResolvedValue(mockRecord);

            const result = await medicalRecordService.getMedicalRecordById(1);

            expect(medicalRecordRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockRecord);
        });

        it('should return null when medical record not found', async () => {
            medicalRecordRepositoryMock.findById.mockResolvedValue(null);

            const result = await medicalRecordService.getMedicalRecordById(999);

            expect(result).toBeNull();
        });
    });

    describe('getMedicalRecords', () => {
        it('should return all medical records with query params', async () => {
            const mockRecords = [createMockMedicalRecord()];
            const queryParams = {
                idPatient: 1,
                idDoctor: 2,
                page: 1,
                limit: 10,
                sortBy: 'date',
                sortOrder: 'DESC' as const
            };

            medicalRecordRepositoryMock.findAll.mockResolvedValue(mockRecords);

            const result = await medicalRecordService.getMedicalRecords(queryParams);

            expect(medicalRecordRepositoryMock.findAll).toHaveBeenCalledWith(queryParams);
            expect(result).toEqual(mockRecords);
        });

        it('should return all medical records with empty query params', async () => {
            const mockRecords = [createMockMedicalRecord()];
            medicalRecordRepositoryMock.findAll.mockResolvedValue(mockRecords);

            const result = await medicalRecordService.getMedicalRecords();

            expect(medicalRecordRepositoryMock.findAll).toHaveBeenCalledWith({});
            expect(result).toEqual(mockRecords);
        });
    });

    describe('updateMedicalRecord', () => {
        it('should update medical record when it exists', async () => {
            const mockRecord = createMockMedicalRecord();
            const updates = {
                description: 'Updated description',
                treatment: 'Updated treatment'
            };

            medicalRecordRepositoryMock.findById.mockResolvedValue(mockRecord);
            medicalRecordRepositoryMock.update.mockResolvedValue(true);

            const result = await medicalRecordService.updateMedicalRecord(1, updates);

            expect(medicalRecordRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(medicalRecordRepositoryMock.update).toHaveBeenCalledWith(1, updates);
            expect(result).toBe(true);
        });

        it('should throw error when medical record not found', async () => {
            medicalRecordRepositoryMock.findById.mockResolvedValue(null);

            await expect(medicalRecordService.updateMedicalRecord(999, { description: 'Updated' }))
                .rejects.toThrow('Medical record not found');
        });
    });

    describe('deleteMedicalRecord', () => {
        it('should delete medical record when it exists', async () => {
            const mockRecord = createMockMedicalRecord();
            medicalRecordRepositoryMock.findById.mockResolvedValue(mockRecord);
            medicalRecordRepositoryMock.delete.mockResolvedValue(true);

            const result = await medicalRecordService.deleteMedicalRecord(1);

            expect(medicalRecordRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(medicalRecordRepositoryMock.delete).toHaveBeenCalledWith(1);
            expect(result).toBe(true);
        });

        it('should throw error when medical record not found', async () => {
            medicalRecordRepositoryMock.findById.mockResolvedValue(null);

            await expect(medicalRecordService.deleteMedicalRecord(999))
                .rejects.toThrow('Medical record not found');
        });
    });

    describe('getPatientMedicalRecords', () => {
        it('should return medical records for patient', async () => {
            const mockRecords = [createMockMedicalRecord()];
            medicalRecordRepositoryMock.findByPatientId.mockResolvedValue(mockRecords);

            const result = await medicalRecordService.getPatientMedicalRecords(1);

            expect(medicalRecordRepositoryMock.findByPatientId).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockRecords);
        });
    });

    describe('getDoctorMedicalRecords', () => {
        it('should return medical records for doctor', async () => {
            const mockRecords = [createMockMedicalRecord()];
            medicalRecordRepositoryMock.findByDoctorId.mockResolvedValue(mockRecords);

            const result = await medicalRecordService.getDoctorMedicalRecords(2);

            expect(medicalRecordRepositoryMock.findByDoctorId).toHaveBeenCalledWith(2);
            expect(result).toEqual(mockRecords);
        });
    });

    describe('getMedicalRecordByAppointment', () => {
        it('should return medical record for appointment', async () => {
            const mockRecord = createMockMedicalRecord();
            medicalRecordRepositoryMock.findByAppointmentId.mockResolvedValue(mockRecord);

            const result = await medicalRecordService.getMedicalRecordByAppointment(101);

            expect(medicalRecordRepositoryMock.findByAppointmentId).toHaveBeenCalledWith(101);
            expect(result).toEqual(mockRecord);
        });

        it('should return null when no medical record for appointment', async () => {
            medicalRecordRepositoryMock.findByAppointmentId.mockResolvedValue(null);

            const result = await medicalRecordService.getMedicalRecordByAppointment(999);

            expect(result).toBeNull();
        });
    });

    describe('searchMedicalRecordsByPatientName', () => {
        it('should search medical records by patient name', async () => {
            const mockRecords = [createMockMedicalRecord()];
            medicalRecordRepositoryMock.searchByPatientName.mockResolvedValue(mockRecords);

            const result = await medicalRecordService.searchMedicalRecordsByPatientName('John');

            expect(medicalRecordRepositoryMock.searchByPatientName).toHaveBeenCalledWith('John');
            expect(result).toEqual(mockRecords);
        });
    });

    describe('updateTestResults', () => {
        it('should update test results when medical record exists', async () => {
            const mockRecord = createMockMedicalRecord();
            const testResults = ['new_test.pdf'];

            medicalRecordRepositoryMock.findById.mockResolvedValue(mockRecord);
            medicalRecordRepositoryMock.update.mockResolvedValue(true);

            const result = await medicalRecordService.updateTestResults(1, testResults);

            expect(medicalRecordRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(medicalRecordRepositoryMock.update).toHaveBeenCalledWith(1, { testResults });
            expect(result).toBe(true);
        });

        it('should throw error when medical record not found', async () => {
            medicalRecordRepositoryMock.findById.mockResolvedValue(null);

            await expect(medicalRecordService.updateTestResults(999, []))
                .rejects.toThrow('Medical record not found');
        });
    });

    describe('updateTreatment', () => {
        it('should update treatment when medical record exists', async () => {
            const mockRecord = createMockMedicalRecord();
            const treatment = 'Updated treatment plan';

            medicalRecordRepositoryMock.findById.mockResolvedValue(mockRecord);
            medicalRecordRepositoryMock.update.mockResolvedValue(true);

            const result = await medicalRecordService.updateTreatment(1, treatment);

            expect(medicalRecordRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(medicalRecordRepositoryMock.update).toHaveBeenCalledWith(1, { treatment });
            expect(result).toBe(true);
        });

        it('should throw error when medical record not found', async () => {
            medicalRecordRepositoryMock.findById.mockResolvedValue(null);

            await expect(medicalRecordService.updateTreatment(999, 'New treatment'))
                .rejects.toThrow('Medical record not found');
        });
    });
});