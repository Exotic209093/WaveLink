/**
 * Content Script - Salesforce Org Detection.
 *
 * Injected into Salesforce pages to:
 * - Detect which org the user is currently in
 * - Extract org metadata from the page context
 * - Relay org info to the background service worker
 */

import { MessageBus } from '../services/messaging';
import { isSalesforceUrl, extractSalesforceInstance } from '../core/utils';
import type { OrgDetectPayload } from '../core/types/messaging';

const messageBus = new MessageBus('content');

/**
 * Detect Salesforce org information from the current page.
 */
function detectSalesforceOrg(): OrgDetectPayload | null {
  const url = window.location.href;

  if (!isSalesforceUrl(url)) {
    return null;
  }

  const instance = extractSalesforceInstance(url);

  const payload: OrgDetectPayload = {
    url,
    instanceUrl: `https://${window.location.hostname}`,
  };

  // Try to extract org ID from page context
  const orgId = extractOrgIdFromPage();
  if (orgId) {
    payload.orgId = orgId;
  }

  // Try to extract username
  const username = extractUsernameFromPage();
  if (username) {
    payload.username = username;
  }

  return payload;
}

/**
 * Attempt to extract the Salesforce Org ID from the page.
 * Looks for common DOM patterns in Lightning Experience.
 */
function extractOrgIdFromPage(): string | null {
  // Method 1: Check for org ID in the aura framework context
  try {
    const auraConfig = document.querySelector('script[data-aura-config]');
    if (auraConfig) {
      const config = auraConfig.getAttribute('data-aura-config');
      if (config) {
        const parsed = JSON.parse(config);
        if (parsed.orgId) return parsed.orgId;
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Method 2: Check meta tags
  const metaOrgId = document.querySelector('meta[name="org-id"]');
  if (metaOrgId) {
    const content = metaOrgId.getAttribute('content');
    if (content) return content;
  }

  return null;
}

/**
 * Attempt to extract the current username from the page.
 */
function extractUsernameFromPage(): string | null {
  // Check for username in common Lightning elements
  const userNavItem = document.querySelector('.uiOutputText[data-aura-rendered-by]');
  if (userNavItem?.textContent) {
    return userNavItem.textContent.trim();
  }

  return null;
}

/**
 * Send detected org info to the background service worker.
 */
async function reportOrgDetection(): Promise<void> {
  const orgInfo = detectSalesforceOrg();
  if (!orgInfo) return;

  try {
    await messageBus.send('ORG_DETECT', orgInfo);
  } catch (error) {
    // Background may not be ready yet, fail silently
    console.debug('WaveLink: Could not report org detection', error);
  }
}

// ── Handle incoming messages from popup/background ───────────────────

messageBus.on('ORG_INFO', async (message) => {
  const orgInfo = detectSalesforceOrg();
  return {
    success: true,
    data: orgInfo,
    requestId: message.requestId,
  };
});

// ── Initialize ───────────────────────────────────────────────────────

// Report org detection when content script loads
reportOrgDetection();

// Re-detect on URL changes (SPA navigation in Lightning)
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    reportOrgDetection();
  }
});

urlObserver.observe(document.body, { childList: true, subtree: true });

console.debug('WaveLink content script initialized');
