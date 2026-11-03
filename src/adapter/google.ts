/**
 * Production Backend: delegates to the Apps Script sandbox's
 * google.script.run (ADR-0002). Every server call keeps its exact legacy
 * signature — the Sesi token is the explicit first argument, as Code.js expects.
 */

/**
 * The chainable google.script.run builder the sandbox exposes. Called as:
 * .withSuccessHandler(s).withFailureHandler(f).<serverFn>(...args)
 */
export type GoogleScriptRunner = {
  withSuccessHandler(success: (value: unknown) => void): {
    withFailureHandler(failure: (error: unknown) => void): Record<string, (...args: unknown[]) => void>;
  };
};

export function createGoogleBackend(runnerFactory: () => GoogleScriptRunner) {
  function callServer(fnName: string, ...args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const instance = runnerFactory();
      const invocation = instance
        .withSuccessHandler(resolve)
        .withFailureHandler(reject) as Record<string, (...args: unknown[]) => void>;
      const serverFn = invocation[fnName];
      if (!serverFn) {
        reject(new Error(`Fungsi server tidak dikenal: ${fnName}`));
        return;
      }
      serverFn(...args);
    });
  }

  return {
    loginUser: (nrp: string, password: string) => callServer("loginUser", nrp, password),
    registerUser: (data: unknown) => callServer("registerUser", data),
    updateMyProfile: (token: string, profile: unknown) => callServer("updateMyProfile", token, profile),
    changeMyPassword: (token: string, newPassword: string) => callServer("changeMyPassword", token, newPassword),
    logoutSession: (token: string) => callServer("logoutSession", token),
    getMasterBidang: () => callServer("getMasterBidang"),
    getMasterUnit: () => callServer("getMasterUnit"),
    createMasterBidang: (token: string, name: string) => callServer("createMasterBidang", token, name),
    renameMasterBidang: (token: string, id: number, name: string) =>
      callServer("renameMasterBidang", token, id, name),
    deleteMasterBidang: (token: string, id: number) => callServer("deleteMasterBidang", token, id),
    createMasterUnit: (token: string, name: string, bidangId: number) =>
      callServer("createMasterUnit", token, name, bidangId),
    renameMasterUnit: (token: string, id: number, name: string) =>
      callServer("renameMasterUnit", token, id, name),
    reparentMasterUnit: (token: string, id: number, bidangId: number) =>
      callServer("reparentMasterUnit", token, id, bidangId),
    deleteMasterUnit: (token: string, id: number) => callServer("deleteMasterUnit", token, id),
    getAllData: (token: string) => callServer("getAllData", token),
    saveDataWithFiles: (token: string, data: unknown) => callServer("saveDataWithFiles", token, data),
    updateDataWithFiles: (token: string, data: unknown, rowIndex: unknown) =>
      callServer("updateDataWithFiles", token, data, rowIndex),
    markDocumentRead: (token: string, docRowIndex: unknown, judulDokumen: string) =>
      callServer("markDocumentRead", token, docRowIndex, judulDokumen),
    getMyReadDocs: (token: string) => callServer("getMyReadDocs", token),
    getSosialisasiSummary: (token: string) => callServer("getSosialisasiSummary", token),
    getSosialisasiDetail: (token: string, docRowIndex: unknown) =>
      callServer("getSosialisasiDetail", token, docRowIndex),
    generateSosialisasiPdf: (token: string, docRowIndex: unknown) =>
      callServer("generateSosialisasiPdf", token, docRowIndex),
    getUserStats: (token: string) => callServer("getUserStats", token),
    getPendingUsers: (token: string) => callServer("getPendingUsers", token),
    setUserStatus: (token: string, rowIndex: unknown, newStatus: string, approvedUnitId?: number) =>
      callServer("setUserStatus", token, rowIndex, newStatus, approvedUnitId),
    updateUserUnit: (token: string, nrp: string, unitId: number) =>
      callServer("updateUserUnit", token, nrp, unitId),
    getAllUsers: (token: string) => callServer("getAllUsers", token),
    resetUserPassword: (token: string, rowIndex: unknown, newPassword: string) =>
      callServer("resetUserPassword", token, rowIndex, newPassword),
  } as unknown as Record<string, (...args: unknown[]) => unknown>;
}
