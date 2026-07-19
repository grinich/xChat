// Relay for the OPTIONAL local MCP bridge (bridge/ → `xchat-mcp`).
//
// The WebMCP tools live in the MAIN world (src/webmcp/tools.ts); the background worker
// owns the WebSocket to the local bridge process. This isolated-world module is the hop
// between them: window.postMessage (MAIN ↔ here) and a runtime Port (here ↔ background).
// When the bridge isn't running, this costs one idle Port and nothing else — every other
// xChat feature is unaffected.
//
// Port reconnect matters: MV3 service workers sleep, which disconnects the Port; the
// reconnect both restores the relay and WAKES the worker so it can retry the bridge.

import { attemptComposerSend, type SendAttempt } from './actions';

const PORT_NAME = 'xchat-bridge';

let port: chrome.runtime.Port | null = null;
let lastTools: unknown = null; // re-announced on every reconnect (background state dies with the SW)

// Tool RESULTS must survive a port hiccup: if the service worker restarts while a call
// is in flight, losing the result leaves the bridge waiting out its full 60s timeout
// (seen live after an off-DM send round-trip). Buffer failed posts, flush on reconnect.
const resultOutbox: unknown[] = [];

function postResult(msg: unknown): void {
  if (port) {
    try {
      port.postMessage(msg);
      return;
    } catch {
      // fall through to buffer
    }
  }
  resultOutbox.push(msg);
  if (resultOutbox.length > 20) resultOutbox.shift();
}

function connect(): void {
  try {
    port = chrome.runtime.connect({ name: PORT_NAME });
  } catch {
    port = null; // extension context invalidated (xChat was reloaded) — stand down
    return;
  }
  port.onMessage.addListener((msg: { type?: string; id?: number; name?: string; args?: unknown }) => {
    if (msg?.type === 'call') {
      window.postMessage({ xchat: 'bridge-call', id: msg.id, name: msg.name, args: msg.args }, location.origin);
    }
  });
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(connect, 1000);
  });
  if (lastTools) port.postMessage({ type: 'tools', tools: lastTools });
  while (resultOutbox.length && port) {
    try {
      port.postMessage(resultOutbox[0]);
      resultOutbox.shift();
    } catch {
      break; // port died again; keep the buffer for the next reconnect
    }
  }
}

export function startBridgeRelay(): void {
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as { xchat?: string; tools?: unknown; id?: number; result?: unknown; how?: string };
    try {
      if (d?.xchat === 'bridge-tools') {
        lastTools = d.tools;
        port?.postMessage({ type: 'tools', tools: d.tools });
      } else if (d?.xchat === 'bridge-result') {
        postResult({ type: 'result', id: d.id, result: d.result });
      } else if (d?.xchat === 'iso-send' && typeof d.id === 'number') {
        // Isolated-world send fallback: some X controls only react to events from this
        // world, not the MAIN world where the tools live. Same DOM, different dispatcher.
        const attempted = attemptComposerSend(d.how as SendAttempt);
        window.postMessage({ xchat: 'iso-send-result', id: d.id, attempted }, location.origin);
      }
    } catch {
      // Port died between the check and the post; the reconnect loop recovers.
    }
  });
  connect();
  // If the MAIN-world script registered before we attached (load-order race), ask it to
  // re-announce its tools.
  window.postMessage({ xchat: 'bridge-hello' }, location.origin);
}
