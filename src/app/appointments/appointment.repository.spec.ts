import 'reflect-metadata';
import { AppointmentRepository } from './appointment.repository';
import { DatabaseService } from '../../database/database.service';
import { 
  AppointmentStatus, 
  AppointmentCreateData, 
  AppointmentUpdateData,
  AppointmentQueryParams 
} from './appointment.model';

// Mock DatabaseService
jest.mock('../../database/database.service');

describe('AppointmentRepository', () => {
  let appointmentRepository: AppointmentRepository;
  let databaseServiceMock: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock DatabaseService
    databaseServiceMock = {
      execQuery: jest.fn()
    } as unknown as jest.Mocked<DatabaseService>;

    appointmentRepository = new AppointmentRepository(databaseServiceMock);
  });

  describe('create', () => {
    it('should insert appointment with correct parameters', async () => {
      const appointmentDate = new Date('2024-01-15T10:00:00Z');
      const appointmentData: AppointmentCreateData = {
        date: appointmentDate,
        idPatient: 1,
        idDoctor: 2,
        idSpeciality: 3,
        location: 'Room 101'
      };

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        lastID: 100,
        changes: 1
      } as any);

      const result = await appointmentRepository.create(appointmentData);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: `INSERT INTO appointments (date, idPatient, idDoctor, idSpeciality, location, status) 
            VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          appointmentDate.toISOString(),
          1,
          2,
          3,
          'Room 101',
          AppointmentStatus.SCHEDULED
        ]
      });

      expect(result).toBe(100);
    });

    it('should return 0 when lastID is undefined', async () => {
      const appointmentData: AppointmentCreateData = {
        date: new Date(),
        idPatient: 1,
        idDoctor: 2,
        idSpeciality: 3,
        location: 'Room 101'
      };

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        lastID: undefined,
        changes: 1
      } as any);

      const result = await appointmentRepository.create(appointmentData);

      expect(result).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return appointment when found', async () => {
      const mockAppointment = {
        id: 1,
        date: '2024-01-15T10:00:00.000Z',
        idPatient: 1,
        idDoctor: 2,
        idSpeciality: 3,
        location: 'Room 101',
        status: AppointmentStatus.SCHEDULED
      };

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [mockAppointment],
        rowCount: 1
      });

      const result = await appointmentRepository.findById(1);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: `SELECT id, date, idPatient, idDoctor, idSpeciality, location, status 
            FROM appointments 
            WHERE id = ?`,
        params: [1]
      });

      expect(result).toEqual({
        ...mockAppointment,
        date: new Date(mockAppointment.date)
      });
    });

    it('should return null when appointment not found', async () => {
      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const result = await appointmentRepository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all appointments when no filters provided', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        },
        {
          id: 2,
          date: '2024-01-16T14:00:00.000Z',
          idPatient: 2,
          idDoctor: 3,
          idSpeciality: 4,
          location: 'Room 102',
          status: AppointmentStatus.COMPLETED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 2
      });

      const result = await appointmentRepository.findAll();

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('SELECT id, date, idPatient, idDoctor, idSpeciality, location, status'),
        params: []
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[0].date).toBeInstanceOf(Date);
    });

    it('should filter appointments by patient', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 1
      });

      const query: AppointmentQueryParams = {
        idPatient: 1
      };

      const result = await appointmentRepository.findAll(query);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('idPatient = ?'),
        params: [1]
      });

      expect(result).toHaveLength(1);
      expect(result[0].idPatient).toBe(1);
    });

    it('should filter appointments by doctor', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 1
      });

      const query: AppointmentQueryParams = {
        idDoctor: 2
      };

      const result = await appointmentRepository.findAll(query);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('idDoctor = ?'),
        params: [2]
      });

      expect(result).toHaveLength(1);
      expect(result[0].idDoctor).toBe(2);
    });

    it('should filter appointments by speciality', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 1
      });

      const query: AppointmentQueryParams = {
        idSpeciality: 3
      };

      const result = await appointmentRepository.findAll(query);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('idSpeciality = ?'),
        params: [3]
      });

      expect(result).toHaveLength(1);
      expect(result[0].idSpeciality).toBe(3);
    });

    it('should filter appointments by status', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 1
      });

      const query: AppointmentQueryParams = {
        status: AppointmentStatus.SCHEDULED
      };

      const result = await appointmentRepository.findAll(query);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('status = ?'),
        params: [AppointmentStatus.SCHEDULED]
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(AppointmentStatus.SCHEDULED);
    });

    it('should filter appointments by date range', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 1
      });

      const query: AppointmentQueryParams = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const result = await appointmentRepository.findAll(query);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('date >= ? AND date <= ?'),
        params: [
          '2024-01-01T00:00:00.000Z',
          '2024-01-31T00:00:00.000Z'
        ]
      });

      expect(result).toHaveLength(1);
    });

    it('should apply sorting', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 1
      });

      const query: AppointmentQueryParams = {
        sortBy: 'id',
        sortOrder: 'DESC'
      };

      await appointmentRepository.findAll(query);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('ORDER BY id DESC'),
        params: []
      });
    });

    it('should apply pagination', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 1
      });

      const query: AppointmentQueryParams = {
        page: 2,
        limit: 10
      };

      await appointmentRepository.findAll(query);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('LIMIT ? OFFSET ?'),
        params: [10, 10]
      });
    });
  });

  describe('update', () => {
    it('should update appointment with correct parameters', async () => {
      const updates: AppointmentUpdateData = {
        location: 'Room 202',
        status: AppointmentStatus.COMPLETED
      };

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        changes: 1
      } as any);

      const result = await appointmentRepository.update(1, updates);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('UPDATE appointments SET location = ?, status = ? WHERE id = ?'),
        params: ['Room 202', AppointmentStatus.COMPLETED, 1]
      });

      expect(result).toBe(true);
    });

    it('should convert date to ISO string when updating date', async () => {
      const newDate = new Date('2024-01-20T10:00:00Z');
      const updates: AppointmentUpdateData = {
        date: newDate
      };

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        changes: 1
      } as any);

      await appointmentRepository.update(1, updates);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: expect.stringContaining('UPDATE appointments SET date = ? WHERE id = ?'),
        params: [newDate.toISOString(), 1]
      });
    });

    it('should return false when no updates provided', async () => {
      const result = await appointmentRepository.update(1, {});

      expect(databaseServiceMock.execQuery).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false when no rows affected', async () => {
      const updates: AppointmentUpdateData = {
        status: AppointmentStatus.CANCELLED
      };

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        changes: 0
      } as any);

      const result = await appointmentRepository.update(999, updates);

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete appointment and return true when successful', async () => {
      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        changes: 1
      } as any);

      const result = await appointmentRepository.delete(1);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: 'DELETE FROM appointments WHERE id = ?',
        params: [1]
      });

      expect(result).toBe(true);
    });

    it('should return false when no rows deleted', async () => {
      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        changes: 0
      } as any);

      const result = await appointmentRepository.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('checkDoctorAvailability', () => {
    it('should return true when doctor is available', async () => {
      const date = new Date('2024-01-15T10:00:00Z');

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [{ count: 0 }],
        rowCount: 1
      });

      const result = await appointmentRepository.checkDoctorAvailability(2, date);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: `SELECT COUNT(*) as count 
            FROM appointments 
            WHERE idDoctor = ? 
            AND date = ? 
            AND status IN (?, ?)`,
        params: [2, date.toISOString(), AppointmentStatus.SCHEDULED, AppointmentStatus.RESCHEDULED]
      });

      expect(result).toBe(true);
    });

    it('should return false when doctor has conflicting appointment', async () => {
      const date = new Date('2024-01-15T10:00:00Z');

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [{ count: 1 }],
        rowCount: 1
      });

      const result = await appointmentRepository.checkDoctorAvailability(2, date);

      expect(result).toBe(false);
    });
  });

  describe('findAppointmentsByPatient', () => {
    it('should return appointments for specific patient', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 1
      });

      const result = await appointmentRepository.findAppointmentsByPatient(1);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: `SELECT id, date, idPatient, idDoctor, idSpeciality, location, status 
            FROM appointments 
            WHERE idPatient = ? 
            ORDER BY date DESC`,
        params: [1]
      });

      expect(result).toHaveLength(1);
      expect(result[0].idPatient).toBe(1);
      expect(result[0].date).toBeInstanceOf(Date);
    });

    it('should return empty array when patient has no appointments', async () => {
      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const result = await appointmentRepository.findAppointmentsByPatient(999);

      expect(result).toHaveLength(0);
    });
  });

  describe('findAppointmentsByDoctor', () => {
    it('should return appointments for specific doctor', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: '2024-01-15T10:00:00.000Z',
          idPatient: 1,
          idDoctor: 2,
          idSpeciality: 3,
          location: 'Room 101',
          status: AppointmentStatus.SCHEDULED
        }
      ];

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: mockAppointments,
        rowCount: 1
      });

      const result = await appointmentRepository.findAppointmentsByDoctor(2);

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: `SELECT id, date, idPatient, idDoctor, idSpeciality, location, status 
            FROM appointments 
            WHERE idDoctor = ? 
            ORDER BY date DESC`,
        params: [2]
      });

      expect(result).toHaveLength(1);
      expect(result[0].idDoctor).toBe(2);
      expect(result[0].date).toBeInstanceOf(Date);
    });

    it('should return empty array when doctor has no appointments', async () => {
      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const result = await appointmentRepository.findAppointmentsByDoctor(999);

      expect(result).toHaveLength(0);
    });
  });

  describe('mapAppointment', () => {
    it('should correctly map database row to Appointment object', async () => {
      const mockRow = {
        id: 1,
        date: '2024-01-15T10:00:00.000Z',
        idPatient: 1,
        idDoctor: 2,
        idSpeciality: 3,
        location: 'Room 101',
        status: AppointmentStatus.SCHEDULED
      };

      databaseServiceMock.execQuery.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1
      });

      // Use findById to test mapping
      const result = await appointmentRepository.findById(1);

      expect(result!.date).toBeInstanceOf(Date);
      expect(result!.date.toISOString()).toBe(mockRow.date);
    });
  });

  // ========== APPOINTMENT-SETTINGS TESTS ==========

  describe('getAppointmentSettings', () => {
    it('should return existing settings when available', async () => {
      const mockSettings = {
        id: 1,
        startTime: '08:00',
        endTime: '17:00',
        duration: 30
      };

      databaseServiceMock.execQuery.mockResolvedValueOnce({
        rows: [mockSettings],
        rowCount: 1
      });

      const result = await appointmentRepository.getAppointmentSettings();

      expect(databaseServiceMock.execQuery).toHaveBeenCalledWith({
        sql: 'SELECT * FROM appointment_settings ORDER BY id DESC LIMIT 1',
        params: []
      });

      expect(result).toEqual(mockSettings);
    });

    it('should create default settings when none exist', async () => {
      // First call: no settings found
      databaseServiceMock.execQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      // Second call: create default settings
      databaseServiceMock.execQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        lastID: 1,
        changes: 1
      } as any);

      const result = await appointmentRepository.getAppointmentSettings();

      // Should have called get settings first
      expect(databaseServiceMock.execQuery).toHaveBeenNthCalledWith(1, {
        sql: 'SELECT * FROM appointment_settings ORDER BY id DESC LIMIT 1',
        params: []
      });

      // Then should have created default settings
      expect(databaseServiceMock.execQuery).toHaveBeenNthCalledWith(2, {
        sql: `INSERT INTO appointment_settings (startTime, endTime, duration) 
            VALUES ('09:00', '18:00', 20)`,
        params: []
      });

      expect(result).toEqual({
        id: 1,
        startTime: '09:00',
        endTime: '18:00',
        duration: 20
      });
    });
  });

  describe('updateAppointmentSettings', () => {
    it('should update settings with new values', async () => {
      const currentSettings = {
        id: 1,
        startTime: '09:00',
        endTime: '18:00',
        duration: 20
      };

      const updates = {
        startTime: '08:00',
        duration: 30
      };

      // Get current settings
      databaseServiceMock.execQuery.mockResolvedValueOnce({
        rows: [currentSettings],
        rowCount: 1
      });

      // Insert new settings
      databaseServiceMock.execQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        lastID: 2,
        changes: 1
      } as any);

      const result = await appointmentRepository.updateAppointmentSettings(updates);

      // Should get current settings first
      expect(databaseServiceMock.execQuery).toHaveBeenNthCalledWith(1, {
        sql: 'SELECT * FROM appointment_settings ORDER BY id DESC LIMIT 1',
        params: []
      });

      // Should insert merged settings
      expect(databaseServiceMock.execQuery).toHaveBeenNthCalledWith(2, {
        sql: `INSERT INTO appointment_settings (startTime, endTime, duration) 
            VALUES (?, ?, ?)`,
        params: ['08:00', '18:00', 30]
      });

      expect(result).toBe(true);
    });

    it('should return false when insertion fails', async () => {
      const currentSettings = {
        id: 1,
        startTime: '09:00',
        endTime: '18:00',
        duration: 20
      };

      const updates = {
        startTime: '08:00'
      };

      // Get current settings
      databaseServiceMock.execQuery.mockResolvedValueOnce({
        rows: [currentSettings],
        rowCount: 1
      });

      // Insert new settings
      databaseServiceMock.execQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        lastID: 0,
        changes: 0
      } as any);

      const result = await appointmentRepository.updateAppointmentSettings(updates);

      expect(result).toBe(false);
    });
  });
});