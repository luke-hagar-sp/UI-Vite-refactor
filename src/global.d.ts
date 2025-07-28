export type AuthMethods = "oauth" | "pat";

export type UpdateEnvironmentRequest = {
  environmentName: string;
  tenantUrl: string;
  baseUrl: string;
  authType: AuthMethods;
  clientId?: string;
  clientSecret?: string;
}

export type Tenant = {
  active: boolean;
  name: string;
  apiUrl: string;
  tenantUrl: string;
  clientId?: string;
  clientSecret?: string;
  authType: AuthMethods;
  tenantName: string;
}

export type TokenSet = {
  accessToken: string;
  accessExpiry: Date;
  refreshToken: string;
  refreshExpiry: Date;
}

export type AccessTokenStatus = {
  authType: AuthMethods;
  accessTokenIsValid: boolean;
  expiry?: Date;
  needsRefresh: boolean;
}

export type RefreshTokenStatus = {
  authType: "oauth";
  refreshTokenIsValid: boolean;
  expiry?: Date;
  needsRefresh: boolean;
}

export type AuthPayload = {
  tenant_id: string;
  pod: string;
  org: string;
  identity_id: string;
  user_name: string;
  strong_auth: boolean;
  authorities: string[];
  client_id: string;
  strong_auth_supported: boolean;
  scope: string[];
  exp: number;
  jti: string;
};

export type TokenDetails = {
  expiry: Date;
} & AuthPayload;

declare global {
  interface Window {
    electronAPI: {
      // Unified authentication and connection
      unifiedLogin: (environment: string) => Promise<{ success: boolean, error?: string }>;
      disconnectFromISC: () => Promise<void>;
      checkAccessTokenStatus: (environment: string) => Promise<AccessTokenStatus>;
      checkRefreshTokenStatus: (environment: string) => Promise<RefreshTokenStatus>;
      getCurrentTokenDetails: (environment: string) => Promise<{ tokenDetails: TokenDetails | undefined, error?: string }>;

      // Token management
      refreshTokens: (environment: string) => Promise<{ success: boolean, error?: string }>;
      getStoredOAuthTokens: (environment: string) => Promise<TokenSet | undefined>;
      getStoredPATTokens: (environment: string) => Promise<{ accessToken: string, accessExpiry: Date, clientId: string, clientSecret: string } | undefined>;
      validateTokens: (environment: string) => Promise<{ isValid: boolean, needsRefresh: boolean, tokenDetails: TokenDetails | undefined, error?: string }>;
      storeClientCredentials: (environment: string, clientId: string, clientSecret: string) => Promise<void>;

      // Environment management
      getTenants: () => Promise<Tenant[]>;
      updateEnvironment: (config: UpdateEnvironmentRequest) => Promise<{ success: boolean, error?: string }>;
      deleteEnvironment: (environment: string) => Promise<{ success: boolean, error?: string }>;
      setActiveEnvironment: (environment: string) => Promise<{ success: boolean, error?: string }>;
      getGlobalAuthType: () => Promise<AuthMethods>;
      setGlobalAuthType: (authType: AuthMethods) => Promise<void>;

      // Harbor Pilot
      harborPilotTransformChat: (chat: any) => Promise<any>;

      // Config file management
      readConfig: () => Promise<any>;
      writeConfig: (config: any) => Promise<any>;

      // Logo file management
      writeLogo: (buffer: any, fileName: any) => Promise<any>;
      checkLogoExists: (fileName: any) => Promise<any>;
      getUserDataPath: () => Promise<any>;
      getLogoDataUrl: (fileName: any) => Promise<any>;
    };
  }
}
