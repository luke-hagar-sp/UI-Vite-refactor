import { dialog, shell } from "electron";
import { getTokenDetails, parseJwt } from "./auth";
import { getConfig, getSecureValue, setSecureValue } from "./config";
import { LambdaUUIDResponse, RefreshResponse, TokenResponse, TokenSet } from "./types";

const AuthLambdaBaseURL = 'https://nug87yusrg.execute-api.us-east-1.amazonaws.com/Prod/sailapps'
const authLambdaUUIDURL = `${AuthLambdaBaseURL}/uuid`
const authLambdaRefreshURL = `${AuthLambdaBaseURL}/refresh`


// The token decrypt function for the second half of the OAuth lambda flow
async function decryptTokenInfo(encryptedToken: string, encryptionKey: string): Promise<string> {
    try {
        // Split the IV and encrypted data
        const parts = encryptedToken.split(':');
        if (parts.length !== 2) {
            throw new Error('invalid encrypted token format');
        }

        // Convert hex-encoded IV and encrypted data to Buffer
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedData = Buffer.from(parts[1], 'hex');

        // Convert hex-encoded encryption key to Buffer
        const key = Buffer.from(encryptionKey, 'hex');

        // Create decipher
        const crypto = require('crypto');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        decipher.setAutoPadding(false); // We'll handle padding manually

        // Decrypt the data
        let decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);

        // Remove PKCS7 padding
        if (decrypted.length > 0) {
            const paddingLen = decrypted[decrypted.length - 1];
            // PKCS7 padding: padding length should be between 1 and block size (16 for AES)
            if (paddingLen > 0 && paddingLen <= 16 && paddingLen <= decrypted.length) {
                // Verify all padding bytes are the same
                let validPadding = true;
                for (let i = decrypted.length - paddingLen; i < decrypted.length; i++) {
                    if (decrypted[i] !== paddingLen) {
                        validPadding = false;
                        break;
                    }
                }

                if (validPadding) {
                    decrypted = decrypted.subarray(0, decrypted.length - paddingLen);
                }
            }
        }

        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Decryption error:', error);
        throw error;
    }
}

/**
* Retrieves stored OAuth tokens for a given environment
* @param environment - The environment name to retrieve tokens for
* @returns Promise resolving to stored OAuth tokens or undefined if not found
*/
export function getStoredOAuthTokens(environment: string): TokenSet | undefined {
    try {
        const accessToken = getSecureValue('environments.oauth.accesstoken', environment);
        const accessExpiry = getSecureValue('environments.oauth.expiry', environment);
        const refreshToken = getSecureValue('environments.oauth.refreshtoken', environment);
        const refreshExpiry = getSecureValue('environments.oauth.refreshexpiry', environment);

        if (!accessToken || !accessExpiry || !refreshToken || !refreshExpiry) {
            return undefined;
        }

        return {
            accessToken,
            accessExpiry: new Date(accessExpiry),
            refreshToken,
            refreshExpiry: new Date(refreshExpiry),
        };
    } catch (error) {
        console.error('Error retrieving OAuth tokens:', error);
        throw error;
    }
}

/**
 * Stores OAuth tokens securely for a given environment
 * @param environment - The environment name to store tokens for
 * @param tokenSet - The token set to store
 */
export function storeOAuthTokens(environment: string, tokenSet: TokenSet): void {
    console.log('Storing OAuth tokens for environment:', environment);
    if (!tokenSet.refreshToken || !tokenSet.refreshExpiry) {
        throw new Error('Invalid token set, missing refresh token or expiry');
    }

    try {
        setSecureValue('environments.oauth.accesstoken', environment, tokenSet.accessToken);
        setSecureValue('environments.oauth.expiry', environment, tokenSet.accessExpiry.toISOString());
        setSecureValue('environments.oauth.refreshtoken', environment, tokenSet.refreshToken);
        setSecureValue('environments.oauth.refreshexpiry', environment, tokenSet.refreshExpiry.toISOString());

        console.log(`OAuth tokens stored for environment: ${environment}`);
    } catch (error) {
        console.error('Error storing OAuth tokens:', error);
        throw error;
    }
}

/**
* Validates OAuth tokens for a given environment
* @param environment - The environment name to validate OAuth tokens for
* @returns Promise resolving to token validation result
*/
export function validateOAuthTokens(environment: string) {
    try {
        const storedTokens = getStoredOAuthTokens(environment);
        if (!storedTokens) {
            return { isValid: false, needsRefresh: false };
        }

        if (!storedTokens.refreshToken || !storedTokens.refreshExpiry) {
            return { isValid: false, needsRefresh: false };
        }

        const now = new Date();

        // Check if refresh token is expired, the refresh token should always be the last thing to expire, so if its expired, we need a whole new OAuth session
        const refreshTokenDetails = getTokenDetails(storedTokens.refreshToken);
        if (refreshTokenDetails.expiry < now) {
            console.log('OAuth refresh token is expired');
            return { isValid: false, needsRefresh: false, tokenDetails: refreshTokenDetails };
        }

        // Check if access token is expired or will expire soon (within 5 minutes)
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        const accessTokenDetails = getTokenDetails(storedTokens.accessToken);
        if (accessTokenDetails.expiry <= fiveMinutesFromNow) {
            console.log('OAuth access token is expired or expiring soon, needs refresh');
            return {
                isValid: false,
                needsRefresh: true,
                tokenDetails: accessTokenDetails
            };
        }

        return { isValid: true, needsRefresh: false, tokenDetails: accessTokenDetails };
    } catch (error) {
        console.error('Error validating OAuth tokens:', error);
        return { isValid: false, needsRefresh: false };
    }
}


