import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import { LogController } from './log.controller';
import { LogService } from './log.service';
import { LogRepository } from './log.repository';
import { DatabaseService } from '../../database/database.service';
import { UserRole } from '../users/user.model';

// Mock dependencies that the controller uses
jest.mock('../../database/database.service');
jest.mock('./log.repository');
jest.mock('./log.service');

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

// Mock authenticate and authorize from user.controller
jest.mock('../users/user.controller', () => ({
    authenticate: jest.fn((req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Token not provided or incorrect format' });
            return;
        }

        const token = authHeader.split(' ')[1];

        // Simple token validation
        if (token === 'admin-token') {
            req.user = { id: 1, role: UserRole.ADMIN };
            next();
        } else if (token === 'doctor-token') {
            req.user = { id: 2, role: UserRole.DOCTOR };
            next();
        } else if (token === 'patient-token') {
            req.user = { id: 3, role: UserRole.PATIENT };
            next();
        } else {
            res.status(401).json({ error: 'Invalid token' });
        }
    }),
    
    authorize: (roles: UserRole[]) => {
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
    }
}));

// Mock console.error and console.log
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('LogController', () => {
    let app: express.Express;
    let logServiceMock: jest.Mocked<LogService>;
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
        
        // Mock console methods
        console.error = jest.fn();
        console.log = jest.fn();

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        // Create mock service
        logServiceMock = {
            createLog: jest.fn(),
            getAllLogs: jest.fn(),
            getLogById: jest.fn()
        } as unknown as jest.Mocked<LogService>;

        // Mock constructors
        const LogServiceClass = require('./log.service').LogService;
        const LogRepositoryClass = require('./log.repository').LogRepository;

        const { Container } = require('typedi');
        (Container.get as jest.Mock).mockReturnValue(databaseServiceMock);

        (LogRepositoryClass as jest.Mock).mockImplementation(() => {
            return { db: databaseServiceMock };
        });

        (LogServiceClass as jest.Mock).mockImplementation(() => logServiceMock);

        const logController = new LogController();

        app = express();
        app.use(express.json());
        app.use('/api/logs', logController.getRouter());
    });

    afterEach(() => {
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
    });

    // ==================== ADMIN ROUTES TESTS ====================
    describe('GET /api/logs - Get All Logs', () => {
        it('should return all logs when authenticated as admin', async () => {
            const mockLogs = [createMockLog()];
            logServiceMock.getAllLogs.mockResolvedValue(mockLogs);

            const response = await request(app)
                .get('/api/logs')
                .set('Authorization', 'Bearer admin-token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.count).toBe(1);
            expect(response.body.logs[0].id).toBe(1);
            
            // El controller siempre pasa todos los campos, incluso undefined
            expect(logServiceMock.getAllLogs).toHaveBeenCalledWith({
                action: undefined,
                endDate: undefined,
                idUser: undefined,
                limit: 50,
                page: 1,
                resource: undefined,
                startDate: undefined
            });
        });

        it('should apply query filters when provided', async () => {
            const mockLogs = [createMockLog()];
            logServiceMock.getAllLogs.mockResolvedValue(mockLogs);

            const response = await request(app)
                .get('/api/logs')
                .query({
                    idUser: '1',
                    action: 'GET',
                    resource: '/api/users',
                    page: '2',
                    limit: '20'
                })
                .set('Authorization', 'Bearer admin-token');

            expect(response.status).toBe(200);
            expect(logServiceMock.getAllLogs).toHaveBeenCalledWith({
                idUser: 1,
                action: 'GET',
                resource: '/api/users',
                startDate: undefined,
                endDate: undefined,
                page: 2,
                limit: 20
            });
        });

        it('should apply default pagination when not provided', async () => {
            const mockLogs = [createMockLog()];
            logServiceMock.getAllLogs.mockResolvedValue(mockLogs);

            const response = await request(app)
                .get('/api/logs')
                .set('Authorization', 'Bearer admin-token');

            expect(response.status).toBe(200);
            expect(logServiceMock.getAllLogs).toHaveBeenCalledWith({
                idUser: undefined,
                action: undefined,
                resource: undefined,
                startDate: undefined,
                endDate: undefined,
                page: 1,
                limit: 50
            });
        });
    });

    describe('GET /api/logs/:id - Get Log By ID', () => {
        it('should return log when authenticated as admin and log exists', async () => {
            const mockLog = createMockLog();
            logServiceMock.getLogById.mockResolvedValue(mockLog);

            const response = await request(app)
                .get('/api/logs/1')
                .set('Authorization', 'Bearer admin-token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.log.id).toBe(1);
            expect(logServiceMock.getLogById).toHaveBeenCalledWith(1);
        });

        it('should return 400 when ID is invalid', async () => {
            const response = await request(app)
                .get('/api/logs/invalid')
                .set('Authorization', 'Bearer admin-token');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid ID');
        });

        it('should return 400 when ID is zero or negative', async () => {
            const response = await request(app)
                .get('/api/logs/0')
                .set('Authorization', 'Bearer admin-token');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid ID');
        });

        it('should return 404 when log not found', async () => {
            logServiceMock.getLogById.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/logs/999')
                .set('Authorization', 'Bearer admin-token');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Log not found');
        });

        it('should return 403 when not an admin', async () => {
            const response = await request(app)
                .get('/api/logs/1')
                .set('Authorization', 'Bearer patient-token');

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Access denied');
        });
    });

    // ==================== LOG MIDDLEWARE TESTS ====================
    describe('Log Middleware', () => {
        let logMiddleware: any;
        let logServiceInstanceMock: jest.Mocked<LogService>;

        beforeEach(() => {
            jest.clearAllMocks();

            // Create separate mock for middleware tests
            logServiceInstanceMock = {
                createLog: jest.fn()
            } as unknown as jest.Mocked<LogService>;

            const LogServiceClass = require('./log.service').LogService;
            (LogServiceClass as jest.Mock).mockImplementation(() => logServiceInstanceMock);

            const logControllerExports = require('./log.controller');
            logMiddleware = logControllerExports.logMiddleware;
        });

        it('should call next() immediately', () => {
            const nextMock = jest.fn();
            const req = {
                method: 'GET',
                baseUrl: '',
                path: '/test',
                user: null
            } as any;
            
            const res = {
                statusCode: 200,
                on: jest.fn()
            } as any;

            logMiddleware(req, res, nextMock);

            expect(nextMock).toHaveBeenCalled();
        });

        it('should set up finish event listener', () => {
            const nextMock = jest.fn();
            const req = {
                method: 'POST',
                baseUrl: '/api',
                path: '/users',
                user: { id: 1 }
            } as any;
            
            const mockOn = jest.fn();
            const res = {
                statusCode: 201,
                on: mockOn
            } as any;

            logMiddleware(req, res, nextMock);

            // Verify that on was called with 'finish' event
            expect(mockOn).toHaveBeenCalledWith('finish', expect.any(Function));
        });

        it('should create log entry when finish event is triggered', async () => {
            const nextMock = jest.fn();
            const req = {
                method: 'POST',
                baseUrl: '/api',
                path: '/users',
                user: { id: 1 }
            } as any;
            
            const finishCallbacks: Function[] = [];
            const res = {
                statusCode: 201,
                on: jest.fn((event: string, callback: Function) => {
                    if (event === 'finish') {
                        finishCallbacks.push(callback);
                    }
                })
            } as any;

            logServiceInstanceMock.createLog.mockResolvedValue(1);

            logMiddleware(req, res, nextMock);

            for (const callback of finishCallbacks) {
                await callback();
            }
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));
            
            expect(logServiceInstanceMock.createLog).toHaveBeenCalledWith({
                idUser: 1,
                action: 'POST',
                resource: '/api/users',
                details: 'POST /api/users - Status: 201'
            });
        });

        it('should not create log for GET requests to /logs endpoint', async () => {
            const nextMock = jest.fn();
            const req = {
                method: 'GET',
                baseUrl: '/api',
                path: '/logs',
                user: { id: 1 }
            } as any;
            
            const finishCallbacks: Function[] = [];
            const res = {
                statusCode: 200,
                on: jest.fn((event: string, callback: Function) => {
                    if (event === 'finish') {
                        finishCallbacks.push(callback);
                    }
                })
            } as any;

            logMiddleware(req, res, nextMock);

            for (const callback of finishCallbacks) {
                await callback();
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            expect(logServiceInstanceMock.createLog).not.toHaveBeenCalled();
        });

        it('should handle log creation errors gracefully', async () => {
            const originalConsoleError = console.error;
            console.error = jest.fn();

            const nextMock = jest.fn();
            const req = {
                method: 'POST',
                baseUrl: '/api',
                path: '/users',
                user: { id: 1 }
            } as any;
            
            const finishCallbacks: Function[] = [];
            const res = {
                statusCode: 201,
                on: jest.fn((event: string, callback: Function) => {
                    if (event === 'finish') {
                        finishCallbacks.push(callback);
                    }
                })
            } as any;

            logServiceInstanceMock.createLog.mockRejectedValue(new Error('DB error'));

            logMiddleware(req, res, nextMock);

            for (const callback of finishCallbacks) {
                await callback();
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            expect(console.error).toHaveBeenCalledWith('Failed to save log:', expect.any(Error));

            console.error = originalConsoleError;
        });
    });
});