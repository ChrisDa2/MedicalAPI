import { DatabaseService } from '../../database/database.service';
import { 
  Appointment, 
  AppointmentCreateData, 
  AppointmentUpdateData, 
  AppointmentQueryParams,
  AppointmentStatus, 
  AppointmentSettings,
  AppointmentSettingsUpdate
} from './appointment.model';

export class AppointmentRepository {
  constructor(private db: DatabaseService) {}

  async create(appointmentData: AppointmentCreateData): Promise<number> {
    const result = await this.db.execQuery({
      sql: `INSERT INTO appointments (date, idPatient, idDoctor, idSpeciality, location, status) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        appointmentData.date.toISOString(),
        appointmentData.idPatient,
        appointmentData.idDoctor,
        appointmentData.idSpeciality,
        appointmentData.location,
        AppointmentStatus.SCHEDULED
      ]
    });
    
    return (result as any).lastID || 0;
  }

  async findById(id: number): Promise<Appointment | null> {
    const result = await this.db.execQuery({
      sql: `SELECT id, date, idPatient, idDoctor, idSpeciality, location, status 
            FROM appointments 
            WHERE id = ?`,
      params: [id]
    });
    
    return result.rows[0] ? this.mapAppointment(result.rows[0]) : null;
  }

  async findAll(query: AppointmentQueryParams = {}): Promise<Appointment[]> {
    let sql = `SELECT id, date, idPatient, idDoctor, idSpeciality, location, status 
               FROM appointments WHERE 1=1`;
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (query.idPatient) {
      conditions.push('idPatient = ?');
      params.push(query.idPatient);
    }
    
    if (query.idDoctor) {
      conditions.push('idDoctor = ?');
      params.push(query.idDoctor);
    }
    
    if (query.idSpeciality) {
      conditions.push('idSpeciality = ?');
      params.push(query.idSpeciality);
    }
    
    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    
    if (query.startDate) {
      conditions.push('date >= ?');
      params.push(query.startDate.toISOString());
    }
    
    if (query.endDate) {
      conditions.push('date <= ?');
      params.push(query.endDate.toISOString());
    }
    
    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }
    
    // Sorting
    const sortBy = query.sortBy || 'date';
    const sortOrder = query.sortOrder || 'ASC';
    sql += ` ORDER BY ${sortBy} ${sortOrder}`;
    
    // Pagination
    if (query.page && query.limit) {
      const offset = (query.page - 1) * query.limit;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(query.limit, offset);
    }
    
    const result = await this.db.execQuery({ sql, params });
    
    return result.rows.map(row => this.mapAppointment(row));
  }

  async update(id: number, updates: AppointmentUpdateData): Promise<boolean> {
    const fields = Object.keys(updates);
    if (fields.length === 0) return false;
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => {
      const value = (updates as any)[f];
      
      if (f === 'date' && value instanceof Date) {
        return value.toISOString();
      }
      
      return value;
    });
    
    values.push(id);
    
    const result = await this.db.execQuery({
      sql: `UPDATE appointments SET ${setClause} WHERE id = ?`,
      params: values
    });
    
    return (result as any).changes > 0;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.execQuery({
      sql: 'DELETE FROM appointments WHERE id = ?',
      params: [id]
    });
    
    return (result as any).changes > 0;
  }

  async checkDoctorAvailability(idDoctor: number, date: Date): Promise<boolean> {
    const result = await this.db.execQuery({
      sql: `SELECT COUNT(*) as count 
            FROM appointments 
            WHERE idDoctor = ? 
            AND date = ? 
            AND status IN (?, ?)`,
      params: [
        idDoctor, 
        date.toISOString(), 
        AppointmentStatus.SCHEDULED, 
        AppointmentStatus.RESCHEDULED
      ]
    });
    
    return result.rows[0].count === 0;
  }

  async findAppointmentsByPatient(idPatient: number): Promise<Appointment[]> {
    const result = await this.db.execQuery({
      sql: `SELECT id, date, idPatient, idDoctor, idSpeciality, location, status 
            FROM appointments 
            WHERE idPatient = ? 
            ORDER BY date DESC`,
      params: [idPatient]
    });
    
    return result.rows.map(row => this.mapAppointment(row));
  }

  async findAppointmentsByDoctor(idDoctor: number): Promise<Appointment[]> {
    const result = await this.db.execQuery({
      sql: `SELECT id, date, idPatient, idDoctor, idSpeciality, location, status 
            FROM appointments 
            WHERE idDoctor = ? 
            ORDER BY date DESC`,
      params: [idDoctor]
    });
    
    return result.rows.map(row => this.mapAppointment(row));
  }

  private mapAppointment(row: any): Appointment {
    return {
      ...row,
      date: new Date(row.date)
    };
  }


  //  ==========  APPOINTMENT-SETTINGS ==========

  async getAppointmentSettings(): Promise<AppointmentSettings> {
    const result = await this.db.execQuery({
      sql: 'SELECT * FROM appointment_settings ORDER BY id DESC LIMIT 1',
      params: []
    });
    
    if (!result.rows[0]) {
      return await this.createDefaultSettings();
    }
    
    return result.rows[0];
  }

  async updateAppointmentSettings(updates: AppointmentSettingsUpdate): Promise<boolean> {
    const current = await this.getAppointmentSettings();
    const newSettings = { ...current, ...updates };
    
    const result = await this.db.execQuery({
      sql: `INSERT INTO appointment_settings (startTime, endTime, duration) 
            VALUES (?, ?, ?)`,
      params: [
        newSettings.startTime,
        newSettings.endTime,
        newSettings.duration
      ]
    });
    
    return (result as any).lastID > 0;
  }

  private async createDefaultSettings(): Promise<AppointmentSettings> {
    const result = await this.db.execQuery({
      sql: `INSERT INTO appointment_settings (startTime, endTime, duration) 
            VALUES ('09:00', '18:00', 20)`,
      params: []
    });
    
    return {
      id: (result as any).lastID,
      startTime: '09:00',
      endTime: '18:00',
      duration: 20
    };
  }
}