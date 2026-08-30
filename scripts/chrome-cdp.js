/** Minimal Chrome DevTools Protocol helper for release validation. */
const http = require('node:http');
const fs = require('node:fs');
const WebSocket = require('ws');

const port = Number(process.env.WL_CDP_PORT || 9333);
const urlIncludes = process.env.WL_CDP_URL_INCLUDES || '';
const targetType = process.env.WL_CDP_TARGET_TYPE || 'page';
const expression = process.env.WL_CDP_EXPRESSION;
const listContexts = process.env.WL_CDP_LIST_CONTEXTS === '1';
const downloadPath = process.env.WL_CDP_DOWNLOAD_PATH;
const cdpMethod = process.env.WL_CDP_METHOD;
const cdpParams = process.env.WL_CDP_PARAMS ? JSON.parse(process.env.WL_CDP_PARAMS) : {};
const fileInputPath = process.env.WL_CDP_FILE_INPUT;
const fileInputSelector = process.env.WL_CDP_FILE_SELECTOR || 'input[type=file]';
const contextId = process.env.WL_CDP_CONTEXT_ID ? Number(process.env.WL_CDP_CONTEXT_ID) : undefined;
const screenshotPath = process.env.WL_CDP_SCREENSHOT_PATH;

if (!expression && !listContexts && !downloadPath && !cdpMethod && !fileInputPath && !screenshotPath) throw new Error('WL_CDP_EXPRESSION is required.');

function readJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const target = downloadPath
    ? await readJson('/json/version')
    : (await readJson('/json/list')).find(candidate => (
      candidate.type === targetType && candidate.url.includes(urlIncludes)
    ));
  if (!target) throw new Error(`No ${targetType} target contains ${urlIncludes}.`);

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  if (fileInputPath) {
    let id = 0;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const onMessage = data => {
        const message = JSON.parse(String(data));
        if (message.id !== requestId) return;
        socket.off('message', onMessage);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      socket.on('message', onMessage);
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    const documentResult = await send('DOM.getDocument');
    const nodeResult = await send('DOM.querySelector', {
      nodeId: documentResult.root.nodeId,
      selector: fileInputSelector,
    });
    if (!nodeResult.nodeId) throw new Error(`File input not found: ${fileInputSelector}`);
    await send('DOM.setFileInputFiles', { nodeId: nodeResult.nodeId, files: [fileInputPath] });
    socket.close();
    process.stdout.write(`${JSON.stringify({ configured: true })}\n`);
    return;
  }
  if (screenshotPath) {
    let id = 0;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const onMessage = data => {
        const message = JSON.parse(String(data));
        if (message.id !== requestId) return;
        socket.off('message', onMessage);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      socket.on('message', onMessage);
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const result = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    fs.writeFileSync(screenshotPath, Buffer.from(result.data, 'base64'));
    socket.close();
    process.stdout.write(`${JSON.stringify({ captured: true, path: screenshotPath })}\n`);
    return;
  }
  if (cdpMethod) {
    const result = await new Promise((resolve, reject) => {
      socket.on('message', data => {
        const message = JSON.parse(String(data));
        if (message.id !== 1) return;
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      socket.send(JSON.stringify({ id: 1, method: cdpMethod, params: cdpParams }));
    });
    socket.close();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (downloadPath) {
    const result = await new Promise((resolve, reject) => {
      socket.on('message', data => {
        const message = JSON.parse(String(data));
        if (message.id !== 1) return;
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      socket.send(JSON.stringify({
        id: 1,
        method: 'Browser.setDownloadBehavior',
        params: { behavior: 'allow', downloadPath },
      }));
    });
    socket.close();
    process.stdout.write(`${JSON.stringify({ configured: true, result })}\n`);
    return;
  }
  if (listContexts) {
    const contexts = [];
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 750);
      socket.on('message', data => {
        const message = JSON.parse(String(data));
        if (message.method === 'Runtime.executionContextCreated') {
          const context = message.params.context;
          contexts.push({
            id: context.id,
            name: context.name,
            origin: context.origin,
            type: context.auxData?.type,
            isDefault: context.auxData?.isDefault,
          });
        }
        if (message.id === 1 && message.error) {
          clearTimeout(timer);
          reject(new Error(message.error.message));
        }
      });
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    });
    socket.close();
    process.stdout.write(`${JSON.stringify(contexts)}\n`);
    return;
  }
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP evaluation timed out.')), 15000);
    socket.on('message', data => {
      const message = JSON.parse(String(data));
      if (message.id !== 1) return;
      clearTimeout(timer);
      if (message.error) reject(new Error(message.error.message));
      else if (message.result?.exceptionDetails) {
        reject(new Error(
          message.result.exceptionDetails.exception?.description
          || message.result.exceptionDetails.text
          || 'CDP evaluation failed.',
        ));
      }
      else resolve(message.result);
    });
    socket.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true, ...(contextId ? { contextId } : {}) },
    }));
  });
  socket.close();
  const value = result?.result?.value;
  process.stdout.write(`${JSON.stringify(value)}\n`);
})().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
