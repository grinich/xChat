// Minimal background worker. In this architecture X does all data/network with X's
// servers, so the worker only exists for lifecycle/logging, the toolbar-button shortcut,
// the unread badge, and the OPTIONAL local MCP bridge below (a localhost-only WebSocket
// to a bridge process the user runs themselves — never a connection to X or anywhere
// else). Triage flags are read/written directly from the content script via
// chrome.storage.local.
export default defineBackground(() => {
  console.info('[xchat] background ready');

  const CHAT_URL = 'https://x.com/i/chat';

  // Clicking the toolbar icon always opens X DMs in a NEW tab. (No `default_popup` on the
  // action, so onClicked fires.)
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: CHAT_URL });
  });

  // Unread badge: content scripts on x.com report X's own unread-DM count (see unread.ts). We
  // reflect it on the toolbar icon. Track per tab and show the max, so having several x.com tabs
  // open doesn't fight over the number. When the last x.com tab closes we have no source, so we
  // clear the badge (better than a permanently stale count).
  const unread = new Map<number, { count: number; text: string }>();

  function refreshBadge(): void {
    let best = { count: 0, text: '' };
    for (const v of unread.values()) if (v.count > best.count) best = v;
    chrome.action.setBadgeText({ text: best.text });
    if (best.text) {
      chrome.action.setBadgeBackgroundColor({ color: '#1D9BF0' });
      chrome.action.setBadgeTextColor?.({ color: '#FFFFFF' });
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg?.type !== 'xchat:unread') return;
    const tabId = sender.tab?.id;
    if (tabId == null) return;
    const count = typeof msg.count === 'number' ? msg.count : 0;
    unread.set(tabId, { count, text: count > 0 ? String(msg.text || count) : '' });
    refreshBadge();
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    if (unread.delete(tabId)) refreshBadge();
  });

  // ---------------------------------------------------------------------------
  // Optional local MCP bridge (bridge/ → `xchat-mcp`).
  //
  // We connect OUT to a localhost-only WebSocket served by the bridge process (an MCP
  // stdio server that clients like Claude Code launch). Tool calls flow bridge → here →
  // content-script Port (bridge-relay.ts) → MAIN-world tools (src/webmcp/tools.ts), and
  // results flow back the same way. Runs from the background because x.com's page CSP
  // would block a localhost WebSocket from any content-script world; extension workers
  // are exempt. When no bridge is running, connection attempts fail quietly with backoff
  // (and only happen while an x.com tab is open at all).
  //
  // MV3 lifetime: the bridge pings every 20s over the socket, which counts as activity
  // and keeps this worker alive while connected. Without a bridge the worker sleeps
  // normally; the content script's Port reconnect wakes it to try again.

  const BRIDGE_URL = 'ws://127.0.0.1:9553';
  const relays = new Map<number, chrome.runtime.Port>(); // tabId → relay port
  const toolsByTab = new Map<number, unknown[]>();
  let activeTab: number | null = null; // most recent tab to announce tools
  let sock: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let backoff = 1000;

  function wsSend(msg: unknown): void {
    if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
  }

  function announceTools(): void {
    wsSend({ type: 'tools', tools: (activeTab != null ? toolsByTab.get(activeTab) : null) ?? [] });
  }

  function scheduleRetry(): void {
    if (relays.size === 0 || retryTimer != null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      ensureSocket();
    }, backoff);
    backoff = Math.min(backoff * 2, 20_000);
  }

  function ensureSocket(): void {
    if (relays.size === 0) return; // no x.com tab — nothing to bridge
    if (sock && (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING)) return;
    try {
      sock = new WebSocket(BRIDGE_URL);
    } catch {
      scheduleRetry();
      return;
    }
    sock.onopen = () => {
      backoff = 1000;
      console.info('[xchat] connected to local MCP bridge');
      announceTools();
    };
    sock.onmessage = (e) => {
      let msg: { type?: string; id?: number; name?: string; args?: unknown };
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (msg.type === 'ping') {
        wsSend({ type: 'pong' });
      } else if (msg.type === 'call') {
        const relay = activeTab != null ? relays.get(activeTab) : undefined;
        if (!relay) {
          wsSend({
            type: 'result',
            id: msg.id,
            result: { content: [{ type: 'text', text: 'No x.com tab connected.' }], isError: true },
          });
        } else {
          relay.postMessage({ type: 'call', id: msg.id, name: msg.name, args: msg.args });
        }
      }
    };
    sock.onclose = () => {
      sock = null;
      scheduleRetry();
    };
    sock.onerror = () => {
      // onclose follows and handles the retry.
    };
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'xchat-bridge') return;
    const tabId = port.sender?.tab?.id;
    if (tabId == null) return;
    relays.set(tabId, port);
    if (activeTab == null) activeTab = tabId;
    port.onMessage.addListener((msg: { type?: string; tools?: unknown[]; id?: number; result?: unknown }) => {
      if (msg?.type === 'tools') {
        toolsByTab.set(tabId, msg.tools ?? []);
        activeTab = tabId; // most recent announcement wins (mirrors "the tab you're using")
        announceTools();
      } else if (msg?.type === 'result') {
        wsSend({ type: 'result', id: msg.id, result: msg.result });
      }
    });
    port.onDisconnect.addListener(() => {
      relays.delete(tabId);
      toolsByTab.delete(tabId);
      if (activeTab === tabId) {
        activeTab = relays.keys().next().value ?? null;
        announceTools();
      }
      if (relays.size === 0) {
        sock?.close();
        sock = null;
      }
    });
    ensureSocket();
  });
});
