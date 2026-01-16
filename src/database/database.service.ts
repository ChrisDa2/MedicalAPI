import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { Service } from 'typedi';
import { config } from '../config/environment';
import path from 'path';
import fs from 'fs';
import { DBQuery } from './models/db-query';
import { DBQueryResult } from './models/db-query-result';

@Service()
export class DatabaseService {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

  public async openDatabase(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
    if (this.db) {
      return this.db;
    }

    const dbPath = path.join(__dirname, `../../data/${config.dbOptions.database}`);
  
    // Make sure file directory exists, if not, create it
    const dirPath = path.dirname(dbPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await this.db.exec(`PRAGMA foreign_keys = ON;`);

    return this.db;
  }

  public async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  public async execQuery(query: DBQuery): Promise<DBQueryResult & { lastID?: number; changes?: number }> {
    const dbClient = await this.openDatabase();
    const { sql, params } = query;

    try {
      // Detect if the query is a SELECT or an INSERT/UPDATE/DELETE
      const sqlUpper = sql.trim().toUpperCase();
      const isSelect = sqlUpper.startsWith('SELECT');

      if (isSelect) {
        // With SELECT, use all() to get rows
        const rows = await dbClient.all(sql, params);
        return {
          rows,
          rowCount: rows.length,
          lastID: undefined,
          changes: 0
        };
      } else {
        // With INSERT/UPDATE/DELETE, use run() to get info about changes
        const result = await dbClient.run(sql, params);
        return {
          rows: [],
          rowCount: result.changes || 0,
          lastID: result.lastID,
          changes: result.changes
        };
      }
    } finally {
      await this.closeDatabase();
    }
  }

  public async initializeDatabase(): Promise<void> {
    await this.openDatabase();

    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        telephone TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('patient', 'doctor', 'admin')),
        dateBirth DATE NOT NULL,
        specialty TEXT,
        idHospital INTEGER,
        availability TEXT
      )
    `);

    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS hospitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        departments TEXT,
        services TEXT,
        location TEXT
      )
    `);

    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATETIME NOT NULL,
        idPatient INTEGER NOT NULL,
        idDoctor INTEGER NOT NULL,
        idSpeciality INTEGER NOT NULL,
        location TEXT NOT NULL,
        status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'cancelled', 'completed', 'rescheduled')),
        FOREIGN KEY(idPatient) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(idDoctor) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS medical_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idAppointment INTEGER NOT NULL,
        date DATETIME NOT NULL,
        idPatient INTEGER NOT NULL,
        idDoctor INTEGER NOT NULL,
        idSpeciality INTEGER NOT NULL,
        description TEXT,
        treatment TEXT,
        testResults TEXT,
        FOREIGN KEY(idAppointment) REFERENCES appointments(id) ON DELETE CASCADE,
        FOREIGN KEY(idPatient) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(idDoctor) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idUser INTEGER NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        FOREIGN KEY(idUser) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Insert default admin user if none exists
    try {
      const result = await this.db!.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"');

      if (result && result.count === 0) {
        const hashedPassword = '$2b$10$KqyT6UoXJYnJ5Q8LmNvQH.svA7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q';
        await this.db!.run(`
          INSERT INTO users (name, email, password, telephone, role, dateBirth) 
          VALUES (?, ?, ?, ?, ?, ?)
        `, ['Admin', 'admin@hospital.com', hashedPassword, '123456789', 'admin', '1990-01-01']);

        console.log('User admin created: admin@hospital.com / Admin123');
      }
    } catch (error) {
      console.warn('Could not create admin user:', error);
    }

    // Insert sample hospitals if none exist
    try {
      const result = await this.db!.get('SELECT COUNT(*) as count FROM hospitals');
      
      if (result && result.count === 0) {
        await this.db!.run(`
          INSERT INTO hospitals (name, departments, services, location) 
          VALUES (?, ?, ?, ?)
        `, [
          'City General Hospital',
          JSON.stringify(['Emergency', 'Cardiology', 'Neurology', 'Pediatrics', 'Surgery']),
          JSON.stringify(['24/7 Emergency', 'ICU', 'Radiology', 'Laboratory']),
          '123 Main Street, City Center'
        ]);
        
        await this.db!.run(`
          INSERT INTO hospitals (name, departments, services, location) 
          VALUES (?, ?, ?, ?)
        `, [
          'University Medical Center',
          JSON.stringify(['Oncology', 'Orthopedics', 'Psychiatry', 'Dermatology']),
          JSON.stringify(['Chemotherapy', 'Physical Therapy', 'MRI', 'Pharmacy']),
          '456 University Avenue'
        ]);
        
        console.log('Sample hospitals created successfully');
      }
    } catch (error) {
      console.warn('Could not create hospitals:', error);
    }

    await this.closeDatabase();
  }
}