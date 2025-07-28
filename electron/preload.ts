import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { UpdateEnvironmentRequest } from "./authentication/config";
import { sdkPreloader } from './sailpoint-sdk/sdk-preload.ts';

const api = {

  // Original electronAPI
  ...electronAPI,

  // Custom additions to the electronAPI

  // Unified authentication and connection
  unifiedLogin: (environment: string) => ipcRenderer.invoke('unified-login', environment),
  disconnectFromISC: () => ipcRenderer.invoke('disconnect-from-isc'),
  checkAccessTokenStatus: (environment: string) => ipcRenderer.invoke('check-access-token-status', environment),
  checkRefreshTokenStatus: (environment: string) => ipcRenderer.invoke('check-refresh-token-status', environment),
  getCurrentTokenDetails: (environment: string) => ipcRenderer.invoke('get-current-token-details', environment),

  // Token management
  refreshTokens: (environment: string) => ipcRenderer.invoke('refresh-tokens', environment),
  getStoredOAuthTokens: (environment: string) => ipcRenderer.invoke('get-stored-oauth-tokens', environment),
  getStoredPATTokens: (environment: string) => ipcRenderer.invoke('get-stored-pat-tokens', environment),
  validateTokens: (environment: string) => ipcRenderer.invoke('validate-tokens', environment),
  storeClientCredentials: (environment: string, clientId: string, clientSecret: string) => ipcRenderer.invoke('store-client-credentials', environment, clientId, clientSecret),

  // Environment management
  getTenants: () => ipcRenderer.invoke('get-tenants'),
  updateEnvironment: (config: UpdateEnvironmentRequest) => ipcRenderer.invoke('update-environment', config),
  deleteEnvironment: (environment: string) => ipcRenderer.invoke('delete-environment', environment),
  setActiveEnvironment: (environment: string) => ipcRenderer.invoke('set-active-environment', environment),
  getGlobalAuthType: () => ipcRenderer.invoke('get-global-auth-type'),
  setGlobalAuthType: (authType: "oauth" | "pat") => ipcRenderer.invoke('set-global-auth-type', authType),

  // Harbor Pilot
  harborPilotTransformChat: (chat: any) => ipcRenderer.invoke('harbor-pilot-transform-chat', chat),

  // config file management
  readConfig: () => ipcRenderer.invoke('read-config'),
  writeConfig: (config: any) => ipcRenderer.invoke('write-config', config),

  // Logo file management
  writeLogo: (buffer, fileName) => ipcRenderer.invoke('write-logo', buffer, fileName),
  checkLogoExists: (fileName) => ipcRenderer.invoke('check-logo-exists', fileName),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getLogoDataUrl: (fileName) => ipcRenderer.invoke('get-logo-data-url', fileName),

  // Custom SDK functions
  ...sdkPreloader,

}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electronAPI = electronAPI
}
