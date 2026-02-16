/**
 * Salesforce authentication service using the existing browser session.
 * Reads the active Salesforce session cookie (`sid`) and uses it as
 * a bearer token for API calls.
 *
 * Why this approach:
 * - Avoids OAuth / connected-app setup for internal tooling.
 * - Mirrors Salesforce Inspector: if you're logged into Salesforce in the browser, the extension can call APIs.
 *
 * Data types:
 * - Returns a `SalesforceOrg` object containing `instanceUrl`, `accessToken` (sid), and identity fields.
 *
 * Complexity:
 * - Cookie enumeration can be O(C) where C is the number of `sid` cookies in the browser.
 * - Session validation and identity resolution involve network calls (dominant cost).
 */

import { DEFAULT_API_VERSION, TOKEN_REFRESH_BUFFER_MS } from '../../core/constants';
import { AuthError, TokenExpiredError } from '../../core/errors';
import type { SalesforceOrg, SalesforceEnvironment } from '../../core/types/salesforce';
import { isSalesforceUrl } from '../../core/utils';

interface SalesforceApiRootResponse {
  identity?: string;
}

interface SalesforceIdentityResponse {
  organization_id?: string;
  username?: string;
  user_name?: string;
  display_name?: string;
  name?: string;
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function domainMatches(hostname: string, cookieDomain: string): boolean {
  // Time: O(1). Data: treats leading-dot cookie domains as suffix matches.
  const normalizedCookieDomain = cookieDomain.replace(/^\./, '');
  return hostname === normalizedCookieDomain || hostname.endsWith(`.${normalizedCookieDomain}`);
}

function inferEnvironment(hostname: string): SalesforceEnvironment {
  if (hostname.includes('.sandbox.') || hostname.includes('--')) {
    return 'sandbox';
  }
  return 'production';
}

function normalizeSessionId(value: string): string {
  // Time: O(N) in cookie length. Data: trims, unquotes, and URI-decodes if needed.
  let normalized = value.trim().replace(/^"|"$/g, '');
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep original if the cookie is not URI-encoded.
  }
  return normalized;
}

/**
 * SalesforceAuth implements Inspector-style authentication:
 * no Connected App, no OAuth flow, reuse existing Salesforce browser session.
 */
export class SalesforceAuth {
  /**
   * Authenticates using the active Salesforce browser tab/session.
   *
   * Complexity: O(1) JS work; may do network validation.
   */
  async login(_environment?: SalesforceEnvironment): Promise<SalesforceOrg> {
    const tab = await this.getActiveSalesforceTab();
    return this.loginFromTab(tab);
  }

