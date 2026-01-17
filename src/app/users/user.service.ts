import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from './user.repository';
import { User, Patient, Doctor, UserRole, LoginCredentials, LoginResponse } from './user.model';
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
    
    const doctorToCreate = {
      ...doctorData,
      password: hashedPassword,
      role: UserRole.DOCTOR
    };

    return this.userRepository.createDoctor(doctorToCreate);
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
}