import type {
  ApiResult, Doc, PendingUser, SaveDocPayload, SosDetail,
  SosSummary, UserRow, UserStats, Session,
} from './types';
import { toDoc } from './utils';

declare global {
  interface Window {
    google?: { script: { run: any } };
  }
}

function call<T>(name: string, ...args: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = window.google?.script?.run;
    if (!run) {
      reject(new Error('Aplikasi hanya bisa berjalan di Google Apps Script.'));
      return;
    }
    run
      .withSuccessHandler(resolve)
      .withFailureHandler((e: { message?: string } | string) =>
        reject(new Error('Koneksi error: ' + (typeof e === 'string' ? e : e?.message ?? e))))
      [name](...args);
  });
}

export const api = {
  login: (nrp: string, password: string) =>
    call<ApiResult<Session> & { token: string; user: Session }>('loginUser', nrp, password),
  register: (data: Record<string, string>) => call<ApiResult>('registerUser', data),
  logout: (token: string) => call<ApiResult>('logoutSession', token),
  getMasterBidang: () => call<ApiResult<string[]>>('getMasterBidang'),

  getAllDocs: async (token: string): Promise<Doc[]> => {
    const d = await call<unknown>('getAllData', token);
    const rows: unknown[][] = typeof d === 'string' ? JSON.parse(d) : ((d as unknown[][]) ?? []);
    return rows.map(toDoc);
  },
  saveDoc: (token: string, data: SaveDocPayload) => call<ApiResult>('saveDataWithFiles', token, data),
  updateDoc: (token: string, data: SaveDocPayload, rowIndex: number) =>
    call<ApiResult>('updateDataWithFiles', token, data, rowIndex),

  getMyReadDocs: (token: string) => call<ApiResult<number[]>>('getMyReadDocs', token),
  markRead: (token: string, rowIndex: number, judul: string) =>
    call<ApiResult>('markDocumentRead', token, rowIndex, judul),
  getUserStats: (token: string) => call<ApiResult & UserStats>('getUserStats', token),

  getSosSummary: (token: string) => call<ApiResult & SosSummary>('getSosialisasiSummary', token),
  getSosDetail: (token: string, rowIndex: number) =>
    call<ApiResult<SosDetail>>('getSosialisasiDetail', token, rowIndex),
  genPdf: (token: string, rowIndex: number) =>
    call<ApiResult & { base64: string; filename: string }>('generateSosialisasiPdf', token, rowIndex),

  getPending: (token: string) => call<ApiResult<PendingUser[]>>('getPendingUsers', token),
  getAllUsers: (token: string) => call<ApiResult<UserRow[]>>('getAllUsers', token),
  setUserStatus: (token: string, rowIndex: number, status: string) =>
    call<ApiResult>('setUserStatus', token, rowIndex, status),
  resetPassword: (token: string, rowIndex: number, password: string) =>
    call<ApiResult>('resetUserPassword', token, rowIndex, password),
};