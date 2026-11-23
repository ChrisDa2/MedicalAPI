import 'reflect-metadata';
import { LogService } from './log.service';
import { LogRepository } from './log.repository';
import { DatabaseService } from '../../database/database.service';

// Mock dependencies
jest.mock('./log.repository');
jest.mock('../../database/database.service');

// Mock Container.get for DatabaseService
jest.mock('typedi', () => ({
    Container: {
        get: jest.fn(),
        set: jest.fn(),
        reset: jest.fn()
    },
    Service: () => (target: any) => target
}));

describe('LogService', () => {
    let logService: LogService;
    let logRepositoryMock: jest.Mocked<LogRepository>;
    let databaseServiceMock: jest.Mocked<DatabaseService>;

    const createMockLog = (overrides = {}) => ({
        id: 1,
        idUser: 1,
        action: 'GET',
        resource: '/api/users',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        details: 'GET /api/users - Status: 200',
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock LogRepository
        logRepositoryMock = {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn()
        } as unknown as jest.Mocked<LogRepository>;

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        // Mock Container.get to return¡
        const { Container } = require('typedi');
        (Container.get as jest.Mock).mockReturnValue(databaseServiceMock);

        logService = new LogService(logRepositoryMock);
    });

    describe('createLog', () => {
        const validLogData = {
            idUser: 1,
            action: 'POST',
            resource: '/api/users',
            details: 'User created'
        };

        it('should create log and return the new ID', async () => {
            logRepositoryMock.create.mockResolvedValue(1);

            const result = await logService.createLog(validLogData);

            expect(logRepositoryMock.create).toHaveBeenCalledWith(validLogData);
            expect(result).toBe(1);
        });

        it('should handle null userId', async () => {
            const logData = {
                idUser: null,
                action: 'GET',
                resource: '/api/public',
                details: 'Public access'
            };

            logRepositoryMock.create.mockResolvedValue(2);

            const result = await logService.createLog(logData);

            expect(logRepositoryMock.create).toHaveBeenCalledWith(logData);
            expect(result).toBe(2);
        });

        it('should handle undefined details', async () => {
            const logData = {
                idUser: 1,
                action: 'PUT',
                resource: '/api/users/1'
            };

            logRepositoryMock.create.mockResolvedValue(3);

            const result = await logService.createLog(logData);

            expect(logRepositoryMock.create).toHaveBeenCalledWith(logData);
            expect(result).toBe(3);
        });
    });

    describe('getAllLogs', () => {
        it('should return all logs when no query params', async () => {
            const mockLogs = [createMockLog()];
            logRepositoryMock.findAll.mockResolvedValue(mockLogs);

            const result = await logService.getAllLogs();

            expect(logRepositoryMock.findAll).toHaveBeenCalledWith({});
            expect(result).toEqual(mockLogs);
        });

        it('should return filtered logs with query params', async () => {
            const mockLogs = [createMockLog()];
            const queryParams = {
                idUser: 1,
                action: 'GET',
                resource: '/api/users',
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                page: 2,
                limit: 20
            };

            logRepositoryMock.findAll.mockResolvedValue(mockLogs);

            const result = await logService.getAllLogs(queryParams);

            expect(logRepositoryMock.findAll).toHaveBeenCalledWith(queryParams);
            expect(result).toEqual(mockLogs);
        });

        it('should handle empty result set', async () => {
            logRepositoryMock.findAll.mockResolvedValue([]);

            const result = await logService.getAllLogs();

            expect(result).toEqual([]);
        });
    });

    describe('getLogById', () => {
        it('should return log when found', async () => {
            const mockLog = createMockLog();
            logRepositoryMock.findById.mockResolvedValue(mockLog);

            const result = await logService.getLogById(1);

            expect(logRepositoryMock.findById).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockLog);
        });

        it('should return null when log not found', async () => {
            logRepositoryMock.findById.mockResolvedValue(null);

            const result = await logService.getLogById(999);

            expect(result).toBeNull();
        });
    });
});