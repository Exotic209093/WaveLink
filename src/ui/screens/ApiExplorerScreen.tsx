/**
 * REST / Tooling API Explorer — make ad-hoc authenticated calls against the org.
 *
 * Enter any path (relative to `/services/data/vXX`, or starting with
 * `/services/` for an absolute service path) with an optional JSON body and see
 * the raw status + response. Powered by the shared `sf.apiCall` primitive, which
 * does not throw on non-2xx so error bodies are visible too.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { RawCallResult } from '../../services/salesforce/api-client';
import { Toast } from '../components/Toast';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
const METHODS: Method[] = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'];

const EXAMPLES: { label: string; method: Method; path: string }[] = [
  { label: 'Limits', method: 'GET', path: '/limits' },
  { label: 'All objects', method: 'GET', path: '/sobjects' },
  { label: 'API versions', method: 'GET', path: '/services/data' },
  { label: 'Tooling query', method: 'GET', path: '/tooling/query?q=SELECT Id, Name FROM ApexClass LIMIT 5' },
];

async function copyText(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
}

export function ApiExplorerScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;
  const [method, setMethod] = useState<Method>('GET');
  const [path, setPath] = useState('/limits');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<RawCallResult | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  const hasBody = method === 'POST' || method === 'PATCH' || method === 'PUT';

  async function send(): Promise<void> {
    if (!path.trim()) return;
    let parsedBody: unknown;
    if (hasBody && body.trim()) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        setToast({ title: 'Invalid JSON', body: 'The request body is not valid JSON.' });
        return;
      }
    }
    setSending(true);
    setResult(null);
    try {
      const res = await sf.apiCall(method, path.trim(), parsedBody, false, tabId);
      setResult(res);
    } catch (e) {
      setToast({ title: 'Request Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setSending(false);
    }
  }

  const pretty = result ? (typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2)) : '';

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>REST / Tooling Explorer</h2>
        <div class="wl-muted">Make authenticated API calls against this org</div>
      </div>

      <div class="wl-row" style="gap:8px;margin-bottom:8px;flex-wrap:wrap">
        {EXAMPLES.map(ex => (
          <button
            key={ex.path}
            class="wl-pill"
            style="cursor:pointer;border:none;font-size:11px"
            onClick={() => { setMethod(ex.method); setPath(ex.path); setResult(null); }}
          >{ex.label}</button>
        ))}
      </div>

      <div class="wl-row" style="gap:8px;align-items:stretch">
        <select class="wl-input" style="width:110px" value={method} onChange={(e) => setMethod((e.currentTarget as HTMLSelectElement).value as Method)}>
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          class="wl-input"
          style="flex:1;font-family:var(--wl-mono,monospace);font-size:13px"
          placeholder="/sobjects/Account/describe"
          value={path}
          onInput={(e) => setPath((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button class="wl-buttonBrand" disabled={sending || !path.trim()} onClick={send}>{sending ? 'Sending…' : 'Send'}</button>
      </div>

      {hasBody ? (
        <div style="margin-top:8px">
          <div class="wl-muted" style="margin-bottom:4px">Request body (JSON)</div>
          <textarea
            class="wl-input"
            style="width:100%;min-height:120px;font-family:var(--wl-mono,monospace);font-size:12px;resize:vertical"
            spellcheck={false}
            placeholder='{ "Name": "Acme" }'
            value={body}
            onInput={(e) => setBody((e.currentTarget as HTMLTextAreaElement).value)}
          />
        </div>
      ) : null}

      {result ? (
        <div style="margin-top:14px">
          <div class="wl-row" style="gap:8px;align-items:center">
            <span class="wl-pill" style={`color:#fff;${result.ok ? 'background:var(--wl-accent)' : 'background:var(--wl-danger)'}`}>
              {result.status}{result.ok ? ' OK' : ''}
            </span>
            <button class="wl-btn" style="padding:2px 10px;font-size:11px;margin-left:auto" onClick={() => { copyText(pretty); setToast({ title: 'Copied', body: 'Response copied' }); }}>Copy response</button>
          </div>
          <pre class="wl-mono" style="white-space:pre-wrap;font-size:12px;margin:8px 0 0;max-height:480px;overflow:auto;background:var(--wl-surface-2,rgba(0,0,0,0.04));padding:10px;border-radius:8px">{pretty}</pre>
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
