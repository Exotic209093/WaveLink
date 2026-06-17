/**
 * Anonymous Apex Runner — execute anonymous Apex via the Tooling API.
 *
 * Salesforce's REST `executeAnonymous` endpoint returns compile/execution
 * status (compile errors, runtime exceptions, line/column) but not the
 * System.debug log output. With "Capture debug log" enabled, this screen also
 * ensures a TraceFlag is active for the current user, then fetches the resulting
 * ApexLog body after execution. Log capture is best-effort: the Apex still runs
 * and reports status even if the log can't be retrieved.
 */

import type { VNode } from 'preact';
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import type { SfApi, SfContext } from '../api/sf';
import type { ExecuteAnonymousResult } from '../../services/salesforce/api-client';
import { Toast } from '../components/Toast';
import { copyToClipboard } from '../utils/clipboard';

const SAMPLE = "System.debug('Hello from WaveLink');";

/** SOQL string-literal escaping for the username lookup. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** True when a TraceFlag write failed only because an overlapping flag already exists. */
function isAlreadyTracedError(body: unknown): boolean {
  const arr = Array.isArray(body) ? body : body ? [body] : [];
  return arr.some((e) => {
    const code = String((e as { errorCode?: string })?.errorCode ?? '');
    const msg = String((e as { message?: string })?.message ?? '');
    return code === 'DUPLICATE_VALUE' || code === 'FIELD_INTEGRITY_EXCEPTION' || /already|overlap/i.test(msg);
  });
}

