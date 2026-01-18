export interface Log {
  id: number;
  idUser: number;
  action: string;
  resource: string;
  timestamp: Date;
  details: string | null;
}

export interface LogQueryParams {
  idUser?: number;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}