import { HospitalRepository } from './hospital.repository';
import { Hospital, HospitalQueryParams } from './hospital.model';

export class HospitalService {
  constructor(private hospitalRepository: HospitalRepository) {}

  async getAllHospitals(query: HospitalQueryParams = {}): Promise<Hospital[]> {
    let hospitals = await this.hospitalRepository.findAll(query);
    
    if (query.department) {
      hospitals = hospitals.filter(hospital => 
        hospital.departments.some(dept => 
          dept.toLowerCase().includes(query.department!.toLowerCase())
        )
      );
    }
    
    if (query.service) {
      hospitals = hospitals.filter(hospital => 
        hospital.services.some(serv => 
          serv.toLowerCase().includes(query.service!.toLowerCase())
        )
      );
    }
    
    return hospitals;
  }

  async getHospitalById(id: number): Promise<Hospital | null> {
    return this.hospitalRepository.findById(id);
  }

  async searchHospitals(name: string): Promise<Hospital[]> {
    return this.hospitalRepository.searchByName(name);
  }

  async getHospitalsByDepartment(department: string): Promise<Hospital[]> {
    return this.hospitalRepository.filterByDepartment(department);
  }

  async getHospitalsByService(service: string): Promise<Hospital[]> {
    return this.hospitalRepository.filterByService(service);
  }
}