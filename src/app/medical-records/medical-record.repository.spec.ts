import 'reflect-metadata';
import { MedicalRecordRepository } from './medical-record.repository';
import { DatabaseService } from '../../database/database.service';

// Mock DatabaseService
jest.mock('../../database/database.service');

describe('MedicalRecordRepository', () => {
    let medicalRecordRepository: MedicalRecordRepository;
    let databaseServiceMock: jest.Mocked<DatabaseService>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        medicalRecordRepository = new MedicalRecordRepository(databaseServiceMock);
    });

    describe('findById', () => {
        it('should return medical record when found', async () => {
            const mockMedicalRecord = {
                id: 1,
                idAppointment: 101,
                date: '2024-01-15T10:00:00.000Z',
                idPatient: 1,
                idDoctor: 2,
                idSpeciality: 1,
                description: 'Regular checkup',
                treatment: 'Prescribed medication',
                testResults: JSON.stringify(['blood_test.pdf'])
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [mockMedicalRecord],
                rowCount: 1
            });

            const result = await medicalRecordRepository.findById(1);

            expect(result).toEqual({
                id: 1,
                idAppointment: 101,
                date: new Date('2024-01-15T10:00:00.000Z'),
                idPatient: 1,
                idDoctor: 2,
                idSpeciality: 1,
                description: 'Regular checkup',
                treatment: 'Prescribed medication',
                testResults: ['blood_test.pdf']
            });

            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });

        it('should return null when medical record not found', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0
            });

            const result = await medicalRecordRepository.findById(999);

            expect(result).toBeNull();
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('create', () => {
        it('should insert medical record and return the new ID', async () => {
            const medicalRecordData = {
                idAppointment: 101,
                idDoctor: 2,
                idPatient: 1,
                idSpeciality: 1,
                description: 'Regular checkup',
                treatment: 'Prescribed medication',
                testResults: ['blood_test.pdf']
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                lastID: 5,
                changes: 1
            } as any);

            const result = await medicalRecordRepository.create(medicalRecordData);

            expect(result).toBe(5);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });

        it('should handle medical record without testResults', async () => {
            const medicalRecordData = {
                idAppointment: 101,
                idDoctor: 2,
                idPatient: 1,
                idSpeciality: 1,
                description: 'Regular checkup',
                treatment: 'Prescribed medication'
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                lastID: 6,
                changes: 1
            } as any);

            const result = await medicalRecordRepository.create(medicalRecordData);

            expect(result).toBe(6);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('findAll', () => {
        it('should return all medical records when no query params', async () => {
            const mockMedicalRecords = [
                {
                    id: 1,
                    idAppointment: 101,
                    date: '2024-01-15T10:00:00.000Z',
                    idPatient: 1,
                    idDoctor: 2,
                    idSpeciality: 1,
                    description: 'Regular checkup',
                    treatment: 'Prescribed medication',
                    testResults: JSON.stringify(['blood_test.pdf'])
                },
                {
                    id: 2,
                    idAppointment: 102,
                    date: '2024-01-16T11:00:00.000Z',
                    idPatient: 2,
                    idDoctor: 3,
                    idSpeciality: 2,
                    description: 'Follow-up',
                    treatment: 'Rest',
                    testResults: null
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockMedicalRecords,
                rowCount: 2
            });

            const result = await medicalRecordRepository.findAll();

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe(1);
            expect(result[0].date).toBeInstanceOf(Date);
            expect(result[0].testResults).toEqual(['blood_test.pdf']);
            expect(result[1].id).toBe(2);
            expect(result[1].testResults).toEqual([]);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });

        it('should return filtered medical records with query params', async () => {
            const mockMedicalRecords = [
                {
                    id: 1,
                    idAppointment: 101,
                    date: '2024-01-15T10:00:00.000Z',
                    idPatient: 1,
                    idDoctor: 2,
                    idSpeciality: 1,
                    description: 'Regular checkup',
                    treatment: 'Prescribed medication',
                    testResults: JSON.stringify(['blood_test.pdf'])
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockMedicalRecords,
                rowCount: 1
            });

            const queryParams = {
                idPatient: 1,
                idDoctor: 2,
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31')
            };

            const result = await medicalRecordRepository.findAll(queryParams);

            expect(result).toHaveLength(1);
            expect(result[0].idPatient).toBe(1);
            expect(result[0].idDoctor).toBe(2);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('update', () => {
        it('should update medical record and return true', async () => {
            const updates = {
                description: 'Updated description',
                treatment: 'Updated treatment'
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                changes: 1
            } as any);

            const result = await medicalRecordRepository.update(1, updates);

            expect(result).toBe(true);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });

        it('should update testResults as JSON string', async () => {
            const updates = {
                testResults: ['new_test1.pdf', 'new_test2.pdf']
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                changes: 1
            } as any);

            const result = await medicalRecordRepository.update(1, updates);

            expect(result).toBe(true);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });

        it('should return false when no updates provided', async () => {
            const result = await medicalRecordRepository.update(1, {});

            expect(result).toBe(false);
            expect(databaseServiceMock.execQuery).not.toHaveBeenCalled();
        });

        it('should return false when no rows affected', async () => {
            const updates = { description: 'New description' };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                changes: 0
            } as any);

            const result = await medicalRecordRepository.update(999, updates);

            expect(result).toBe(false);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('delete', () => {
        it('should delete medical record and return true', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                changes: 1
            } as any);

            const result = await medicalRecordRepository.delete(1);

            expect(result).toBe(true);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });

        it('should return false when no rows affected', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                changes: 0
            } as any);

            const result = await medicalRecordRepository.delete(999);

            expect(result).toBe(false);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('findByPatientId', () => {
        it('should return medical records for patient', async () => {
            const mockMedicalRecords = [
                {
                    id: 1,
                    idAppointment: 101,
                    date: '2024-01-15T10:00:00.000Z',
                    idPatient: 1,
                    idDoctor: 2,
                    idSpeciality: 1,
                    description: 'Regular checkup',
                    treatment: 'Prescribed medication',
                    testResults: JSON.stringify(['blood_test.pdf'])
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockMedicalRecords,
                rowCount: 1
            });

            const result = await medicalRecordRepository.findByPatientId(1);

            expect(result).toHaveLength(1);
            expect(result[0].idPatient).toBe(1);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('findByDoctorId', () => {
        it('should return medical records for doctor', async () => {
            const mockMedicalRecords = [
                {
                    id: 1,
                    idAppointment: 101,
                    date: '2024-01-15T10:00:00.000Z',
                    idPatient: 1,
                    idDoctor: 2,
                    idSpeciality: 1,
                    description: 'Regular checkup',
                    treatment: 'Prescribed medication',
                    testResults: JSON.stringify(['blood_test.pdf'])
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockMedicalRecords,
                rowCount: 1
            });

            const result = await medicalRecordRepository.findByDoctorId(2);

            expect(result).toHaveLength(1);
            expect(result[0].idDoctor).toBe(2);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('findByAppointmentId', () => {
        it('should return medical record for appointment', async () => {
            const mockMedicalRecord = {
                id: 1,
                idAppointment: 101,
                date: '2024-01-15T10:00:00.000Z',
                idPatient: 1,
                idDoctor: 2,
                idSpeciality: 1,
                description: 'Regular checkup',
                treatment: 'Prescribed medication',
                testResults: JSON.stringify(['blood_test.pdf'])
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [mockMedicalRecord],
                rowCount: 1
            });

            const result = await medicalRecordRepository.findByAppointmentId(101);

            expect(result).toEqual({
                id: 1,
                idAppointment: 101,
                date: new Date('2024-01-15T10:00:00.000Z'),
                idPatient: 1,
                idDoctor: 2,
                idSpeciality: 1,
                description: 'Regular checkup',
                treatment: 'Prescribed medication',
                testResults: ['blood_test.pdf']
            });
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });

        it('should return null when no medical record for appointment', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0
            });

            const result = await medicalRecordRepository.findByAppointmentId(999);

            expect(result).toBeNull();
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('searchByPatientName', () => {
        it('should search medical records by patient name', async () => {
            const mockMedicalRecords = [
                {
                    id: 1,
                    idAppointment: 101,
                    date: '2024-01-15T10:00:00.000Z',
                    idPatient: 1,
                    idDoctor: 2,
                    idSpeciality: 1,
                    description: 'Regular checkup',
                    treatment: 'Prescribed medication',
                    testResults: JSON.stringify(['blood_test.pdf'])
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockMedicalRecords,
                rowCount: 1
            });

            const result = await medicalRecordRepository.searchByPatientName('John');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(1);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when no matches found', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0
            });

            const result = await medicalRecordRepository.searchByPatientName('NonExistent');

            expect(result).toHaveLength(0);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });
});