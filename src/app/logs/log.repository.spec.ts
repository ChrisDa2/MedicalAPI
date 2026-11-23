import 'reflect-metadata';
import { LogRepository } from './log.repository';
import { DatabaseService } from '../../database/database.service';

// Mock DatabaseService
jest.mock('../../database/database.service');

describe('LogRepository', () => {
    let logRepository: LogRepository;
    let databaseServiceMock: jest.Mocked<DatabaseService>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        logRepository = new LogRepository(databaseServiceMock);
    });

    describe('create', () => {
        it('should insert log and return the new ID', async () => {
            const logData = {
                idUser: 1,
                action: 'POST',
                resource: '/api/users',
                details: 'User created'
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                lastID: 5,
                changes: 1
            } as any);

            const result = await logRepository.create(logData);

            expect(result).toBe(5);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: `INSERT INTO logs (idUser, action, resource, details) 
            VALUES (?, ?, ?, ?)`,
                params: [1, 'POST', '/api/users', 'User created']
            });
        });

        it('should insert log with null userId', async () => {
            const logData = {
                idUser: null,
                action: 'GET',
                resource: '/api/public',
                details: null
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                lastID: 6,
                changes: 1
            } as any);

            const result = await logRepository.create(logData);

            expect(result).toBe(6);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: `INSERT INTO logs (idUser, action, resource, details) 
            VALUES (?, ?, ?, ?)`,
                params: [null, 'GET', '/api/public', null]
            });
        });

        it('should insert log with null details', async () => {
            const logData = {
                idUser: 1,
                action: 'PUT',
                resource: '/api/users/1'
            } as any; // details is optional

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                lastID: 7,
                changes: 1
            } as any);

            const result = await logRepository.create(logData);

            expect(result).toBe(7);
            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: `INSERT INTO logs (idUser, action, resource, details) 
            VALUES (?, ?, ?, ?)`,
                params: [1, 'PUT', '/api/users/1', null]
            });
        });
    });

    describe('findAll', () => {
        it('should return all logs when no query params', async () => {
            const mockLogs = [
                {
                    id: 1,
                    idUser: 1,
                    action: 'GET',
                    resource: '/api/users',
                    timestamp: '2024-01-15T10:00:00.000Z',
                    details: 'GET /api/users - Status: 200'
                },
                {
                    id: 2,
                    idUser: null,
                    action: 'POST',
                    resource: '/api/login',
                    timestamp: '2024-01-15T11:00:00.000Z',
                    details: null
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockLogs,
                rowCount: 2
            });

            const result = await logRepository.findAll();

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe(1);
            expect(result[0].timestamp).toBeInstanceOf(Date);
            expect(result[0].idUser).toBe(1);
            expect(result[1].id).toBe(2);
            expect(result[1].idUser).toBeNull();
            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: `SELECT id, idUser, action, resource, timestamp, details 
               FROM logs WHERE 1=1 ORDER BY timestamp DESC`,
                params: []
            });
        });

        it('should return filtered logs with query params', async () => {
            const mockLogs = [
                {
                    id: 1,
                    idUser: 1,
                    action: 'GET',
                    resource: '/api/users',
                    timestamp: '2024-01-15T10:00:00.000Z',
                    details: 'GET /api/users - Status: 200'
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockLogs,
                rowCount: 1
            });

            const queryParams = {
                idUser: 1,
                action: 'GET',
                resource: '/api/users',
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                page: 1,
                limit: 10
            };

            const result = await logRepository.findAll(queryParams);

            expect(result).toHaveLength(1);
            expect(result[0].idUser).toBe(1);
            expect(result[0].action).toBe('GET');
            
            expect(databaseServiceMock.execQuery).toHaveBeenCalled();
            
            const call = databaseServiceMock.execQuery.mock.calls[0][0];
            expect(call.sql).toContain('SELECT id, idUser, action, resource, timestamp, details');
            expect(call.sql).toContain('FROM logs WHERE 1=1');
            expect(call.sql).toContain('ORDER BY timestamp DESC');
            expect(call.sql).toContain('LIMIT ? OFFSET ?');
            
            expect(call.params).toContain(1);
            expect(call.params).toContain('GET');
            expect(call.params).toContain('/api/users');
            expect(call.params).toContain('2024-01-01');
            expect(call.params).toContain('2024-01-31');
            expect(call.params).toContain(10);
            expect(call.params).toContain(0);
        });

        it('should handle pagination correctly', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0
            });

            const queryParams = {
                page: 3,
                limit: 25
            };

            await logRepository.findAll(queryParams);

            const call = databaseServiceMock.execQuery.mock.calls[0][0];
            expect(call.params).toContain(25);
            expect(call.params).toContain(50);
        });
    });

    describe('findById', () => {
        it('should return log when found', async () => {
            const mockLog = {
                id: 1,
                idUser: 1,
                action: 'GET',
                resource: '/api/users',
                timestamp: '2024-01-15T10:00:00.000Z',
                details: 'GET /api/users - Status: 200'
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [mockLog],
                rowCount: 1
            });

            const result = await logRepository.findById(1);

            expect(result).toEqual({
                id: 1,
                idUser: 1,
                action: 'GET',
                resource: '/api/users',
                timestamp: new Date('2024-01-15T10:00:00.000Z'),
                details: 'GET /api/users - Status: 200'
            });
            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: `SELECT id, idUser, action, resource, timestamp, details 
            FROM logs WHERE id = ?`,
                params: [1]
            });
        });

        it('should return null when log not found', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0
            });

            const result = await logRepository.findById(999);

            expect(result).toBeNull();
            expect(databaseServiceMock.execQuery).toHaveBeenCalledTimes(1);
        });
    });
});