export interface Log {
  id: number;
  idUser: number | null;
  action: string;
  resource: string;
  timestamp: Date;
  details: string | null;
}

export interface LogQueryParams {
  idUser?: number | null;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateLogDTO {
  idUser?: number | null;
  action: string;
  resource: string;
  details?: string | null;
}