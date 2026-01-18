import { LogRepository } from './log.repository';
import { Log, LogQueryParams } from './log.model';

export class LogService {
  constructor(private logRepository: LogRepository) {}

  async createLog(logData: Omit<Log, 'id' | 'timestamp'>): Promise<number> {
    return this.logRepository.create(logData);
  }

  async getAllLogs(query: LogQueryParams = {}): Promise<Log[]> {
    return this.logRepository.findAll(query);
  }

  async getLogById(id: number): Promise<Log | null> {
    return this.logRepository.findById(id);
  }
}