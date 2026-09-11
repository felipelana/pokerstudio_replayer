import { api } from './client';

export interface HealthInfo {
  ok: boolean;
  /** Which deployment answered: development, staging or production. */
  env: string;
  version: string;
  commit: string;
  builtAt: string | null;
  time: string;
}

export interface ClientErrorReport {
  message: string;
  stack?: string;
  /** The page the person was on when it happened. */
  route?: string;
  level?: 'WARN' | 'ERROR';
  context?: Record<string, unknown>;
}

export const systemApi = {
  health: () => api.get<HealthInfo>('/health'),
  reportError: (report: ClientErrorReport) => api.post<void>('/client-errors', report),
};
