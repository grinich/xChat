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

const PORT_NAME = 'xchat-bridge';

let port: chrome.runtime.Port | null = null;
let lastTools: unknown = null; // re-announced on every reconnect (background state dies with the SW)

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
}

export function startBridgeRelay(): void {
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as { xchat?: string; tools?: unknown; id?: number; result?: unknown };
    try {
      if (d?.xchat === 'bridge-tools') {
        lastTools = d.tools;
        port?.postMessage({ type: 'tools', tools: d.tools });
      } else if (d?.xchat === 'bridge-result') {
        port?.postMessage({ type: 'result', id: d.id, result: d.result });
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
