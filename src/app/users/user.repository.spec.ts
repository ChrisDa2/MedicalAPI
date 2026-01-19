import 'reflect-metadata';
import { UserRepository } from './user.repository';
import { DatabaseService } from '../../database/database.service';
import { UserRole } from './user.model';

// Mock DatabaseService
jest.mock('../../database/database.service');

describe('UserRepository', () => {
    let userRepository: UserRepository;
    let databaseServiceMock: jest.Mocked<DatabaseService>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock DatabaseService
        databaseServiceMock = {
            execQuery: jest.fn()
        } as unknown as jest.Mocked<DatabaseService>;

        userRepository = new UserRepository(databaseServiceMock);
    });

    describe('findById', () => {
        it('should query user by id', async () => {
            const mockUser = {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                password: 'hashedpassword',
                telephone: '123456789',
                role: UserRole.PATIENT,
                dateBirth: '1990-01-01'
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [mockUser],
                rowCount: 1
            });

            const result = await userRepository.findById(1);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: 'SELECT * FROM users WHERE id = ?',
                params: [1]
            });

            expect(result).toEqual(mockUser);
        });

        it('should return null when user not found', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0
            });

            const result = await userRepository.findById(999);

            expect(result).toBeNull();
        });
    });

    describe('findByEmail', () => {
        it('should query user by email', async () => {
            const mockUser = {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                password: 'hashedpassword',
                telephone: '123456789',
                role: UserRole.PATIENT,
                dateBirth: '1990-01-01'
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [mockUser],
                rowCount: 1
            });

            const result = await userRepository.findByEmail('john@example.com');

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: 'SELECT * FROM users WHERE email = ?',
                params: ['john@example.com']
            });

            expect(result).toEqual(mockUser);
        });

        it('should return null when email not found', async () => {
            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0
            });

            const result = await userRepository.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });
    });

    describe('createPatient', () => {
        it('should insert patient with correct parameters', async () => {
            const date = new Date('1990-01-01');
            const patientData = {
                name: 'John Doe',
                email: 'john@example.com',
                password: 'hashedpassword123',
                telephone: '123456789',
                role: UserRole.PATIENT,
                dateBirth: date
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                lastID: 5,
                changes: 1
            } as any);

            const result = await userRepository.createPatient(patientData);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('INSERT INTO users'),
                params: [
                    'John Doe',
                    'john@example.com',
                    'hashedpassword123',
                    '123456789',
                    UserRole.PATIENT,
                    date
                ]
            });

            expect(result).toBe(5);
        });
    });

    describe('createDoctor', () => {
        it('should insert doctor with all parameters including availability', async () => {
            const date = new Date('1990-05-15');
            const doctorData = {
                name: 'Dr. Smith',
                email: 'smith@example.com',
                password: 'hashedpassword123',
                telephone: '987654321',
                role: UserRole.DOCTOR,
                dateBirth: date,
                specialty: 'Cardiology',
                idHospital: 1,
                availability: [
                    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
                ]
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                lastID: 6,
                changes: 1
            } as any);

            const result = await userRepository.createDoctor(doctorData);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('INSERT INTO users'),
                params: [
                    'Dr. Smith',
                    'smith@example.com',
                    'hashedpassword123',
                    '987654321',
                    UserRole.DOCTOR,
                    date,
                    'Cardiology',
                    1,
                    JSON.stringify([{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }])
                ]
            });

            expect(result).toBe(6);
        });

        it('should insert doctor with null availability when not provided', async () => {
            const date = new Date('1990-05-15');
            const doctorData = {
                name: 'Dr. Smith',
                email: 'smith@example.com',
                password: 'hashedpassword123',
                telephone: '987654321',
                role: UserRole.DOCTOR,
                dateBirth: date,
                specialty: 'Cardiology',
                idHospital: 1
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                lastID: 6,
                changes: 1
            } as any);

            await userRepository.createDoctor(doctorData);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('INSERT INTO users'),
                params: expect.arrayContaining([null]) // availability should be null
            });
        });
    });

    describe('update', () => {
        it('should update user with correct parameters', async () => {
            const updates = {
                name: 'Updated Name',
                email: 'updated@example.com',
                telephone: '999999999'
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                changes: 1
            } as any);

            const result = await userRepository.update(1, updates);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('UPDATE users SET name = ?, email = ?, telephone = ? WHERE id = ?'),
                params: ['Updated Name', 'updated@example.com', '999999999', 1]
            });

            expect(result).toBe(true);
        });

        it('should update availability as JSON string', async () => {
            const updates = {
                availability: [
                    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
                    { dayOfWeek: 3, startTime: '10:00', endTime: '16:00' }
                ]
            };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 1,
                changes: 1
            } as any);

            await userRepository.update(1, updates);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('UPDATE users SET availability = ? WHERE id = ?'),
                params: [
                    JSON.stringify(updates.availability),
                    1
                ]
            });
        });

        it('should return false when no updates provided', async () => {
            const result = await userRepository.update(1, {});

            expect(databaseServiceMock.execQuery).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should return false when no rows affected', async () => {
            const updates = { name: 'New Name' };

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                changes: 0
            } as any);

            const result = await userRepository.update(999, updates);

            expect(result).toBe(false);
        });
    });

    describe('findAll', () => {
        it('should return all users when no role specified', async () => {
        const mockUsers = [
            {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            telephone: '123456789',
            role: UserRole.PATIENT,
            dateBirth: '1990-01-01',
            specialty: null,
            idHospital: null,
            availability: null
            },
            {
            id: 2,
            name: 'Dr. Smith',
            email: 'smith@example.com',
            telephone: '987654321',
            role: UserRole.DOCTOR,
            dateBirth: '1980-05-15',
            specialty: 'Cardiology',
            idHospital: 1,
            availability: JSON.stringify([{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }])
            }
        ];

        databaseServiceMock.execQuery.mockResolvedValue({
            rows: mockUsers,
            rowCount: 2
        });

        const result = await userRepository.findAll();

        expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
            sql: expect.stringContaining('SELECT id, name, email, telephone, role, dateBirth, specialty, idHospital, availability FROM users ORDER BY name'),
            params: []
        });
        
        expect(result).toHaveLength(2);
        
        const patient = result[0];
        expect(patient.id).toBe(1);
        expect(patient.name).toBe('John Doe');
        expect(patient.role).toBe(UserRole.PATIENT);
        
        const doctor = result[1] as any;
        
        expect(doctor.id).toBe(2);
        expect(doctor.name).toBe('Dr. Smith');
        expect(doctor.role).toBe(UserRole.DOCTOR);
        
        expect(doctor.specialty).toBe('Cardiology');
        expect(doctor.idHospital).toBe(1);
        expect(doctor.availability).toEqual([{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }]);
        });

        it('should filter users by role', async () => {
            const mockUsers = [
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: '1980-05-15',
                    specialty: 'Cardiology',
                    idHospital: 1,
                    availability: null
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockUsers,
                rowCount: 1
            });

            const result = await userRepository.findAll(UserRole.DOCTOR);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('WHERE role = ?'),
                params: [UserRole.DOCTOR]
            });

            expect(result).toHaveLength(1);
            expect(result[0].role).toBe(UserRole.DOCTOR);
        });
    });

    describe('findDoctorsBySpecialty', () => {
        it('should return doctors filtered by specialty', async () => {
            const mockDoctors = [
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: '1980-05-15',
                    specialty: 'Cardiology',
                    idHospital: 1,
                    availability: JSON.stringify([{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }])
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockDoctors,
                rowCount: 1
            });

            const result = await userRepository.findDoctorsBySpecialty('Cardiology');

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('WHERE role = ? AND specialty = ?'),
                params: [UserRole.DOCTOR, 'Cardiology']
            });

            expect(result).toHaveLength(1);
            expect(result[0].specialty).toBe('Cardiology');
            expect(result[0].role).toBe(UserRole.DOCTOR);
        });
    });

    describe('findDoctorsByHospital', () => {
        it('should return doctors filtered by hospital', async () => {
            const mockDoctors = [
                {
                    id: 2,
                    name: 'Dr. Smith',
                    email: 'smith@example.com',
                    telephone: '987654321',
                    role: UserRole.DOCTOR,
                    dateBirth: '1980-05-15',
                    specialty: 'Cardiology',
                    idHospital: 1,
                    availability: null
                }
            ];

            databaseServiceMock.execQuery.mockResolvedValue({
                rows: mockDoctors,
                rowCount: 1
            });

            const result = await userRepository.findDoctorsByHospital(1);

            expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
                sql: expect.stringContaining('WHERE role = ? AND idHospital = ?'),
                params: [UserRole.DOCTOR, 1]
            });

            expect(result).toHaveLength(1);
            expect(result[0].idHospital).toBe(1);
            expect(result[0].role).toBe(UserRole.DOCTOR);
        });
    });
});