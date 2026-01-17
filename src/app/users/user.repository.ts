import { DatabaseService } from '../../database/database.service';
import { User, Patient, Doctor, UserRole } from './user.model';

export class UserRepository {
  constructor(private db: DatabaseService) {}

  async findById(id: number): Promise<User | null> {
    const result = await this.db.execQuery({
      sql: 'SELECT * FROM users WHERE id = ?',
      params: [id]
    });
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.execQuery({
      sql: 'SELECT * FROM users WHERE email = ?',
      params: [email]
    });
    return result.rows[0] || null;
  }

  async createPatient(patientData: Omit<Patient, 'id'>): Promise<number> {
    const result = await this.db.execQuery({
      sql: `INSERT INTO users (name, email, password, telephone, role, dateBirth) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        patientData.name,
        patientData.email,
        patientData.password,
        patientData.telephone,
        UserRole.PATIENT,
        patientData.dateBirth
      ]
    });
    
    return (result as any).lastID || 0;
  }

  async createDoctor(doctorData: Omit<Doctor, 'id'>): Promise<number> {
    const result = await this.db.execQuery({
      sql: `INSERT INTO users (name, email, password, telephone, role, dateBirth, specialty, idHospital, availability) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        doctorData.name,
        doctorData.email,
        doctorData.password,
        doctorData.telephone,
        UserRole.DOCTOR,
        doctorData.dateBirth,
        doctorData.specialty,
        doctorData.idHospital,
        doctorData.availability ? JSON.stringify(doctorData.availability) : null
      ]
    });
    
    return (result as any).lastID || 0;
  }

  async update(id: number, updates: Partial<Omit<User, 'id' | 'role'>>): Promise<boolean> {
    const fields = Object.keys(updates);
    if (fields.length === 0) return false;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => {
      const value = (updates as any)[f];
      
      if (f === 'availability') {
        return value ? JSON.stringify(value) : null;
      }
      
      return value;
    });
    
    values.push(id);
    
    const result = await this.db.execQuery({
      sql: `UPDATE users SET ${setClause} WHERE id = ?`,
      params: values
    });
    
    return (result as any).changes > 0;
  }

  async findAll(role?: UserRole): Promise<User[]> {
    let sql = 'SELECT id, name, email, telephone, role, dateBirth, specialty, idHospital, availability FROM users';
    const params: any[] = [];
    
    if (role) {
      sql += ' WHERE role = ?';
      params.push(role);
    }
    
    sql += ' ORDER BY name';
    
    const result = await this.db.execQuery({ sql, params });
    
    return result.rows.map((row: any) => ({
      ...row,
      availability: row.availability ? JSON.parse(row.availability) : undefined
    }));
  }

  async findDoctorsBySpecialty(specialty: string): Promise<Doctor[]> {
    const result = await this.db.execQuery({
      sql: `SELECT id, name, email, telephone, role, dateBirth, specialty, idHospital, availability 
            FROM users 
            WHERE role = ? AND specialty = ?
            ORDER BY name`,
      params: [UserRole.DOCTOR, specialty]
    });
    
    return result.rows.map((row: any) => ({
      ...row,
      availability: row.availability ? JSON.parse(row.availability) : undefined
    }));
  }

  async findDoctorsByHospital(hospitalId: number): Promise<Doctor[]> {
    const result = await this.db.execQuery({
      sql: `SELECT id, name, email, telephone, role, dateBirth, specialty, idHospital, availability 
            FROM users 
            WHERE role = ? AND idHospital = ?
            ORDER BY name`,
      params: [UserRole.DOCTOR, hospitalId]
    });
    
    return result.rows.map((row: any) => ({
      ...row,
      availability: row.availability ? JSON.parse(row.availability) : undefined
    }));
  }
}