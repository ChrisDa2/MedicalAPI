import { MedicalRecordRepository } from './medical-record.repository';
import { 
  MedicalRecord, 
  MedicalRecordCreateData, 
  MedicalRecordUpdateData,
  MedicalRecordQueryParams 
} from './medical-record.model';

export class MedicalRecordService {
  constructor(private medicalRecordRepository: MedicalRecordRepository) {}

  async createMedicalRecord(medicalRecordData: MedicalRecordCreateData): Promise<number> {
    // Verify if a medical record already exists for the given appointment
    const existingRecord = await this.medicalRecordRepository.findByAppointmentId(
      medicalRecordData.idAppointment
    );
    
    if (existingRecord) {
      throw new Error('Medical record already exists for this appointment');
    }
    
    return this.medicalRecordRepository.create(medicalRecordData);
  }

  async getMedicalRecordById(id: number): Promise<MedicalRecord | null> {
    return this.medicalRecordRepository.findById(id);
  }

  async getMedicalRecords(query: MedicalRecordQueryParams = {}): Promise<MedicalRecord[]> {
    return this.medicalRecordRepository.findAll(query);
  }

  async updateMedicalRecord(id: number, updates: MedicalRecordUpdateData): Promise<boolean> {
    const medicalRecord = await this.medicalRecordRepository.findById(id);
    
    if (!medicalRecord) {
      throw new Error('Medical record not found');
    }
    
    return this.medicalRecordRepository.update(id, updates);
  }

  async deleteMedicalRecord(id: number): Promise<boolean> {
    const medicalRecord = await this.medicalRecordRepository.findById(id);
    
    if (!medicalRecord) {
      throw new Error('Medical record not found');
    }
    
    return this.medicalRecordRepository.delete(id);
  }

  async getPatientMedicalRecords(idPatient: number): Promise<MedicalRecord[]> {
    return this.medicalRecordRepository.findByPatientId(idPatient);
  }

  async getDoctorMedicalRecords(idDoctor: number): Promise<MedicalRecord[]> {
    return this.medicalRecordRepository.findByDoctorId(idDoctor);
  }

  async getMedicalRecordByAppointment(idAppointment: number): Promise<MedicalRecord | null> {
    return this.medicalRecordRepository.findByAppointmentId(idAppointment);
  }

  async searchMedicalRecordsByPatientName(patientName: string): Promise<MedicalRecord[]> {
    return this.medicalRecordRepository.searchByPatientName(patientName);
  }

  async updateTestResults(id: number, testResults: string[]): Promise<boolean> {
    const medicalRecord = await this.medicalRecordRepository.findById(id);
    
    if (!medicalRecord) {
      throw new Error('Medical record not found');
    }
    
    return this.medicalRecordRepository.update(id, { testResults });
  }

  async updateTreatment(id: number, treatment: string): Promise<boolean> {
    const medicalRecord = await this.medicalRecordRepository.findById(id);
    
    if (!medicalRecord) {
      throw new Error('Medical record not found');
    }
    
    return this.medicalRecordRepository.update(id, { treatment });
  }
}