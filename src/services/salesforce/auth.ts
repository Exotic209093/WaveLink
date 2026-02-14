/**
 * Salesforce OAuth 2.0 authentication service.
 * Uses the Web Server OAuth flow with PKCE for Chrome extensions.
 */

import { SALESFORCE_LOGIN_URLS, OAUTH_ENDPOINTS, TOKEN_REFRESH_BUFFER_MS } from '../../core/constants';
import { AuthError, TokenExpiredError } from '../../core/errors';
import type { SalesforceOrg, SalesforceEnvironment } from '../../core/types/salesforce';

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
  scope: string;
}

export interface OAuthUserInfo {
  sub: string;
  name: string;
  preferred_username: string;
  organization_id: string;
  email: string;
}

/**
 * Generates a PKCE code verifier and challenge pair.
 */
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array);

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64UrlEncode(new Uint8Array(digest));

  return { verifier, challenge };
}

function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * SalesforceAuth manages the OAuth 2.0 PKCE flow for Chrome extensions.
 */
export class SalesforceAuth {
  private config: OAuthConfig;
  private pendingVerifier: string | null = null;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Initiates the OAuth login flow using chrome.identity.launchWebAuthFlow.
   */
  async login(environment: SalesforceEnvironment): Promise<SalesforceOrg> {
    const loginUrl = environment === 'sandbox'
      ? SALESFORCE_LOGIN_URLS.sandbox
      : SALESFORCE_LOGIN_URLS.production;

    const { verifier, challenge } = await generatePKCE();
    this.pendingVerifier = verifier;

    const authUrl = this.buildAuthorizationUrl(loginUrl, challenge);

    const callbackUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(new AuthError(
              chrome.runtime.lastError.message ?? 'Authentication failed',
            ));
            return;
          }
          if (!responseUrl) {
            reject(new AuthError('No response URL received'));
            return;
          }
          resolve(responseUrl);
        },
      );
    });

    const authCode = this.extractAuthCode(callbackUrl);
    const tokens = await this.exchangeCodeForTokens(loginUrl, authCode, verifier);
    const userInfo = await this.fetchUserInfo(tokens.instance_url, tokens.access_token);

    this.pendingVerifier = null;

    return this.buildOrgFromTokens(tokens, userInfo, environment);
  }

  /**
   * Refreshes an expired access token using the refresh token.
   */
  async refreshAccessToken(org: SalesforceOrg): Promise<SalesforceOrg> {
    if (!org.refreshToken) {
      throw new AuthError('No refresh token available for org');
    }

    const loginUrl = org.environment === 'sandbox'
      ? SALESFORCE_LOGIN_URLS.sandbox
      : SALESFORCE_LOGIN_URLS.production;

    const tokenUrl = `${loginUrl}${OAUTH_ENDPOINTS.token}`;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: org.refreshToken,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AuthError(`Token refresh failed: ${response.status}`, errorBody);
    }

    const tokens: Partial<OAuthTokenResponse> = await response.json();

    return {
      ...org,
      accessToken: tokens.access_token!,
      instanceUrl: tokens.instance_url ?? org.instanceUrl,
      tokenExpiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
      lastUsedAt: Date.now(),
    };
  }

  /**
   * Checks if a token needs refreshing.
   */
  isTokenExpired(org: SalesforceOrg): boolean {
    return Date.now() >= org.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS;
  }

  /**
   * Ensures we have a valid access token, refreshing if needed.
   */
  async ensureValidToken(org: SalesforceOrg): Promise<SalesforceOrg> {
    if (!this.isTokenExpired(org)) {
      return org;
    }

    if (!org.refreshToken) {
      throw new TokenExpiredError(org.orgId);
    }

    return this.refreshAccessToken(org);
  }

  /**
   * Revokes the access token and refresh token for an org.
   */
  async logout(org: SalesforceOrg): Promise<void> {
    const loginUrl = org.environment === 'sandbox'
      ? SALESFORCE_LOGIN_URLS.sandbox
      : SALESFORCE_LOGIN_URLS.production;

    const revokeUrl = `${loginUrl}${OAUTH_ENDPOINTS.revoke}`;

    // Revoke refresh token (which also invalidates access token)
    const tokenToRevoke = org.refreshToken ?? org.accessToken;

    await fetch(revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: tokenToRevoke }).toString(),
    });
  }

  private buildAuthorizationUrl(loginUrl: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'login consent',
    });

    return `${loginUrl}${OAUTH_ENDPOINTS.authorize}?${params.toString()}`;
  }

  private extractAuthCode(callbackUrl: string): string {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    if (!code) {
      const error = url.searchParams.get('error');
      const errorDesc = url.searchParams.get('error_description');
      throw new AuthError(
        `Authorization failed: ${error ?? 'unknown error'} - ${errorDesc ?? ''}`,
      );
    }
    return code;
  }

  private async exchangeCodeForTokens(
    loginUrl: string,
    authCode: string,
    codeVerifier: string,
  ): Promise<OAuthTokenResponse> {
    const tokenUrl = `${loginUrl}${OAUTH_ENDPOINTS.token}`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      code: authCode,
      code_verifier: codeVerifier,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AuthError(`Token exchange failed: ${response.status}`, errorBody);
    }

    return response.json();
  }

  private async fetchUserInfo(instanceUrl: string, accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(`${instanceUrl}${OAUTH_ENDPOINTS.userinfo}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new AuthError(`Failed to fetch user info: ${response.status}`);
    }

    return response.json();
  }

  private buildOrgFromTokens(
    tokens: OAuthTokenResponse,
    userInfo: OAuthUserInfo,
    environment: SalesforceEnvironment,
  ): SalesforceOrg {
    return {
      id: userInfo.organization_id,
      orgId: userInfo.organization_id,
      instanceUrl: tokens.instance_url,
      environment,
      username: userInfo.preferred_username,
      displayName: userInfo.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: Date.now() + 2 * 60 * 60 * 1000,
      apiVersion: 'v59.0',
      connectedAt: Date.now(),
      lastUsedAt: Date.now(),
    };
  }
}
