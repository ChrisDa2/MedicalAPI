export interface MedicalRecord {
  id: number;
  idAppointment: number;
  date: Date;
  idPatient: number;
  idDoctor: number;
  idSpeciality: number;
  description: string;
  treatment: string;
  testResults: string[]; // Path to store multiple test results as an array of strings
}

export interface MedicalRecordCreateData {
  idAppointment: number;
  idDoctor: number;
  idPatient: number;
  idSpeciality: number;
  description: string;
  treatment: string;
  testResults?: string[];
}

export interface MedicalRecordUpdateData {
  description?: string;
  treatment?: string;
  testResults?: string[];
}

export interface MedicalRecordQueryParams {
  idPatient?: number;
  idDoctor?: number;
  idSpeciality?: number;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}