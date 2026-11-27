import 'reflect-metadata';
import { HospitalService } from './hospital.service';
import { HospitalRepository } from './hospital.repository';
import { Hospital, HospitalQueryParams } from './hospital.model';

describe('HospitalService', () => {
    let hospitalService: HospitalService;
    let hospitalRepositoryMock: jest.Mocked<HospitalRepository>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock HospitalRepository
        hospitalRepositoryMock = {
            findAll: jest.fn(),
            findById: jest.fn()
        } as unknown as jest.Mocked<HospitalRepository>;

        hospitalService = new HospitalService(hospitalRepositoryMock);
    });

    describe('getAllHospitals', () => {
        it('should return all hospitals without filters', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology', 'Neurology'],
                    services: ['Emergency', 'Surgery'],
                    location: 'New York'
                },
                {
                    id: 2,
                    name: 'Hospital Central',
                    departments: ['Pediatrics', 'Orthopedics'],
                    services: ['ICU', 'Radiology'],
                    location: 'Los Angeles'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const result = await hospitalService.getAllHospitals();

            expect(hospitalRepositoryMock.findAll).toHaveBeenCalledWith({});
            expect(result).toEqual(mockHospitals);
        });

        it('should filter hospitals by name through repository', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology'],
                    services: ['Emergency'],
                    location: 'New York'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { name: 'General' };
            await hospitalService.getAllHospitals(query);

            expect(hospitalRepositoryMock.findAll).toHaveBeenCalledWith(query);
        });

        it('should filter hospitals by location through repository', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology'],
                    services: ['Emergency'],
                    location: 'New York'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { location: 'York' };
            await hospitalService.getAllHospitals(query);

            expect(hospitalRepositoryMock.findAll).toHaveBeenCalledWith(query);
        });

        it('should filter hospitals by department after repository call', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology', 'Neurology'],
                    services: ['Emergency', 'Surgery'],
                    location: 'New York'
                },
                {
                    id: 2,
                    name: 'Hospital Central',
                    departments: ['Pediatrics', 'Orthopedics'],
                    services: ['ICU', 'Radiology'],
                    location: 'Los Angeles'
                },
                {
                    id: 3,
                    name: 'Hospital Regional',
                    departments: ['Cardiology', 'Pediatrics'],
                    services: ['Emergency', 'ICU'],
                    location: 'Chicago'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { department: 'Cardiology' };
            const result = await hospitalService.getAllHospitals(query);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe(1);
            expect(result[1].id).toBe(3);
            
            // Both should have Cardiology department
            expect(result[0].departments).toContain('Cardiology');
            expect(result[1].departments).toContain('Cardiology');
        });

        it('should filter hospitals by service after repository call', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology', 'Neurology'],
                    services: ['Emergency', 'Surgery'],
                    location: 'New York'
                },
                {
                    id: 2,
                    name: 'Hospital Central',
                    departments: ['Pediatrics', 'Orthopedics'],
                    services: ['ICU', 'Radiology'],
                    location: 'Los Angeles'
                },
                {
                    id: 3,
                    name: 'Hospital Regional',
                    departments: ['Cardiology', 'Pediatrics'],
                    services: ['Emergency', 'ICU'],
                    location: 'Chicago'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { service: 'Emergency' };
            const result = await hospitalService.getAllHospitals(query);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe(1);
            expect(result[1].id).toBe(3);
            
            // Both should have Emergency service
            expect(result[0].services).toContain('Emergency');
            expect(result[1].services).toContain('Emergency');
        });

        it('should filter hospitals by department and service', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology', 'Neurology'],
                    services: ['Emergency', 'Surgery'],
                    location: 'New York'
                },
                {
                    id: 2,
                    name: 'Hospital Central',
                    departments: ['Pediatrics', 'Orthopedics'],
                    services: ['ICU', 'Radiology'],
                    location: 'Los Angeles'
                },
                {
                    id: 3,
                    name: 'Hospital Regional',
                    departments: ['Cardiology', 'Pediatrics'],
                    services: ['Emergency', 'ICU'],
                    location: 'Chicago'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { 
                department: 'Cardiology', 
                service: 'Emergency' 
            };
            const result = await hospitalService.getAllHospitals(query);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe(1);
            expect(result[1].id).toBe(3);
            
            // Both should have Cardiology department AND Emergency service
            expect(result[0].departments).toContain('Cardiology');
            expect(result[0].services).toContain('Emergency');
            expect(result[1].departments).toContain('Cardiology');
            expect(result[1].services).toContain('Emergency');
        });

        it('should filter hospitals by department with case-insensitive search', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology', 'Neurology'],
                    services: ['Emergency', 'Surgery'],
                    location: 'New York'
                },
                {
                    id: 2,
                    name: 'Hospital Central',
                    departments: ['PEDIATRICS', 'Orthopedics'],
                    services: ['ICU', 'Radiology'],
                    location: 'Los Angeles'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { department: 'pediatrics' };
            const result = await hospitalService.getAllHospitals(query);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(2);
            expect(result[0].departments).toContain('PEDIATRICS');
        });

        it('should filter hospitals by service with case-insensitive search', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology', 'Neurology'],
                    services: ['EMERGENCY', 'Surgery'],
                    location: 'New York'
                },
                {
                    id: 2,
                    name: 'Hospital Central',
                    departments: ['Pediatrics', 'Orthopedics'],
                    services: ['ICU', 'Radiology'],
                    location: 'Los Angeles'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { service: 'emergency' };
            const result = await hospitalService.getAllHospitals(query);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(1);
            expect(result[0].services).toContain('EMERGENCY');
        });

        it('should return empty array when no hospitals match department filter', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology', 'Neurology'],
                    services: ['Emergency', 'Surgery'],
                    location: 'New York'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { department: 'NonExistentDepartment' };
            const result = await hospitalService.getAllHospitals(query);

            expect(result).toEqual([]);
        });

        it('should return empty array when no hospitals match service filter', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology', 'Neurology'],
                    services: ['Emergency', 'Surgery'],
                    location: 'New York'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { service: 'NonExistentService' };
            const result = await hospitalService.getAllHospitals(query);

            expect(result).toEqual([]);
        });

        it('should apply pagination through repository', async () => {
            const mockHospitals: Hospital[] = [
                {
                    id: 1,
                    name: 'Hospital General',
                    departments: ['Cardiology'],
                    services: ['Emergency'],
                    location: 'New York'
                }
            ];

            hospitalRepositoryMock.findAll.mockResolvedValue(mockHospitals);

            const query: HospitalQueryParams = { page: 2, limit: 10 };
            await hospitalService.getAllHospitals(query);

            expect(hospitalRepositoryMock.findAll).toHaveBeenCalledWith(query);
        });
    });

    describe('getHospitalById', () => {
        it('should return hospital by id', async () => {
            const mockHospital: Hospital = {
                id: 1,
                name: 'Hospital General',
                departments: ['Cardiology', 'Neurology'],
                services: ['Emergency', 'Surgery'],
                location: 'New York'
            };

            hospitalRepositoryMock.findById.mockResolvedValue(mockHospital);

            const result = await hospitalService.getHospitalById(1);

            expect(hospitalRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockHospital);
        });

        it('should return null when hospital not found', async () => {
            hospitalRepositoryMock.findById.mockResolvedValue(null);

            const result = await hospitalService.getHospitalById(999);

            expect(result).toBeNull();
        });
    });
});