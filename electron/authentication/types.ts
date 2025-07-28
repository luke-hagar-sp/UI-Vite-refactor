export type TokenSet = {
    accessToken: string;
    accessExpiry: Date;
    refreshToken?: string;
    refreshExpiry?: Date;
}

export interface TokenValidationResult {
    isValid: boolean;
    needsRefresh: boolean;
    tokens?: TokenSet;
}

export interface LambdaUUIDResponse {
    id: string;
    encryptionKey: string;
    authURL: string;
    baseURL: string;
}

export interface TokenResponse {
    baseURL: string;
    id: string;
    tokenInfo: string;
}

export interface RefreshResponse {
    access_token: string;
    refresh_token: string;
}