export interface Hospital {
  id: number;
  name: string;
  departments: string[];
  services: string[];
  location: string;
}

export interface HospitalQueryParams {
  name?: string;
  department?: string;
  service?: string;
  location?: string;
  page?: number;
  limit?: number;
}