/**
 * Performs OAuth login for a given environment
 * @param tenant - The tenant name
 * @param baseAPIUrl - The base API URL
 * @param environment - The environment name
 * @returns Promise resolving to the token set
 */
export const OAuthLogin = async ({ tenant, baseAPIUrl, environment }: { tenant: string, baseAPIUrl: string, environment: string }): Promise<{ success: boolean, error: string }> => {
    try {
        // Step 1: Request UUID, encryption key, and Auth URL from Auth-Lambda
        const response = await fetch(authLambdaUUIDURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tenant, apiBaseURL: baseAPIUrl }),
        });

        if (!response.ok) {
            throw new Error(`Auth lambda returned non-200 status: ${response.status}`);
        }

        const authResponse: LambdaUUIDResponse = await response.json();
        console.log('Auth Response:', authResponse);

        // Step 2: Present Auth URL to user
        console.log('Attempting to open browser for authentication');
        try {
            // Using Electron's shell.openExternal to open the browser
            await shell.openExternal(authResponse.authURL);
            console.log('Successfully opened OAuth URL in default browser');

        } catch (err) {
            dialog.showMessageBox({
                title: 'OAuth Login',
                message: 'Please manually open the OAuth login page below',
                detail: authResponse.authURL,
                buttons: ['OK']
            });
            console.warn('Cannot open browser automatically. Please manually open OAuth login page below');
            console.log('OAuth URL:', authResponse.authURL);
            // Continue with the flow even if browser opening fails
        }

        // Step 3: Poll Auth-Lambda for token using UUID
        const pollInterval = 2000; // 2 seconds
        const timeout = 5 * 60 * 1000; // 5 minutes
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                const tokenResponse = await fetch(`${authLambdaUUIDURL}/${authResponse.id}`);

                if (tokenResponse.ok) {
                    const tokenData: TokenResponse = await tokenResponse.json();

                    // Step 4:Decrypt the token info using the encryption key
                    const decryptedTokenInfo = await decryptTokenInfo(tokenData.tokenInfo, authResponse.encryptionKey);
                    console.log('Decrypted token info:', decryptedTokenInfo);

                    const response: RefreshResponse = JSON.parse(decryptedTokenInfo);
                    console.log('Parsed response:', response);

                    // Validate that we have the required tokens
                    if (!response.access_token) {
                        console.error('Missing accessToken in response');
                        return { success: false, error: 'OAuth response missing access token' };
                    }

                    if (!response.refresh_token) {
                        console.error('Missing refreshToken in response');
                        return { success: false, error: 'OAuth response missing refresh token' };
                    }

                    // Step 5: Parse and store the tokens
                    const accessTokenClaims = parseJwt(response.access_token);
                    const refreshTokenClaims = parseJwt(response.refresh_token);

                    const tokenSet = {
                        accessToken: response.access_token,
                        accessExpiry: new Date(accessTokenClaims.exp * 1000),
                        refreshToken: response.refresh_token,
                        refreshExpiry: new Date(refreshTokenClaims.exp * 1000),
                    };

                    storeOAuthTokens(environment, tokenSet);
                    return { success: true, error: '' };
                }
            } catch (err) {
                console.error('Error polling for token:', err);
            }

            // We are polling the API every 2 seconds, to continue the exchange after the user has logged in
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        return { success: false, error: 'Authentication timed out after 5 minutes' };
    } catch (error) {
        console.error('OAuth login error:', error);
        return { success: false, error: 'OAuth login failed: ' + error };
    }
};

/**
 * Refreshes OAuth tokens for a given environment using the provided refresh token
 * @param environment - The environment name to refresh tokens for
 * @param refreshToken - The refresh token to use for obtaining new tokens
 * @returns Promise resolving to the new token set
 */
export const refreshOAuthToken = async (environment: string): Promise<void> => {
    try {
        console.log(`Refreshing OAuth token for environment: ${environment}`);

        // Get API URL from config
        const config = getConfig();
        const envConfig = config.environments[environment];
        if (!envConfig) {
            throw new Error('Environment configuration not found');
        }

        const storedTokens = getStoredOAuthTokens(environment);
        if (!storedTokens) {
            throw new Error('No stored OAuth tokens found for environment');
        }

        const apiUrl = envConfig.baseurl;;

        // Prepare the refresh request body
        const refreshRequestBody = {
            refreshToken: storedTokens.refreshToken,
            apiBaseURL: apiUrl,
            tenant: environment
        };

        const response = await fetch(authLambdaRefreshURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(refreshRequestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Lambda refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const refreshData: RefreshResponse = await response.json();

        if (!refreshData.access_token) {
            throw new Error('No access token in refresh response');
        }

        if (!refreshData.refresh_token) {
            throw new Error('No refresh token in refresh response');
        }

        // Parse tokens to get expiry
        const accessTokenClaims = parseJwt(refreshData.access_token);
        const refreshTokenClaims = parseJwt(refreshData.refresh_token);

        const tokenSet = {
            accessToken: refreshData.access_token,
            accessExpiry: new Date(accessTokenClaims.exp * 1000),
            refreshToken: refreshData.refresh_token,
            refreshExpiry: new Date(refreshTokenClaims.exp * 1000),
        };

        // Store the new tokens for future use
        storeOAuthTokens(environment, tokenSet);

        console.log('OAuth token refresh successful');
    } catch (error) {
        console.error('Error refreshing OAuth token:', error);
        throw error;
    }
};