  /**
   * Authenticates using a specific Salesforce tab (used by the full-page app).
   *
   * Complexity: O(1) JS work; may do network validation.
   */
  async loginForTab(tabId: number): Promise<SalesforceOrg> {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url || !isSalesforceUrl(tab.url)) {
      throw new AuthError('Selected tab is not a Salesforce page.');
    }
    return this.loginFromTab(tab);
  }

  private async loginFromTab(tab: chrome.tabs.Tab): Promise<SalesforceOrg> {
    const tabUrl = new URL(tab.url!);
    const candidateInstanceUrls = this.getCandidateInstanceUrls(tabUrl);
    const candidateTokens = await this.getSessionIdsForInstances(candidateInstanceUrls);

    if (candidateTokens.length === 0) {
      throw new AuthError('No Salesforce session found. Log into Salesforce in this browser tab first.');
    }

    const resolved = await this.resolveValidSession(candidateInstanceUrls, candidateTokens);
    if (!resolved) {
      throw new AuthError(
        'Salesforce session was found but API auth failed. Open your org home in a logged-in tab, then reconnect.',
      );
    }

    const identity = await this.fetchIdentity(resolved.instanceUrl, resolved.accessToken);
    const connectedAt = Date.now();

    return {
      id: identity.orgId,
      orgId: identity.orgId,
      instanceUrl: resolved.instanceUrl,
      environment: inferEnvironment(new URL(resolved.instanceUrl).hostname),
      username: identity.username,
      displayName: identity.displayName,
      accessToken: resolved.accessToken,
      tokenExpiresAt: connectedAt + SESSION_TTL_MS,
      apiVersion: DEFAULT_API_VERSION,
      connectedAt,
      lastUsedAt: connectedAt,
    };
  }

  /**
   * Checks if a token should be refreshed from browser cookies.
   */
  isTokenExpired(org: SalesforceOrg): boolean {
    return Date.now() >= org.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS;
  }

  /**
   * Ensures we have a current session token from browser cookies.
   */
  async ensureValidToken(org: SalesforceOrg): Promise<SalesforceOrg> {
    const orgInstance = new URL(org.instanceUrl);
    const candidateInstanceUrls = this.prioritizeCandidateUrls(
      org.instanceUrl,
      this.getCandidateInstanceUrls(orgInstance),
    );
    const candidateTokens = await this.getSessionIdsForInstances(candidateInstanceUrls);
    if (candidateTokens.length === 0) {
      throw new TokenExpiredError(org.orgId);
    }

    const tokenCandidates = Array.from(new Set([org.accessToken, ...candidateTokens]));
    const resolved = await this.resolveValidSession(candidateInstanceUrls, tokenCandidates);
    if (!resolved) {
      throw new TokenExpiredError(org.orgId);
    }

    const shouldUpdate =
      resolved.accessToken !== org.accessToken
      || resolved.instanceUrl !== org.instanceUrl
      || this.isTokenExpired(org);
    if (!shouldUpdate) {
      return org;
    }

    return {
      ...org,
      instanceUrl: resolved.instanceUrl,
      accessToken: resolved.accessToken,
      tokenExpiresAt: Date.now() + SESSION_TTL_MS,
      lastUsedAt: Date.now(),
    };
  }

  /**
   * Disconnects extension state only; does not log user out of Salesforce.
   */
  async logout(_org: SalesforceOrg): Promise<void> {
    return;
  }

  private async getActiveSalesforceTab(): Promise<chrome.tabs.Tab> {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs.find(t => t.id !== undefined && typeof t.url === 'string' && isSalesforceUrl(t.url));

    if (!tab || !tab.url) {
      throw new AuthError('Open an authenticated Salesforce tab, then connect WaveLink.');
    }

    return tab;
  }

  private getCandidateInstanceUrls(baseUrl: URL): string[] {
    const urls = new Set<string>([baseUrl.origin]);
    const lightningMatch = baseUrl.hostname.match(/^([a-zA-Z0-9-]+)\.lightning\.force\.com$/);
    if (lightningMatch) {
      urls.add(`https://${lightningMatch[1]}.my.salesforce.com`);
      urls.add(`https://${lightningMatch[1]}.lightning.force.com`);
    }

    const myDomainMatch = baseUrl.hostname.match(/^([a-zA-Z0-9-]+)\.my\.salesforce\.com$/);
    if (myDomainMatch) {
      urls.add(`https://${myDomainMatch[1]}.my.salesforce.com`);
      urls.add(`https://${myDomainMatch[1]}.lightning.force.com`);
    }

    return Array.from(urls);
  }

  private prioritizeCandidateUrls(primary: string, candidates: string[]): string[] {
    const deduped = new Set<string>([primary, ...candidates]);
    return Array.from(deduped);
  }

  private async getSessionIdsForInstances(instanceUrls: string[]): Promise<string[]> {
    /**
     * Collect possible session IDs for the candidate instance URLs.
     *
     * Why multiple sources:
     * - Cookies may be set on different domains (myDomain, lightning, etc).
     * - We attempt direct `cookies.get` per instance URL and also scan all `sid` cookies to match by domain.
     *
     * Complexity: O(I + C*Ih) where:
     * - I = instanceUrls.length
     * - C = number of `sid` cookies
     * - Ih = number of instance hostnames (same as I)
     */
    const sessionIds = new Set<string>();
    const instanceHosts = instanceUrls.map(url => new URL(url).hostname);

    for (const instanceUrl of instanceUrls) {
      const sidCookie = await chrome.cookies.get({ url: instanceUrl, name: 'sid' });
      if (sidCookie?.value) {
        sessionIds.add(normalizeSessionId(sidCookie.value));
      }
    }

    const sidCookies = await chrome.cookies.getAll({ name: 'sid' });
    for (const sidCookie of sidCookies) {
      const matchesAnyInstance = instanceHosts.some(hostname => domainMatches(hostname, sidCookie.domain));
      if (matchesAnyInstance && sidCookie.value) {
        sessionIds.add(normalizeSessionId(sidCookie.value));
      }
    }

    return Array.from(sessionIds).filter(Boolean);
  }

  private async resolveValidSession(
    instanceUrls: string[],
    accessTokens: string[],
  ): Promise<{ instanceUrl: string; accessToken: string } | null> {
    /**
     * Find the first (instanceUrl, accessToken) pair that successfully validates against the REST API root.
     *
     * Complexity: O(I * A) validations where I=instanceUrls.length and A=accessTokens.length (each validation is network).
     */
    for (const instanceUrl of instanceUrls) {
      for (const accessToken of accessTokens) {
        const isValid = await this.validateSession(instanceUrl, accessToken);
        if (isValid) {
          return { instanceUrl, accessToken };
        }
      }
    }
    return null;
  }

  private async validateSession(instanceUrl: string, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${instanceUrl}/services/data/${DEFAULT_API_VERSION}/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async fetchIdentity(
    instanceUrl: string,
    accessToken: string,
  ): Promise<{ orgId: string; username: string; displayName: string }> {
    const rootResponse = await fetch(`${instanceUrl}/services/data/${DEFAULT_API_VERSION}/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!rootResponse.ok) {
      throw new AuthError(
        `Salesforce session validation failed (${rootResponse.status}). Log in again and reconnect.`,
      );
    }

    const rootData = await rootResponse.json() as SalesforceApiRootResponse;
    const identityUrl = rootData.identity;

    if (!identityUrl) {
      throw new AuthError('Could not resolve Salesforce identity endpoint from current session.');
    }

    const identityResponse = await fetch(identityUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!identityResponse.ok) {
      throw new AuthError(`Failed to fetch Salesforce identity (${identityResponse.status}).`);
    }

    const identityData = await identityResponse.json() as SalesforceIdentityResponse;
    const orgId = identityData.organization_id ?? this.extractOrgIdFromIdentityUrl(identityUrl);
    const username = identityData.username ?? identityData.user_name ?? 'Salesforce User';
    const displayName = identityData.display_name ?? identityData.name ?? username;

    if (!orgId) {
      throw new AuthError('Unable to determine Salesforce org ID from current session.');
    }

    return { orgId, username, displayName };
  }

  private extractOrgIdFromIdentityUrl(identityUrl: string): string | null {
    const match = identityUrl.match(/\/id\/([^/]+)\//);
    return match ? match[1] : null;
  }
}
