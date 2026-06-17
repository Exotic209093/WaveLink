/**
 * Anonymous Apex Runner — execute anonymous Apex via the Tooling API.
 *
 * Salesforce's REST `executeAnonymous` endpoint returns compile/execution
 * status (compile errors, runtime exceptions, line/column) but not the
 * System.debug log output — capturing that requires trace flags, so this
 * screen surfaces success, compile problems, and exceptions clearly.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { ExecuteAnonymousResult } from '../../services/salesforce/api-client';
import { Toast } from '../components/Toast';

const SAMPLE = "System.debug('Hello from WaveLink');";

export function ApexRunnerScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;
  const [body, setBody] = useState(SAMPLE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecuteAnonymousResult | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  async function run(): Promise<void> {
    if (!body.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await sf.executeAnonymous(body, tabId);
      setResult(res);
    } catch (e) {
      setToast({ title: 'Execution Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setRunning(false);
    }
  }

  const ok = result?.compiled && result?.success;

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Anonymous Apex</h2>
        <div class="wl-muted">Execute anonymous Apex against this org (Tooling API)</div>
      </div>

      <textarea
        class="wl-input"
        style="width:100%;min-height:220px;font-family:var(--wl-mono,monospace);font-size:13px;resize:vertical"
        spellcheck={false}
        value={body}
        placeholder="// Enter anonymous Apex…"
        onInput={(e) => setBody((e.currentTarget as HTMLTextAreaElement).value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run(); }}
      />

      <div class="wl-row" style="margin-top:10px;align-items:center;gap:10px">
        <button class="wl-buttonBrand" disabled={running || !body.trim()} onClick={run}>
          {running ? 'Running…' : 'Run'}
        </button>
        <span class="wl-muted" style="font-size:12px">⌘/Ctrl + Enter to run</span>
      </div>

      {result ? (
        <div style="margin-top:14px">
          <div class="wl-row" style="gap:8px;align-items:center">
            <span class={ok ? 'wl-pill wl-pill--brand' : 'wl-pill'} style={ok ? '' : 'background:var(--wl-danger);color:#fff'}>
              {ok ? 'Success' : !result.compiled ? 'Compile error' : 'Runtime exception'}
            </span>
            {!ok && (result.line >= 0) ? <span class="wl-muted" style="font-size:12px">line {result.line}, col {result.column}</span> : null}
          </div>

          {result.compileProblem ? (
            <div style="margin-top:10px">
              <div class="wl-muted" style="margin-bottom:4px;font-weight:900">Compile problem</div>
              <pre class="wl-mono" style="white-space:pre-wrap;font-size:12px;color:var(--wl-danger);margin:0">{result.compileProblem}</pre>
            </div>
          ) : null}

          {result.exceptionMessage ? (
            <div style="margin-top:10px">
              <div class="wl-muted" style="margin-bottom:4px;font-weight:900">Exception</div>
              <pre class="wl-mono" style="white-space:pre-wrap;font-size:12px;color:var(--wl-danger);margin:0">{result.exceptionMessage}</pre>
              {result.exceptionStackTrace ? (
                <pre class="wl-mono" style="white-space:pre-wrap;font-size:11px;margin:6px 0 0;opacity:0.8">{result.exceptionStackTrace}</pre>
              ) : null}
            </div>
          ) : null}

          {ok ? (
            <div class="wl-muted" style="margin-top:10px;font-size:12px">
              Code compiled and executed successfully. Debug-log output (System.debug) isn't returned by the REST API — use the developer console or set a trace flag to capture logs.
            </div>
          ) : null}
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
