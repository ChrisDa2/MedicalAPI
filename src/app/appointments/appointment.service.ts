import { AppointmentRepository } from './appointment.repository';
import { 
  Appointment, 
  AppointmentCreateData, 
  AppointmentUpdateData, 
  AppointmentQueryParams,
  AppointmentStatus, 
  AppointmentSettings,
  AppointmentSettingsUpdate
} from './appointment.model';

export class AppointmentService {
  constructor(private appointmentRepository: AppointmentRepository) {}

  async createAppointment(appointmentData: AppointmentCreateData): Promise<number> {
    const settings = await this.getAppointmentSettings();
    
    // Verify that the appointment time is within allowed hours
    const appointmentTime = new Date(appointmentData.date);
    const appointmentHour = appointmentTime.getHours();
    const appointmentMinutes = appointmentTime.getMinutes();
    const appointmentTotalMinutes = appointmentHour * 60 + appointmentMinutes;
    
    const startMinutes = this.timeToMinutes(settings.startTime);
    const endMinutes = this.timeToMinutes(settings.endTime);
    
    if (appointmentTotalMinutes < startMinutes || 
        appointmentTotalMinutes >= endMinutes - settings.duration) {
      throw new Error(`Appointment must be between ${settings.startTime} and ${settings.endTime}`);
    }
    
    // Verify that the appointment time is a multiple of the duration
    if (appointmentTotalMinutes % settings.duration !== 0) {
      throw new Error(`Appointment time must be in ${settings.duration}-minute intervals`);
    }
    
    // Verify doctor availability
    const isAvailable = await this.appointmentRepository.checkDoctorAvailability(
      appointmentData.idDoctor,
      appointmentData.date
    );
    
    if (!isAvailable) {
      throw new Error('Doctor is not available at the selected time');
    }
    
    return this.appointmentRepository.create(appointmentData);
  }

  async getAppointmentById(id: number): Promise<Appointment | null> {
    return this.appointmentRepository.findById(id);
  }

  async getAppointments(query: AppointmentQueryParams = {}): Promise<Appointment[]> {
    return this.appointmentRepository.findAll(query);
  }

  async updateAppointment(id: number, updates: AppointmentUpdateData): Promise<boolean> {
    const appointment = await this.appointmentRepository.findById(id);
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    
    // If updating date, check doctor availability
    if (updates.date && updates.date !== appointment.date) {
      const isAvailable = await this.appointmentRepository.checkDoctorAvailability(
        updates.idDoctor || appointment.idDoctor,
        updates.date
      );
      
      if (!isAvailable) {
        throw new Error('Doctor is not available at the selected time');
      }
    }
    
    return this.appointmentRepository.update(id, updates);
  }

  async cancelAppointment(id: number): Promise<boolean> {
    const appointment = await this.appointmentRepository.findById(id);
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new Error('Appointment is already cancelled');
    }
    
    return this.appointmentRepository.update(id, { 
      status: AppointmentStatus.CANCELLED 
    });
  }

  async rescheduleAppointment(id: number, newDate: Date): Promise<boolean> {
    const appointment = await this.appointmentRepository.findById(id);
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new Error('Cannot reschedule a cancelled appointment');
    }
    
    const settings = await this.getAppointmentSettings();
    
    // Verify that the appointment time is within allowed hours
    const appointmentTime = newDate;
    const appointmentHour = appointmentTime.getHours();
    const appointmentMinutes = appointmentTime.getMinutes();
    const appointmentTotalMinutes = appointmentHour * 60 + appointmentMinutes;
    
    const startMinutes = this.timeToMinutes(settings.startTime);
    const endMinutes = this.timeToMinutes(settings.endTime);
    
    if (appointmentTotalMinutes < startMinutes || 
        appointmentTotalMinutes >= endMinutes - settings.duration) {
      throw new Error(`Appointment must be between ${settings.startTime} and ${settings.endTime}`);
    }
    
    // Verify that the appointment time is a multiple of the duration
    if (appointmentTotalMinutes % settings.duration !== 0) {
      throw new Error(`Appointment time must be in ${settings.duration}-minute intervals`);
    }
    
    // Check doctor availability at new time
    const isAvailable = await this.appointmentRepository.checkDoctorAvailability(
      appointment.idDoctor,
      newDate
    );
    
    if (!isAvailable) {
      throw new Error('Doctor is not available at the selected time');
    }
    
    return this.appointmentRepository.update(id, { 
      date: newDate,
      status: AppointmentStatus.RESCHEDULED 
    });
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const appointment = await this.appointmentRepository.findById(id);
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    
    return this.appointmentRepository.delete(id);
  }

  async getPatientAppointments(idPatient: number): Promise<Appointment[]> {
    return this.appointmentRepository.findAppointmentsByPatient(idPatient);
  }

  async getDoctorAppointments(idDoctor: number): Promise<Appointment[]> {
    return this.appointmentRepository.findAppointmentsByDoctor(idDoctor);
  }

  async completeAppointment(id: number): Promise<boolean> {
    const appointment = await this.appointmentRepository.findById(id);
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    
    return this.appointmentRepository.update(id, { 
      status: AppointmentStatus.COMPLETED 
    });
  }


  //  ==========  APPOINTMENT-SETTINGS ==========

  async getAppointmentSettings(): Promise<AppointmentSettings> {
    return this.appointmentRepository.getAppointmentSettings();
  }

  async updateAppointmentSettings(updates: AppointmentSettingsUpdate): Promise<AppointmentSettings> {
    if (updates.startTime && !this.isValidTimeFormat(updates.startTime)) {
      throw new Error('Invalid startTime format. Use "HH:MM"');
    }
    
    if (updates.endTime && !this.isValidTimeFormat(updates.endTime)) {
      throw new Error('Invalid endTime format. Use "HH:MM"');
    }
    
    if (updates.duration && (updates.duration <= 0 || updates.duration > 480)) {
      throw new Error('Duration must be between 1 and 480 minutes');
    }
    
    if (updates.startTime && updates.endTime) {
      const start = this.timeToMinutes(updates.startTime);
      const end = this.timeToMinutes(updates.endTime);
      
      if (start >= end) {
        throw new Error('startTime must be before endTime');
      }
    }
    
    await this.appointmentRepository.updateAppointmentSettings(updates);
    return this.getAppointmentSettings();
  }

  private isValidTimeFormat(time: string): boolean {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}