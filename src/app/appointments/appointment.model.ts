export interface Appointment {
  id: number;
  date: Date;
  idPatient: number;
  idDoctor: number;
  idSpeciality: number;
  location: string;
  status: AppointmentStatus;
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  RESCHEDULED = 'rescheduled'
}

export interface AppointmentCreateData {
  date: Date;
  idPatient: number;
  idDoctor: number;
  idSpeciality: number;
  location: string;
}

export interface AppointmentUpdateData {
  date?: Date;
  idPatient?: number;
  idDoctor?: number;
  idSpeciality?: number;
  location?: string;
  status?: AppointmentStatus;
}

export interface AppointmentQueryParams {
  idPatient?: number;
  idDoctor?: number;
  idSpeciality?: number;
  status?: AppointmentStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}