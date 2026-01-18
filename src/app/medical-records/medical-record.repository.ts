import { DatabaseService } from '../../database/database.service';
import { 
  MedicalRecord, 
  MedicalRecordCreateData, 
  MedicalRecordUpdateData,
  MedicalRecordQueryParams 
} from './medical-record.model';

export class MedicalRecordRepository {
  constructor(private db: DatabaseService) {}

  async create(medicalRecordData: MedicalRecordCreateData): Promise<number> {
    const result = await this.db.execQuery({
      sql: `INSERT INTO medical_records (idAppointment, date, idPatient, idDoctor, idSpeciality, description, treatment, testResults) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        medicalRecordData.idAppointment,
        new Date().toISOString(),
        medicalRecordData.idPatient,
        medicalRecordData.idDoctor,
        medicalRecordData.idSpeciality,
        medicalRecordData.description,
        medicalRecordData.treatment,
        medicalRecordData.testResults ? JSON.stringify(medicalRecordData.testResults) : null
      ]
    });
    
    return (result as any).lastID || 0;
  }

  async findById(id: number): Promise<MedicalRecord | null> {
    const result = await this.db.execQuery({
      sql: `SELECT id, idAppointment, date, idPatient, idDoctor, idSpeciality, description, treatment, testResults 
            FROM medical_records 
            WHERE id = ?`,
      params: [id]
    });
    
    return result.rows[0] ? this.mapMedicalRecord(result.rows[0]) : null;
  }

  async findAll(query: MedicalRecordQueryParams = {}): Promise<MedicalRecord[]> {
    let sql = `SELECT id, idAppointment, date, idPatient, idDoctor, idSpeciality, description, treatment, testResults 
               FROM medical_records WHERE 1=1`;
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
    
    // Sorting (recentst first by default)
    const sortBy = query.sortBy || 'date';
    const sortOrder = query.sortOrder || 'DESC';
    sql += ` ORDER BY ${sortBy} ${sortOrder}`;
    
    // Pagination
    if (query.page && query.limit) {
      const offset = (query.page - 1) * query.limit;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(query.limit, offset);
    }
    
    const result = await this.db.execQuery({ sql, params });
    
    return result.rows.map(row => this.mapMedicalRecord(row));
  }

  async update(id: number, updates: MedicalRecordUpdateData): Promise<boolean> {
    const fields = Object.keys(updates);
    if (fields.length === 0) return false;
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => {
      const value = (updates as any)[f];
      
      if (f === 'testResults') {
        return value ? JSON.stringify(value) : null;
      }
      
      return value;
    });
    
    values.push(id);
    
    const result = await this.db.execQuery({
      sql: `UPDATE medical_records SET ${setClause} WHERE id = ?`,
      params: values
    });
    
    return (result as any).changes > 0;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.execQuery({
      sql: 'DELETE FROM medical_records WHERE id = ?',
      params: [id]
    });
    
    return (result as any).changes > 0;
  }

  async findByPatientId(idPatient: number): Promise<MedicalRecord[]> {
    const result = await this.db.execQuery({
      sql: `SELECT id, idAppointment, date, idPatient, idDoctor, idSpeciality, description, treatment, testResults 
            FROM medical_records 
            WHERE idPatient = ? 
            ORDER BY date DESC`,
      params: [idPatient]
    });
    
    return result.rows.map(row => this.mapMedicalRecord(row));
  }

  async findByDoctorId(idDoctor: number): Promise<MedicalRecord[]> {
    const result = await this.db.execQuery({
      sql: `SELECT id, idAppointment, date, idPatient, idDoctor, idSpeciality, description, treatment, testResults 
            FROM medical_records 
            WHERE idDoctor = ? 
            ORDER BY date DESC`,
      params: [idDoctor]
    });
    
    return result.rows.map(row => this.mapMedicalRecord(row));
  }

  async findByAppointmentId(idAppointment: number): Promise<MedicalRecord | null> {
    const result = await this.db.execQuery({
      sql: `SELECT id, idAppointment, date, idPatient, idDoctor, idSpeciality, description, treatment, testResults 
            FROM medical_records 
            WHERE idAppointment = ?`,
      params: [idAppointment]
    });
    
    return result.rows[0] ? this.mapMedicalRecord(result.rows[0]) : null;
  }

  async searchByPatientName(patientName: string): Promise<MedicalRecord[]> {
    const result = await this.db.execQuery({
      sql: `SELECT mr.* 
            FROM medical_records mr
            JOIN users u ON mr.idPatient = u.id
            WHERE u.name LIKE ?
            ORDER BY mr.date DESC`,
      params: [`%${patientName}%`]
    });
    
    return result.rows.map(row => this.mapMedicalRecord(row));
  }

  private mapMedicalRecord(row: any): MedicalRecord {
    return {
      ...row,
      date: new Date(row.date),
      testResults: row.testResults ? JSON.parse(row.testResults) : []
    };
  }
}