import { registerXchatTools } from '../src/webmcp/tools';

// WebMCP tool surface — runs in the MAIN world (the page's own JS context), unlike
// dm.content.ts (isolated world). WebMCP consumers (the MCP-B bridge extension, native
// browser agents) look for `document.modelContext` in the page context, so registration
// has to happen here; the DOM is shared between worlds, so the tools drive the same
// selectors/actions the keyboard layer uses. Injected on ALL of x.com so tools survive
// SPA navigation; each tool reports cleanly when the DM UI isn't present.
export default defineContentScript({
  matches: ['*://x.com/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    registerXchatTools();
  },
});
