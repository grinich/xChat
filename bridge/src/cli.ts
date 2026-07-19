#!/usr/bin/env node
// xchat-mcp — local MCP bridge for the xChat browser extension.
//
// Two faces:
//   • MCP server over STDIO — what `claude mcp add xchat -- npx xchat-mcp` runs.
//   • WebSocket server on 127.0.0.1 — the xChat extension's background worker connects
//     OUT to it and announces the WebMCP tools registered on the active x.com tab.
//
// Tool calls are proxied verbatim: MCP tools/call → WS {type:'call'} → extension →
// page DOM → WS {type:'result'} → MCP result. The bridge holds no X credentials and
// never talks to X — the browser does everything, exactly as if the user did it.
//
// Wire protocol (JSON text frames):
//   ext → bridge: {type:'tools', tools:[{name,description,inputSchema,annotations?}]}
//                 {type:'result', id, result:<MCP CallToolResult>}
//                 {type:'pong'}
//   bridge → ext: {type:'call', id, name, args}
//                 {type:'ping'}   (every 20s; keeps the MV3 service worker alive)
//
// IMPORTANT: stdout belongs to the MCP protocol — all logging goes to stderr.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer, WebSocket, type RawData } from 'ws';

interface BridgeTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

type CallToolResult = { content: Array<{ type: string; text?: string }>; isError?: boolean };

const CALL_TIMEOUT_MS = 60_000;
const PING_INTERVAL_MS = 20_000;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const PORT = Number(argValue('--port') ?? process.env.XCHAT_MCP_PORT ?? 9553);

const log = (...args: unknown[]) => console.error('[xchat-mcp]', ...args);

// ---------------------------------------------------------------------------
// WebSocket side (extension)

let ext: WebSocket | null = null; // latest connected extension wins
let pageTools: BridgeTool[] = [];
let nextCallId = 1;
const pending = new Map<number, { resolve: (r: CallToolResult) => void; timer: NodeJS.Timeout }>();

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: 'text', text }], isError };
}

function settle(id: number, result: CallToolResult): void {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  clearTimeout(p.timer);
  p.resolve(result);
}

function callExtension(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  if (!ext || ext.readyState !== WebSocket.OPEN) {
    return Promise.resolve(
      textResult('xChat extension not connected. Is Chrome running with xChat installed and an x.com tab open?', true),
    );
  }
  const id = nextCallId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      settle(id, textResult(`Tool call timed out after ${CALL_TIMEOUT_MS / 1000}s: ${name}`, true));
    }, CALL_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    ext!.send(JSON.stringify({ type: 'call', id, name, args }));
  });
}

// Only the xChat extension may connect. Browsers stamp WebSocket upgrades from an
// extension's service worker with `Origin: chrome-extension://<id>`, and xChat's id is
// pinned via the `key` in wxt.config.ts (identical for store installs and unpacked dev
// builds) — so an exact origin check shuts out every other local process that could
// otherwise read/send DMs by impersonating the extension. Forks with a different id can
// pass --allow-origin chrome-extension://<their-id> (or XCHAT_MCP_ALLOW_ORIGIN).
const XCHAT_EXTENSION_ORIGIN = 'chrome-extension://ibabhioecolanneglccnolncaaanonll';
const allowedOrigins = new Set([
  XCHAT_EXTENSION_ORIGIN,
  ...(argValue('--allow-origin') ?? process.env.XCHAT_MCP_ALLOW_ORIGIN ?? '').split(',').filter(Boolean),
]);

const wss = new WebSocketServer({
  host: '127.0.0.1',
  port: PORT,
  verifyClient: ({ origin }: { origin?: string }) => {
    if (origin && allowedOrigins.has(origin)) return true;
    log(`rejected connection from origin ${origin || '(none)'} — only the xChat extension may connect (--allow-origin to override)`);
    return false;
  },
});

wss.on('listening', () => log(`listening for the xChat extension on ws://127.0.0.1:${PORT}`));
wss.on('error', (err: Error & { code?: string }) => {
  if (err.code === 'EADDRINUSE') {
    log(`port ${PORT} is already in use — is another xchat-mcp running? (--port N to change)`);
    process.exit(1);
  }
  log('websocket server error:', err.message);
});

wss.on('connection', (sock) => {
  log('extension connected');
  ext = sock;
  sock.on('message', (raw: RawData) => {
    let msg: { type?: string; id?: number; tools?: BridgeTool[]; result?: CallToolResult };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'tools') {
      pageTools = msg.tools ?? [];
      log(`tools announced: ${pageTools.length}`);
      notifyToolsChanged();
    } else if (msg.type === 'result' && typeof msg.id === 'number') {
      settle(msg.id, msg.result ?? textResult('Extension returned an empty result.', true));
    }
    // 'pong' needs no handling — receiving it was the point.
  });
  sock.on('close', () => {
    if (ext !== sock) return; // superseded by a newer connection
    ext = null;
    pageTools = [];
    log('extension disconnected');
    notifyToolsChanged();
    for (const id of Array.from(pending.keys())) {
      settle(id, textResult('Extension disconnected mid-call.', true));
    }
  });
});

// JSON ping (not a WS protocol ping — those are answered natively and would NOT count
// as service-worker activity in Chrome, letting the worker sleep and drop the socket).
setInterval(() => {
  if (ext?.readyState === WebSocket.OPEN) ext.send(JSON.stringify({ type: 'ping' }));
}, PING_INTERVAL_MS);

// ---------------------------------------------------------------------------
// MCP side (stdio)

// Always-available bridge-side status tool, so the server is never empty and the agent
// can self-diagnose the "browser not connected" case.
const STATUS_TOOL: BridgeTool = {
  name: 'xchat_bridge_status',
  description:
    'Status of the local xChat bridge: whether the xChat browser extension is connected and how many X DM tools are live. If none, open an x.com tab in Chrome with the xChat extension installed.',
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true },
};

const server = new Server({ name: 'xchat', version: '0.1.0' }, { capabilities: { tools: { listChanged: true } } });

function notifyToolsChanged(): void {
  server.sendToolListChanged().catch(() => {
    // Not connected/initialized yet — the client will list tools itself when it is.
  });
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [STATUS_TOOL, ...pageTools] }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === STATUS_TOOL.name) {
    return textResult(
      JSON.stringify(
        { extensionConnected: ext?.readyState === WebSocket.OPEN, liveTools: pageTools.map((t) => t.name), port: PORT },
        null,
        2,
      ),
    );
  }
  return callExtension(name, (args as Record<string, unknown>) ?? {});
});

await server.connect(new StdioServerTransport());
log('MCP server ready on stdio');
