import {
  Configuration,
  TenantV2024Api,
  ConfigurationParameters,
} from 'sailpoint-api-client';
import { Buffer } from 'buffer';
import { getConfig, setConfig } from './config';
import { getStoredOAuthTokens, OAuthLogin, refreshOAuthToken, validateOAuthTokens } from './oauth';
import { getStoredPATTokens, refreshPATToken, validatePATToken } from './pat';
import { TokenSet } from './types';

export function formatErrorAsString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const errorObj = error as { message: unknown };
    return typeof errorObj.message === 'string' ? errorObj.message : 'Unknown error';
  }
  return 'Unknown error';
}

export let apiConfig: Configuration;

export const disconnectFromISC = () => {
  try {
    // Simply clear the API configuration
    apiConfig = undefined as unknown as Configuration;

    console.log('Successfully disconnected from ISC');
  } catch (error) {
    console.error('Error during disconnect:', error);
    // Ensure apiConfig is cleared even if there's an error
    apiConfig = undefined as unknown as Configuration;
  }
};

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

export function parseJwt(token: string): AuthPayload {

  // Split the JWT token into its three parts
  const parts = token.split('.');

  // Take the first part
  const base64Url = parts[1];

  // Convert it from base64url to base64
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

  // Decode the base64 string
  const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(c => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  // Return the parsed JSON payload
  return JSON.parse(jsonPayload) as AuthPayload;
}

/**
 * Unified login function that handles both flows
 * @param request - The login request
 * @returns Promise resolving to the login result
 */
export const unifiedLogin = async (environment: string): Promise<{ success: boolean, error?: string }> => {

  const authType = getGlobalAuthType();
  console.log(`Starting ${authType} login for environment: ${environment}`);

  try {
    // First, ensure the environment exists in config
    const config = getConfig();
    if (!config.environments[environment]) {
      return {
        success: false,
        error: `Environment '${environment}' not found in configuration`
      };
    }

    const { tenanturl, baseurl } = config.environments[environment];

    // Check for existing tokens and attempt refresh if needed
    const tokenStatus = validateTokens(environment);

    if (!tokenStatus) {
      return {
        success: false,
        error: `No tokens found for environment: ${environment}`
      };
    }

    if (tokenStatus.authType === authType) {
      if (tokenStatus.isValid) {
        console.log(`Using existing valid ${tokenStatus.authType} tokens for environment: ${environment}`);

        // Test the connection with existing tokens
        let storedTokens;

        switch (tokenStatus.authType) {
          case 'oauth': {
            storedTokens = getStoredOAuthTokens(environment);
            break;
          }

          case 'pat': {
            storedTokens = getStoredPATTokens(environment);
            break;
          }

          default:
            return {
              success: false,
              error: `Unsupported auth type: ${tokenStatus.authType as string}`
            };
        }

        if (!storedTokens) {
          return {
            success: false,
            error: `No tokens found for environment: ${environment}`
          };
        }

        let connectionResult;

        switch (tokenStatus.authType) {
          case 'oauth': {
            connectionResult = await connectToISCWithToken(
              baseurl,
              storedTokens.accessToken,
            );
            break;
          }
          case 'pat': {
            connectionResult = await connectToISCWithPAT(
              baseurl,
              storedTokens.clientId,
              storedTokens.clientSecret,
            );
            break;
          }
        }

        if (connectionResult && connectionResult.connected) {
          return {
            success: true,
          };
        } else {
          return {
            success: false,
            error: `Failed to connect to ISC with environment: ${environment} and auth type: ${tokenStatus.authType}`
          };
        }

      } else if (tokenStatus.needsRefresh) {
        // Attempt to refresh tokens using cached refresh token
        console.log(`Attempting to refresh expired tokens for environment: ${environment}`);
        try {
          const refreshResult = await refreshTokens(environment);

          if (!refreshResult.success) {
            return {
              success: false,
              error: formatErrorAsString(refreshResult.error)
            };
          }

          let connectionResult;
          switch (tokenStatus.authType) {
            case 'oauth': {
              const oauthTokens = getStoredOAuthTokens(environment);
              if (!oauthTokens || !oauthTokens.accessToken) {
                return {
                  success: false,
                  error: 'No OAuth tokens found for environment: ' + environment
                };
              }
              connectionResult = await connectToISCWithToken(baseurl, oauthTokens.accessToken);
              break;
            }
            case 'pat': {
              const patTokens = getStoredPATTokens(environment);
              if (!patTokens || !patTokens.clientId || !patTokens.clientSecret) {
                return {
                  success: false,
                  error: 'No PAT tokens found for environment: ' + environment
                };
              }
              connectionResult = await connectToISCWithPAT(baseurl, patTokens.clientId, patTokens.clientSecret);
              break;
            }
          }

          if (connectionResult && connectionResult.connected) {
            console.log('Successfully refreshed tokens and connected');
            return {
              success: true,
            };
          } else {
            return {
              success: false,
              error: 'Failed to connect to ISC with environment: ' + environment + ' and auth type: ' + tokenStatus.authType
            };
          }
        } catch (refreshError) {
          console.log('Token refresh failed, will start new authentication flow:', refreshError);
        }
      }
    } else if (tokenStatus.isValid && tokenStatus.authType !== authType) {
      console.log(`Found valid ${tokenStatus.authType} tokens but user requested ${authType} authentication. Proceeding with new ${authType} authentication.`);
    }

    // Update global auth type to match the requested flow
    config.authtype = authType;
    config.activeenvironment = environment;

    // Save the updated config
    setConfig(config);

    if (authType === 'oauth') {
      // OAuth flow
      if (!tenanturl) {
        return {
          success: false,
          error: 'Tenant is required for OAuth login'
        };
      }

      try {
        // Perform OAuth login
        const loginResult = await OAuthLogin({
          tenant: tenanturl,
          baseAPIUrl: baseurl,
          environment: environment
        });

        if (!loginResult.success) {

          return {
            success: false,
            error: formatErrorAsString(loginResult.error)
          };
        }

        const oauthTokens = getStoredOAuthTokens(environment);
        if (!oauthTokens) {
          return {
            success: false,
            error: 'No OAuth tokens found for environment: ' + environment
          };
        }

        // Test the connection with the new tokens
        const connectionResult = await connectToISCWithToken(
          baseurl,
          oauthTokens.accessToken,
        );

        return {
          success: connectionResult.connected,
          error: formatErrorAsString(connectionResult.error)
        };
      } catch (oauthError) {
        console.error('OAuth login failed:', oauthError);
        return {
          success: false,
          error: oauthError instanceof Error ? oauthError.message : 'OAuth login failed'
        };
      }
    } else {
      // PAT flow
      const patTokens = getStoredPATTokens(environment);
      if (!patTokens) {
        return {
          success: false,
          error: 'Client ID and Client Secret are required for PAT login'
        };
      }

      try {
        const connectionResult = await connectToISCWithPAT(
          baseurl,
          patTokens.clientId,
          patTokens.clientSecret,
        );

        return {
          success: connectionResult.connected,
          error: formatErrorAsString(connectionResult.error)
        };
      } catch (patError) {
        console.error('PAT login failed:', patError);
        return {
          success: false,
          error: patError instanceof Error ? patError.message : 'PAT login failed'
        };
      }
    }
  } catch (error) {
    console.error('Unified login error:', error);
    return {
      success: false,
      error: formatErrorAsString(error)
    };
  }
};

/**
 * Unified token refresh function that handles both OAuth and PAT tokens
 * @param environment - The environment name to refresh tokens for
 * @returns Promise resolving to the new token set
 */
export const refreshTokens = async (environment: string): Promise<{ success: boolean, error?: string }> => {
  try {
    const authType = getGlobalAuthType();
    switch (authType) {
      case 'oauth': {
        const storedTokens = getStoredOAuthTokens(environment);
        if (!storedTokens || !storedTokens.refreshToken) {
          return { success: false, error: 'No refresh token available for OAuth refresh' };
        }

        if (checkTokenExpired(storedTokens.refreshToken)) {
          return { success: false, error: 'Refresh token has expired' };
        }

        await refreshOAuthToken(environment);
        return { success: true, error: undefined };
      }

      case 'pat': {
        await refreshPATToken(environment);
        return { success: true, error: undefined };
      }

      default:
        return { success: false, error: `Unsupported auth type: ${authType as string}` };
    }
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    return { success: false, error: 'Error refreshing tokens: ' + error };
  }
};

export const connectToISCWithPAT = async (
  apiUrl: string,
  clientId: string,
  clientSecret: string,
) => {
  console.log('Connecting to ISC with PAT:');
  let config: ConfigurationParameters = {
    clientId: clientId,
    clientSecret: clientSecret,
    tokenUrl: apiUrl + `/oauth/token`,
    baseurl: apiUrl,
  };
  try {
    apiConfig = new Configuration(config);
    apiConfig.experimental = true;
    let tenantApi = new TenantV2024Api(apiConfig);
    let response = await tenantApi.getTenant();
    if (response.status !== 200) {
      return { connected: false, error: 'Failed to connect to ISC with PAT' };
    }
    return { connected: true, error: undefined };
  } catch (error) {
    console.error('Error connecting to ISC:', error);
    return { connected: false, error: formatErrorAsString(error) };
  }
};

export const connectToISCWithToken = async (
  apiUrl: string,
  accessToken: string,
) => {
  console.log('Connecting to ISC with token:');
  let config: ConfigurationParameters = {
    accessToken: accessToken,
    baseurl: apiUrl,
  };
  try {
    apiConfig = new Configuration(config);
    apiConfig.experimental = true;
    let tenantApi = new TenantV2024Api(apiConfig);
    let response = await tenantApi.getTenant();
    if (response.status !== 200) {
      return { connected: false, error: 'Failed to connect to ISC with token' };
    }
    return { connected: true, error: undefined };
  } catch (error) {
    console.error('Error connecting to ISC:', error);
    return { connected: false, error: formatErrorAsString(error) };
  }
};

export const getGlobalAuthType = (): "oauth" | "pat" => {
  try {
    const config = getConfig();

    // OAuth is the default as it requires the least variables to work
    return (config.authtype) || 'oauth';
  } catch (error) {
    console.error('Error getting global auth type:', error);
    return 'oauth'; // Default to OAuth if error
  }
};

export const setGlobalAuthType = (authType: "oauth" | "pat") => {
  try {
    const config = getConfig();

    // Update the global auth type
    config.authtype = authType;

    // Write updated config file
    setConfig(config);

    return { success: true };
  } catch (error) {
    console.error('Error setting global auth type:', error);
    return {
      success: false,
      error: formatErrorAsString(error)
    };
  }
};

export type AccessTokenStatus = {
  authType: string;
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

export type TokenDetails = {
  expiry: Date;
} & AuthPayload;

export function getTokenDetails(token: string): TokenDetails {
  const parsedToken = parseJwt(token);

  const expiry = new Date(parsedToken.exp * 1000);

  return {
    expiry,
    ...parsedToken
  }
}

export function getCurrentTokenDetails(environment: string): { tokenDetails: TokenDetails | undefined, error?: string } {
  try {
    switch (getGlobalAuthType()) {
      case 'oauth': {
        const oauthTokens = getStoredOAuthTokens(environment);
        if (!oauthTokens) {
          return {
            tokenDetails: undefined,
            error: 'No OAuth tokens found for environment: ' + environment
          };
        }
        return {
          tokenDetails: getTokenDetails(oauthTokens.accessToken),
          error: undefined
        };
      }
      case 'pat': {
        const patTokens = getStoredPATTokens(environment);
        if (!patTokens) {
          return {
            tokenDetails: undefined,
            error: 'No PAT tokens found for environment: ' + environment
          };
        }
        return {
          tokenDetails: getTokenDetails(patTokens.accessToken),
          error: undefined
        };
      }

      default:
        return {
          tokenDetails: undefined,
          error: 'Unsupported auth type: ' + (getGlobalAuthType() as string)
        };
    }
  } catch (error) {
    console.error('Error getting current token details:', error);
    return {
      tokenDetails: undefined,
      error: formatErrorAsString(error)
    };
  }
}

/**
 * Checks the access token status for a given environment.
 * 
 * If all token expiry times are valid, tests the access token against the API
 * @param environment - The environment name to check access token status for
 * @returns Access token status information
 */
export async function checkAccessTokenStatus(environment: string): Promise<AccessTokenStatus> {
  try {
    const authType = getGlobalAuthType();

    let storedTokens: TokenSet | undefined;

    switch (authType) {
      case 'oauth': {
        storedTokens = getStoredOAuthTokens(environment);
        break;
      }
      case 'pat': {
        storedTokens = getStoredPATTokens(environment);
        break;
      }
      default:
        return {
          accessTokenIsValid: false,
          authType,
          needsRefresh: false
        };
    }

    if (!storedTokens) {
      return {
        accessTokenIsValid: false,
        authType,
        needsRefresh: false
      };
    }

    const parsedToken = parseJwt(storedTokens.accessToken);
    const expiry = new Date(parsedToken.exp * 1000);
    const now = new Date();

    if (expiry < now) {
      return {
        accessTokenIsValid: false,
        authType,
        needsRefresh: true,
        expiry
      };
    }

    const tokenTest = await testAccessToken(environment, authType);

    return {
      accessTokenIsValid: tokenTest.isValid,
      authType,
      needsRefresh: tokenTest.needsRefresh,
      expiry
    };

  } catch (error) {
    console.error('Error checking token status:', error);
    return {
      accessTokenIsValid: false,
      authType: 'unknown',
      needsRefresh: false
    };
  }
};

/**
 * Checks the refresh token status for a given environment
 * @param environment - The environment name to check refresh token status for
 * @returns Refresh token status information
 */
export function checkRefreshTokenStatus(environment: string): RefreshTokenStatus {
  try {
    const storedTokens = getStoredOAuthTokens(environment);

    if (!storedTokens) {
      return {
        refreshTokenIsValid: false,
        authType: 'oauth',
        needsRefresh: false
      };
    }

    if (!storedTokens.refreshToken) {
      return {
        refreshTokenIsValid: false,
        authType: 'oauth',
        needsRefresh: false
      };
    }

    const parsedToken = parseJwt(storedTokens.refreshToken);
    const expiry = new Date(parsedToken.exp * 1000);
    const now = new Date();

    if (expiry < now) {
      return {
        refreshTokenIsValid: false,
        authType: 'oauth',
        needsRefresh: true
      };
    }

    return {
      refreshTokenIsValid: true,
      authType: 'oauth',
      needsRefresh: false
    };

  } catch (error) {
    console.error('Error checking refresh token status:', error);
    return {
      refreshTokenIsValid: false,
      authType: 'oauth',
      needsRefresh: false
    };
  }
}

export async function testAccessToken(environment: string, authType: string): Promise<{ isValid: boolean, needsRefresh: boolean, error?: string }> {

  let storedTokens: TokenSet | { accessToken: string, accessExpiry: Date, clientId: string, clientSecret: string } | undefined;
  let accessToken;

  switch (authType) {
    case 'oauth': {
      storedTokens = getStoredOAuthTokens(environment);
      if (!storedTokens) {
        return { isValid: false, needsRefresh: false, error: 'No OAuth tokens found for environment: ' + environment };
      }
      if (checkTokenExpired(storedTokens.accessToken)) {
        return { isValid: false, needsRefresh: true };
      }
      accessToken = storedTokens.accessToken;
      break;
    }

    case 'pat': {
      storedTokens = getStoredPATTokens(environment);
      if (!storedTokens) {
        return { isValid: false, needsRefresh: false, error: 'No PAT tokens found for environment: ' + environment };
      }
      if (checkTokenExpired(storedTokens.accessToken)) {
        return { isValid: false, needsRefresh: true };
      }
      accessToken = storedTokens.accessToken;
      break;
    }

    default:
      return { isValid: false, needsRefresh: false, error: 'Unsupported auth type: ' + authType };
  }

  // Test the token against the API to see if it's still valid
  try {
    const config = getConfig();
    const envConfig = config.environments[environment];
    if (!envConfig) {
      console.log('Environment configuration not found');
      return { isValid: false, needsRefresh: false, error: 'Environment configuration not found' };
    }

    const apiUrl = envConfig.baseurl;
    const testConfig: ConfigurationParameters = {
      accessToken,
      baseurl: apiUrl,
    };

    const testApiConfig = new Configuration(testConfig);
    testApiConfig.experimental = true;
    const tenantApi = new TenantV2024Api(testApiConfig);

    // Try to get tenant info to validate the token
    const response = await tenantApi.getTenant();

    if (response.status === 200) {
      return {
        isValid: true,
        needsRefresh: false,
        error: undefined
      };
    } else {
      return {
        isValid: false,
        needsRefresh: true,
        error: formatErrorAsString(response.data)
      };
    }
  } catch (apiError) {
    // Token is invalid or expired, even though local expiry check passed
    console.log('OAuth token validation failed against API:', apiError);
    return {
      isValid: false,
      needsRefresh: true,
      error: formatErrorAsString(apiError)
    };
  }
}

export function checkTokenExpired(token: string) {
  const parsedToken = parseJwt(token);
  const expiry = new Date(parsedToken.exp * 1000);
  const now = new Date();
  return expiry < now;
}

export function validateTokens(environment: string) {
  try {
    switch (getGlobalAuthType()) {
      case 'oauth': {
        return {
          ...validateOAuthTokens(environment),
          authType: 'oauth'
        };
      }
      case 'pat': {
        return {
          ...validatePATToken(environment),
          authType: 'pat'
        };
      }
      default:
        return {
          isValid: false,
          needsRefresh: false,
          authType: 'unknown'
        };
    }
  } catch (error) {
    console.error('Error validating tokens:', error);
    return {
      isValid: false,
      needsRefresh: false,
      authType: 'unknown'
    };
  }
}