import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import { Container } from 'typedi';
import { HospitalController } from './hospital.controller';
import { HospitalService } from './hospital.service';
import { HospitalRepository } from './hospital.repository';
import { DatabaseService } from '../../database/database.service';

// Mock dependencies
jest.mock('./hospital.service');
jest.mock('./hospital.repository');
jest.mock('../../database/database.service');

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

// Mock console.error and console.log
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('HospitalController', () => {
    let app: express.Express;
    let hospitalServiceMock: jest.Mocked<HospitalService>;
    let databaseServiceMock: jest.Mocked<DatabaseService>;

    const createMockHospital = (overrides = {}) => ({
        id: 1,
        name: 'Hospital General',
        departments: ['Cardiology', 'Neurology'],
        services: ['Emergency', 'Surgery'],
        location: 'New York',
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock console methods
        console.error = jest.fn();
        console.log = jest.fn();

        // Create mocks
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        hospitalServiceMock = {
            getAllHospitals: jest.fn(),
            getHospitalById: jest.fn()
        } as unknown as jest.Mocked<HospitalService>;

        // Mock Container.get to return our mock DatabaseService
        (Container.get as jest.Mock).mockImplementation((service: any) => {
            if (service === DatabaseService) {
                return databaseServiceMock;
            }
            throw new Error(`Unmocked service: ${service}`);
        });

        // Mock HospitalService constructor
        const HospitalServiceMock = HospitalService as jest.MockedClass<typeof HospitalService>;
        HospitalServiceMock.mockImplementation(() => hospitalServiceMock);

        // Mock HospitalRepository constructor
        const HospitalRepositoryMock = HospitalRepository as jest.MockedClass<typeof HospitalRepository>;
        HospitalRepositoryMock.mockImplementation(() => {
            return {} as HospitalRepository;
        });

        const hospitalController = new HospitalController();
        
        app = express();
        app.use(express.json());
        app.use('/api/hospitals', hospitalController.getRouter());
    });

    afterEach(() => {
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
    });

    // ==================== PUBLIC ROUTES TESTS ====================
    describe('Public Routes', () => {
        describe('GET /api/hospitals - Get All Hospitals', () => {
            it('should return all hospitals with default pagination', async () => {
                const mockHospitals = [
                    createMockHospital(),
                    createMockHospital({ id: 2, name: 'Hospital Central' })
                ];

                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(2);
                expect(response.body.hospitals).toEqual(mockHospitals);
                expect(hospitalServiceMock.getAllHospitals).toHaveBeenCalledWith({
                    page: 1,
                    limit: 20
                });
            });

            it('should return hospitals with custom pagination', async () => {
                const mockHospitals = [createMockHospital()];
                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals?page=2&limit=10');

                expect(response.status).toBe(200);
                expect(hospitalServiceMock.getAllHospitals).toHaveBeenCalledWith({
                    page: 2,
                    limit: 10
                });
            });

            it('should handle invalid page parameter gracefully', async () => {
                const mockHospitals = [createMockHospital()];
                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals?page=invalid&limit=10');

                expect(response.status).toBe(200);
                expect(hospitalServiceMock.getAllHospitals).toHaveBeenCalledWith({
                    page: NaN,
                    limit: 10
                });
            });

            it('should handle invalid limit parameter gracefully', async () => {
                const mockHospitals = [createMockHospital()];
                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals?page=1&limit=invalid');

                expect(response.status).toBe(200);
                expect(hospitalServiceMock.getAllHospitals).toHaveBeenCalledWith({
                    page: 1,
                    limit: NaN
                });
            });

            it('should return 500 on internal error', async () => {
                hospitalServiceMock.getAllHospitals.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/hospitals');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
                expect(response.body.message).toBe('Could not retrieve hospitals');
            });
        });

        describe('GET /api/hospitals/:id - Get Hospital by ID', () => {
            it('should return hospital when found', async () => {
                const mockHospital = createMockHospital();
                hospitalServiceMock.getHospitalById.mockResolvedValue(mockHospital);

                const response = await request(app)
                    .get('/api/hospitals/1');

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.hospital).toEqual(mockHospital);
                expect(hospitalServiceMock.getHospitalById).toHaveBeenCalledWith(1);
            });

            it('should return 400 when ID is invalid', async () => {
                const response = await request(app)
                    .get('/api/hospitals/invalid');

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid ID');
                expect(response.body.message).toBe('Hospital ID must be a positive number');
            });

            it('should return 400 when ID is zero or negative', async () => {
                const response = await request(app)
                    .get('/api/hospitals/0');

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('Invalid ID');
            });

            it('should return 404 when hospital not found', async () => {
                hospitalServiceMock.getHospitalById.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/hospitals/999');

                expect(response.status).toBe(404);
                expect(response.body.error).toBe('Hospital not found');
                expect(response.body.message).toBe('Hospital with ID 999 not found');
            });

            it('should return 500 on internal error', async () => {
                hospitalServiceMock.getHospitalById.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get('/api/hospitals/1');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Internal error');
                expect(response.body.message).toBe('Could not retrieve hospital');
            });
        });

        describe('GET /api/hospitals/search - Search Hospitals', () => {
            it('should search hospitals with filters', async () => {
                const mockHospitals = [createMockHospital()];
                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals/search')
                    .send({
                        name: 'General',
                        department: 'Cardiology',
                        service: 'Emergency',
                        location: 'New York',
                        page: 1,
                        limit: 10
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.count).toBe(1);
                expect(hospitalServiceMock.getAllHospitals).toHaveBeenCalledWith({
                    name: 'General',
                    department: 'Cardiology',
                    service: 'Emergency',
                    location: 'New York',
                    page: 1,
                    limit: 10
                });
            });

            it('should search hospitals with partial filters', async () => {
                const mockHospitals = [createMockHospital()];
                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals/search')
                    .send({ name: 'General', page: 2 });

                expect(response.status).toBe(200);
                expect(hospitalServiceMock.getAllHospitals).toHaveBeenCalledWith({
                    name: 'General',
                    department: undefined,
                    service: undefined,
                    location: undefined,
                    page: 2,
                    limit: 20
                });
            });

            it('should use default pagination when not specified', async () => {
                const mockHospitals = [createMockHospital()];
                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals/search')
                    .send({ name: 'General' });

                expect(response.status).toBe(200);
                expect(hospitalServiceMock.getAllHospitals).toHaveBeenCalledWith({
                    name: 'General',
                    department: undefined,
                    service: undefined,
                    location: undefined,
                    page: 1,
                    limit: 20
                });
            });

            it('should handle invalid pagination parameters', async () => {
                const mockHospitals = [createMockHospital()];
                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals/search')
                    .send({ 
                        name: 'General',
                        page: 'invalid',
                        limit: 'invalid'
                    });

                expect(response.status).toBe(200);
                expect(hospitalServiceMock.getAllHospitals).toHaveBeenCalledWith({
                    name: 'General',
                    department: undefined,
                    service: undefined,
                    location: undefined,
                    page: NaN,
                    limit: NaN
                });
            });

            it('should return 500 on search error', async () => {
                hospitalServiceMock.getAllHospitals.mockRejectedValue(new Error('Search error'));

                const response = await request(app)
                    .get('/api/hospitals/search')
                    .send({
                        name: 'General',
                        department: 'Cardiology',
                        service: 'Emergency',
                        location: 'New York',
                        page: 1,
                        limit: 10
                    });

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Search error');
                expect(response.body.message).toBe('Could not search hospitals');
            });

            it('should handle empty search body', async () => {
                const mockHospitals = [createMockHospital()];
                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals/search')
                    .send({});

                expect(response.status).toBe(200);
                expect(hospitalServiceMock.getAllHospitals).toHaveBeenCalledWith({
                    name: undefined,
                    department: undefined,
                    service: undefined,
                    location: undefined,
                    page: 1,
                    limit: 20
                });
            });

            it('should handle missing search body', async () => {
                const mockHospitals = [createMockHospital()];
                hospitalServiceMock.getAllHospitals.mockResolvedValue(mockHospitals);

                const response = await request(app)
                    .get('/api/hospitals/search');

                expect(response.status).toBe(500);
                expect(response.body.error).toBe('Search error');
            });
        });
    });
});