export enum UserRole {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  ADMIN = 'admin'
}

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  telephone: string;
  role: UserRole;
}

export interface DoctorSearchFilters {
  name?: string;
  specialty?: string;
  idHospital?: number;
  availability?: {
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
  };
}

export interface Patient extends User {
  dateBirth: Date;
}

export interface Doctor extends User {
  dateBirth: Date;
  specialty: string;
  idHospital: number;
  availability?: DoctorAvailability[];
}

export interface Admin extends User {
  // No additional fields for Admin at the moment
}

export interface DoctorAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface DoctorUpdateData {
  name?: string;
  email?: string;
  password?: string;
  telephone?: string;
  dateBirth?: Date;
  specialty?: string;
  idHospital?: number;
  availability?: DoctorAvailability[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'password'>;
}