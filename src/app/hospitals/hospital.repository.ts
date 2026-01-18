import { DatabaseService } from '../../database/database.service';
import { Hospital, HospitalQueryParams } from './hospital.model';

export class HospitalRepository {
  constructor(private db: DatabaseService) {}

  async findAll(query: HospitalQueryParams = {}): Promise<Hospital[]> {
    let sql = `SELECT id, name, departments, services, location FROM hospitals WHERE 1=1`;
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (query.name) {
      conditions.push('name LIKE ?');
      params.push(`%${query.name}%`);
    }
    
    if (query.location) {
      conditions.push('location LIKE ?');
      params.push(`%${query.location}%`);
    }
    
    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY name';
    
    // Pagination
    if (query.page && query.limit) {
      const offset = (query.page - 1) * query.limit;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(query.limit, offset);
    }
    
    const result = await this.db.execQuery({ sql, params });
    
    return result.rows.map(row => this.mapHospital(row));
  }

  async findById(id: number): Promise<Hospital | null> {
    const result = await this.db.execQuery({
      sql: `SELECT id, name, departments, services, location FROM hospitals WHERE id = ?`,
      params: [id]
    });
    
    return result.rows[0] ? this.mapHospital(result.rows[0]) : null;
  }

  async filterByDepartment(department: string): Promise<Hospital[]> {
    const result = await this.db.execQuery({
      sql: `SELECT id, name, departments, services, location FROM hospitals`,
      params: []
    });
    
    const allHospitals = result.rows.map(row => this.mapHospital(row));
    
    return allHospitals.filter(hospital => 
      hospital.departments.some(dept => 
        dept.toLowerCase().includes(department.toLowerCase())
      )
    );
  }

  async filterByService(service: string): Promise<Hospital[]> {
    const result = await this.db.execQuery({
      sql: `SELECT id, name, departments, services, location FROM hospitals`,
      params: []
    });
    
    const allHospitals = result.rows.map(row => this.mapHospital(row));
    
    return allHospitals.filter(hospital => 
      hospital.services.some(serv => 
        serv.toLowerCase().includes(service.toLowerCase())
      )
    );
  }

  async searchByName(name: string): Promise<Hospital[]> {
    const result = await this.db.execQuery({
      sql: `SELECT id, name, departments, services, location FROM hospitals WHERE name LIKE ? ORDER BY name`,
      params: [`%${name}%`]
    });
    
    return result.rows.map(row => this.mapHospital(row));
  }

  private mapHospital(row: any): Hospital {
    return {
      ...row,
      departments: row.departments ? JSON.parse(row.departments) : [],
      services: row.services ? JSON.parse(row.services) : []
    };
  }
}