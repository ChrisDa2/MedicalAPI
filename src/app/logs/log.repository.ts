import { DatabaseService } from '../../database/database.service';
import { Log, LogQueryParams } from './log.model';

export class LogRepository {
  constructor(private db: DatabaseService) {}

  async create(logData: Omit<Log, 'id' | 'timestamp'>): Promise<number> {
    const result = await this.db.execQuery({
      sql: `INSERT INTO logs (idUser, action, resource, details) 
            VALUES (?, ?, ?, ?)`,
      params: [
        logData.idUser,
        logData.action,
        logData.resource,
        logData.details || null
      ]
    });
    
    return (result as any).lastID || 0;
  }

  async findAll(query: LogQueryParams = {}): Promise<Log[]> {
    let sql = `SELECT id, idUser, action, resource, timestamp, details 
               FROM logs WHERE 1=1`;
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (query.idUser) {
      conditions.push('idUser = ?');
      params.push(query.idUser);
    }
    
    if (query.action) {
      conditions.push('action = ?');
      params.push(query.action);
    }
    
    if (query.resource) {
      conditions.push('resource = ?');
      params.push(query.resource);
    }
    
    if (query.startDate) {
      conditions.push('timestamp >= ?');
      params.push(query.startDate);
    }
    
    if (query.endDate) {
      conditions.push('timestamp <= ?');
      params.push(query.endDate);
    }
    
    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }
    
    // Ordenar por fecha más reciente primero
    sql += ' ORDER BY timestamp DESC';
    
    // Paginación
    if (query.page && query.limit) {
      const offset = (query.page - 1) * query.limit;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(query.limit, offset);
    }
    
    const result = await this.db.execQuery({ sql, params });
    
    return result.rows.map(row => this.mapLog(row));
  }

  async findById(id: number): Promise<Log | null> {
    const result = await this.db.execQuery({
      sql: `SELECT id, idUser, action, resource, timestamp, details 
            FROM logs WHERE id = ?`,
      params: [id]
    });
    
    return result.rows[0] ? this.mapLog(result.rows[0]) : null;
  }

  private mapLog(row: any): Log {
    return {
      ...row,
      timestamp: new Date(row.timestamp)
    };
  }
}