export function ApexRunnerScreen(props: { sf: SfApi; tabId: number; context?: SfContext }): VNode {
  const { sf, tabId, context } = props;
  const [body, setBody] = useState(SAMPLE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecuteAnonymousResult | null>(null);
  const [captureLog, setCaptureLog] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [logNote, setLogNote] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  /** Resolve the current user's Id from the connected username. */
  async function currentUserId(): Promise<string | null> {
    if (!context?.username) return null;
    const res = await sf.runQuery(`SELECT Id FROM User WHERE Username = '${esc(context.username)}' LIMIT 1`, tabId);
    return res.records[0] ? String(res.records[0].Id) : null;
  }

  /** Find the WaveLink DebugLevel id, creating it if needed (tolerant of a concurrent create). */
  async function ensureDebugLevel(): Promise<string> {
    const find = async (): Promise<string | undefined> => {
      const r = await sf.apiCall('GET', `/tooling/query?q=${encodeURIComponent("SELECT Id FROM DebugLevel WHERE DeveloperName = 'WaveLink' LIMIT 1")}`, undefined, false, tabId);
      return (r.body as { records?: { Id: string }[] })?.records?.[0]?.Id;
    };
    const found = await find();
    if (found) return found;
    const created = await sf.apiCall('POST', '/tooling/sobjects/DebugLevel', {
      DeveloperName: 'WaveLink', MasterLabel: 'WaveLink',
      ApexCode: 'DEBUG', ApexProfiling: 'INFO', Callout: 'INFO', Database: 'INFO',
      System: 'DEBUG', Validation: 'INFO', Visualforce: 'INFO', Workflow: 'INFO', Nba: 'NONE',
    }, false, tabId);
    const id = (created.body as { id?: string })?.id;
    if (id) return id;
    // A concurrent run may have created it (duplicate DeveloperName) — re-query.
    const again = await find();
    if (again) return again;
    throw new Error('Could not create a DebugLevel.');
  }

  /** Ensure an active TraceFlag exists for the user so a debug log is generated. */
  async function ensureTraceFlag(userId: string): Promise<void> {
    // If an active DEVELOPER_LOG trace flag already covers the user, nothing to do —
    // skip the DebugLevel work entirely (avoids a needless create race).
    const tfQuery = await sf.apiCall('GET', `/tooling/query?q=${encodeURIComponent(`SELECT Id, ExpirationDate FROM TraceFlag WHERE TracedEntityId = '${userId}' AND LogType = 'DEVELOPER_LOG' ORDER BY ExpirationDate DESC LIMIT 1`)}`, undefined, false, tabId);
    const existing = (tfQuery.body as { records?: { ExpirationDate?: string }[] })?.records?.[0];
    if (existing?.ExpirationDate && new Date(existing.ExpirationDate).getTime() > Date.now() + 60_000) return;

    const debugLevelId = await ensureDebugLevel();
    // StartDate defaults to "now" when omitted; setting it in the past is rejected
    // by Salesforce (FIELD_INTEGRITY_EXCEPTION), so we only set ExpirationDate.
    const expire = new Date(Date.now() + 30 * 60_000).toISOString();
    const tf = await sf.apiCall('POST', '/tooling/sobjects/TraceFlag', {
      TracedEntityId: userId, DebugLevelId: debugLevelId, LogType: 'DEVELOPER_LOG',
      ExpirationDate: expire,
    }, false, tabId);
    // A pre-existing overlapping flag is fine — it will still produce a log.
    if (!tf.ok && !isAlreadyTracedError(tf.body)) {
      throw new Error(`TraceFlag could not be set (${tf.status}).`);
    }
  }

  /**
   * Fetch the debug log for this run: only logs at/after `sinceIso`, polling
   * briefly because ApexLog rows are written asynchronously after execution.
   */
  async function fetchLatestLog(userId: string, sinceIso: string): Promise<string | null> {
    const soql = `SELECT Id FROM ApexLog WHERE LogUserId = '${userId}' AND StartTime >= ${sinceIso} ORDER BY StartTime DESC LIMIT 1`;
    let logId: string | undefined;
    for (let attempt = 0; attempt < 4 && !logId; attempt++) {
      if (attempt > 0) await new Promise<void>((r) => setTimeout(r, 600));
      const q = await sf.apiCall('GET', `/tooling/query?q=${encodeURIComponent(soql)}`, undefined, false, tabId);
      logId = (q.body as { records?: { Id: string }[] })?.records?.[0]?.Id;
    }
    if (!logId) return null;
    const bodyRes = await sf.apiCall('GET', `/tooling/sobjects/ApexLog/${logId}/Body`, undefined, true, tabId);
    return typeof bodyRes.body === 'string' ? bodyRes.body : null;
  }

  async function run(): Promise<void> {
    if (!body.trim()) return;
    setRunning(true);
    setResult(null);
    setLog(null);
    setLogNote(null);
    try {
      let userId: string | null = null;
      let traceReady = false;
      if (captureLog) {
        try {
          userId = await currentUserId();
          if (userId) {
            await ensureTraceFlag(userId);
            traceReady = true;
          } else {
            setLogNote('Could not resolve the current user, so no trace flag was set.');
          }
        } catch (e) {
          setLogNote(`Log capture setup failed: ${e instanceof Error ? e.message : 'unknown error'}. Apex still ran.`);
        }
      }

      // Capture the run-start (with a small grace window for clock skew) so the
      // log fetch only matches a log produced by this execution.
      const sinceIso = new Date(Date.now() - 5_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const res = await sf.executeAnonymous(body, tabId);
      setResult(res);

      // Only a compiled run produces a log; compile failures never do.
      if (captureLog && userId && traceReady && res.compiled) {
        try {
          const logBody = await fetchLatestLog(userId, sinceIso);
          if (logBody) setLog(logBody);
          else setLogNote('No debug log was found for this execution yet — it may still be processing.');
        } catch (e) {
          setLogNote(`Could not fetch the debug log: ${e instanceof Error ? e.message : 'unknown error'}.`);
        }
      }
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

      <div class="wl-row" style="margin-top:10px;align-items:center;gap:14px;flex-wrap:wrap">
        <button class="wl-buttonBrand" disabled={running || !body.trim()} onClick={run}>
          {running ? 'Running…' : 'Run'}
        </button>
        <label class="wl-row" style="gap:6px;align-items:center;cursor:pointer;font-size:13px">
          <input type="checkbox" checked={captureLog} onChange={(e) => setCaptureLog((e.currentTarget as HTMLInputElement).checked)} />
          Capture debug log
        </label>
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

          {ok && !captureLog ? (
            <div class="wl-muted" style="margin-top:10px;font-size:12px">
              Code compiled and executed successfully. Enable "Capture debug log" to retrieve the System.debug output.
            </div>
          ) : null}
        </div>
      ) : null}

      {logNote ? <div class="wl-muted" style="margin-top:10px;font-size:12px">{logNote}</div> : null}

      {log ? (
        <div style="margin-top:12px">
          <div class="wl-row" style="align-items:center;gap:8px">
            <div style="font-weight:900">Debug log</div>
            <button
              class="wl-btn"
              style="padding:2px 10px;font-size:11px;margin-left:auto"
              onClick={async () => { if (await copyToClipboard(log)) setToast({ title: 'Copied', body: 'Debug log copied' }); }}
            >Copy log</button>
          </div>
          <pre class="wl-mono" style="white-space:pre-wrap;font-size:11px;margin:8px 0 0;max-height:420px;overflow:auto;background:var(--wl-surface-2,rgba(0,0,0,0.04));padding:10px;border-radius:8px">{log}</pre>
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
