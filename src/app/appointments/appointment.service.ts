import { AppointmentRepository } from './appointment.repository';
import { 
  Appointment, 
  AppointmentCreateData, 
  AppointmentUpdateData, 
  AppointmentQueryParams,
  AppointmentStatus 
} from './appointment.model';

export class AppointmentService {
  constructor(private appointmentRepository: AppointmentRepository) {}

  async createAppointment(appointmentData: AppointmentCreateData): Promise<number> {
    // Check if doctor is available at the requested time
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
}