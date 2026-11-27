import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from './user.repository';
import { User, Patient, Doctor, UserRole, LoginCredentials, LoginResponse, DoctorSearchFilters } from './user.model';
import { Container } from 'typedi';
import { DatabaseService } from '../../database/database.service';
import { AppointmentRepository } from '../appointments/appointment.repository';
import { AppointmentService } from '../appointments/appointment.service';
import { config } from '../../config/environment';

export class UserService {

  constructor(private userRepository: UserRepository) {}

  async registerPatient(patientData: Omit<Patient, 'id' | 'role'>): Promise<number> {
    const existingUser = await this.userRepository.findByEmail(patientData.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(patientData.password, 10);
    
    const patientToCreate = {
      ...patientData,
      password: hashedPassword,
      role: UserRole.PATIENT
    };

    return this.userRepository.createPatient(patientToCreate);
  }

  async registerDoctor(doctorData: Omit<Doctor, 'id' | 'role'>): Promise<number> {
    const existingUser = await this.userRepository.findByEmail(doctorData.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(doctorData.password, 10);
    
    // Validate availability against appointment-settings
    if (doctorData.availability) {
      await this.validateDoctorAvailability(doctorData.availability);
    }
    
    const doctorToCreate = {
      ...doctorData,
      password: hashedPassword,
      role: UserRole.DOCTOR
    };

    return this.userRepository.createDoctor(doctorToCreate);
  }

  // Validate Availability Functions
  private async validateDoctorAvailability(availability: any[]): Promise<void> {
      if (!availability || !Array.isArray(availability)) {
        throw new Error('Availability must be an array');
      }
      
      // Get appointment-settings
      const dbService = Container.get(DatabaseService);
      const appointmentRepository = new AppointmentRepository(dbService);
      const appointmentService = new AppointmentService(appointmentRepository);
      const settings = await appointmentService.getAppointmentSettings();
      
      const startMinutes = this.timeToMinutes(settings.startTime);
      const endMinutes = this.timeToMinutes(settings.endTime);
      
      for (const slot of availability) {
        if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
          throw new Error('dayOfWeek must be between 0 and 6');
        }
        
        if (!this.isValidTimeFormat(slot.startTime) || !this.isValidTimeFormat(slot.endTime)) {
          throw new Error('Time must be in format "HH:MM"');
        }
        
        const slotStart = this.timeToMinutes(slot.startTime);
        const slotEnd = this.timeToMinutes(slot.endTime);
        
        // Validate against appointment-settings
        if (slotStart < startMinutes) {
          throw new Error(`Start time (${slot.startTime}) is before system opening time (${settings.startTime})`);
        }
        
        if (slotEnd > endMinutes) {
          throw new Error(`End time (${slot.endTime}) is after system closing time (${settings.endTime})`);
        }
        
        if (slotStart >= slotEnd) {
          throw new Error(`Start time (${slot.startTime}) must be before end time (${slot.endTime})`);
        }
      }
    }

  private isValidTimeFormat(time: string): boolean {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new Error('User not found');
    }

    const validPassword = await bcrypt.compare(credentials.password, user.password);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      config.user_sessions.secret,
      { expiresIn: `${config.user_sessions.expiration_days}d` }
    );

    const { password, ...userWithoutPassword } = user;

    return { token, user: userWithoutPassword };
  }

  async updateProfile(id: number, updates: Partial<Omit<User, 'id' | 'role'>>): Promise<boolean> {
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    return this.userRepository.update(id, updates);
  }

  async getAllUsers(role?: UserRole): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.findAll(role);
    return users.map(({ password, ...user }) => user);
  }

  async getUserById(id: number): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findById(id);
    if (!user) return null;
    
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getDoctorsBySpecialty(specialty: string): Promise<Omit<Doctor, 'password'>[]> {
    const doctors = await this.userRepository.findDoctorsBySpecialty(specialty);
    return doctors.map(({ password, ...doctor }) => doctor);
  }

  async getDoctorsByHospital(hospitalId: number): Promise<Omit<Doctor, 'password'>[]> {
    const doctors = await this.userRepository.findDoctorsByHospital(hospitalId);
    return doctors.map(({ password, ...doctor }) => doctor);
  }

  async getDoctors(): Promise<Omit<Doctor, 'password'>[]> {
    const users = await this.userRepository.findAll(UserRole.DOCTOR);
    const doctors = users.filter(user => user.role === UserRole.DOCTOR) as Doctor[];
    return doctors.map(({ password, ...doctor }) => doctor);
  }

  async searchDoctors(filters: DoctorSearchFilters = {}): Promise<Omit<Doctor, 'password'>[]> {
    try {
      const allDoctors = await this.getDoctors();
      
      let filteredDoctors = allDoctors;
      
      if (filters.name && filters.name.trim()) {
        const searchName = filters.name.toLowerCase().trim();
        filteredDoctors = filteredDoctors.filter(doctor =>
          doctor.name.toLowerCase().includes(searchName)
        );
      }
      
      if (filters.specialty && filters.specialty.trim()) {
        const searchSpecialty = filters.specialty.trim();
        filteredDoctors = filteredDoctors.filter(doctor =>
          doctor.specialty === searchSpecialty
        );
      }
      
      if (filters.idHospital) {
        filteredDoctors = filteredDoctors.filter(doctor =>
          doctor.idHospital === filters.idHospital
        );
      }
      
      if (filters.availability) {
        const { dayOfWeek, startTime, endTime } = filters.availability;
        
        filteredDoctors = filteredDoctors.filter(doctor => {
          if (!doctor.availability || doctor.availability.length === 0) {
            return false;
          }
          
          return doctor.availability.some(slot => {
            if (dayOfWeek !== undefined && slot.dayOfWeek !== dayOfWeek) {
              return false;
            }
            
            if (startTime && slot.startTime < startTime) {
              return false;
            }
            
            if (endTime && slot.endTime > endTime) {
              return false;
            }
            
            return true;
          });
        });
      }
      
      return filteredDoctors;
      
    } catch (error) {
      console.error('Error in searchDoctors service:', error);
      throw new Error('Could not search doctors');
    }
  }

  async updateDoctorAvailability(id: number, availability: any[]): Promise<boolean> {
    const doctor = await this.userRepository.findById(id);
    
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      throw new Error('Doctor not found');
    }
    
    await this.validateDoctorAvailability(availability);
    
    return this.userRepository.update(id, { availability });
  }
}