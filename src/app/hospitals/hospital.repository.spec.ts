import 'reflect-metadata';
import { HospitalRepository } from './hospital.repository';
import { DatabaseService } from '../../database/database.service';
import { Hospital } from './hospital.model';

// Mock DatabaseService
jest.mock('../../database/database.service');

describe('HospitalRepository', () => {
    let hospitalRepository: HospitalRepository;
    let databaseServiceMock: jest.Mocked<DatabaseService>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        hospitalRepository = new HospitalRepository(databaseServiceMock);
    });

    describe('findAll', () => {
        it('should return all hospitals without filters', async () => {
            const mockHospitals = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: JSON.stringify(['Cardiology', 'Neurology']),
                    services: JSON.stringify(['Emergency', 'Surgery']),
                    location: 'New York'
                },
                {
                    id: 2,
                    name: 'Hospital Central',
                    departments: JSON.stringify(['Pediatrics', 'Orthopedics']),
                    services: JSON.stringify(['ICU', 'Radiology']),
                    location: 'Los Angeles'
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockHospitals,
                rowCount: 2
            });

            const result = await hospitalRepository.findAll();

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('SELECT id, name, departments, services, location FROM hospitals WHERE 1=1'),
                params: []
            });
            
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe(1);
            expect(result[0].name).toBe('Hospital General');
            expect(result[0].departments).toEqual(['Cardiology', 'Neurology']);
            expect(result[0].services).toEqual(['Emergency', 'Surgery']);
            expect(result[0].location).toBe('New York');
        });

        it('should filter hospitals by name', async () => {
            const mockHospitals = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: JSON.stringify(['Cardiology']),
                    services: JSON.stringify(['Emergency']),
                    location: 'New York'
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockHospitals,
                rowCount: 1
            });

            const query = { name: 'General' };
            await hospitalRepository.findAll(query);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('name LIKE ?'),
                params: ['%General%']
            });
        });

        it('should filter hospitals by location', async () => {
            const mockHospitals = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: JSON.stringify(['Cardiology']),
                    services: JSON.stringify(['Emergency']),
                    location: 'New York'
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockHospitals,
                rowCount: 1
            });

            const query = { location: 'York' };
            await hospitalRepository.findAll(query);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('location LIKE ?'),
                params: ['%York%']
            });
        });

        it('should filter hospitals by name and location', async () => {
            const mockHospitals = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: JSON.stringify(['Cardiology']),
                    services: JSON.stringify(['Emergency']),
                    location: 'New York'
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockHospitals,
                rowCount: 1
            });

            const query = { name: 'General', location: 'York' };
            await hospitalRepository.findAll(query);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('name LIKE ? AND location LIKE ?'),
                params: ['%General%', '%York%']
            });
        });

        it('should apply pagination when page and limit are provided', async () => {
            const mockHospitals = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: JSON.stringify(['Cardiology']),
                    services: JSON.stringify(['Emergency']),
                    location: 'New York'
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockHospitals,
                rowCount: 1
            });

            const query = { page: 2, limit: 10 };
            await hospitalRepository.findAll(query);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('LIMIT ? OFFSET ?'),
                params: [10, 10]
            });
        });

        it('should return empty array when no hospitals found', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0
            });

            const result = await hospitalRepository.findAll();

            expect(result).toEqual([]);
        });
    });

    describe('findById', () => {
        it('should return hospital by id', async () => {
            const mockHospital = {
                id: 1,
                name: 'Hospital General',
                departments: JSON.stringify(['Cardiology', 'Neurology']),
                services: JSON.stringify(['Emergency', 'Surgery']),
                location: 'New York'
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [mockHospital],
                rowCount: 1
            });

            const result = await hospitalRepository.findById(1);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: 'SELECT id, name, departments, services, location FROM hospitals WHERE id = ?',
                params: [1]
            });

            expect(result).not.toBeNull();
            expect(result!.id).toBe(1);
            expect(result!.name).toBe('Hospital General');
            expect(result!.departments).toEqual(['Cardiology', 'Neurology']);
            expect(result!.services).toEqual(['Emergency', 'Surgery']);
            expect(result!.location).toBe('New York');
        });

        it('should return null when hospital not found', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0
            });

            const result = await hospitalRepository.findById(999);

            expect(result).toBeNull();
        });

        it('should handle empty departments and services', async () => {
            const mockHospital = {
                id: 1,
                name: 'Hospital General',
                departments: null,
                services: null,
                location: 'New York'
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [mockHospital],
                rowCount: 1
            });

            const result = await hospitalRepository.findById(1);

            expect(result!.departments).toEqual([]);
            expect(result!.services).toEqual([]);
        });
    });

    describe('mapHospital', () => {
        it('should correctly parse JSON arrays', () => {
            const row = {
                id: 1,
                name: 'Hospital General',
                departments: JSON.stringify(['Cardiology', 'Neurology']),
                services: JSON.stringify(['Emergency', 'Surgery']),
                location: 'New York'
            };

            const result = hospitalRepository['mapHospital'](row);

            expect(result.departments).toEqual(['Cardiology', 'Neurology']);
            expect(result.services).toEqual(['Emergency', 'Surgery']);
            expect(Array.isArray(result.departments)).toBe(true);
            expect(Array.isArray(result.services)).toBe(true);
        });

        it('should handle null JSON strings', () => {
            const row = {
                id: 1,
                name: 'Hospital General',
                departments: null,
                services: null,
                location: 'New York'
            };

            const result = hospitalRepository['mapHospital'](row);

            expect(result.departments).toEqual([]);
            expect(result.services).toEqual([]);
        });

        it('should handle empty JSON strings', () => {
            const row = {
                id: 1,
                name: 'Hospital General',
                departments: '',
                services: '',
                location: 'New York'
            };

            const result = hospitalRepository['mapHospital'](row);

            expect(result.departments).toEqual([]);
            expect(result.services).toEqual([]);
        });
    });
});