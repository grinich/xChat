// Minimal background worker. In this architecture X does all data/network, so the
// worker only exists for lifecycle/logging and the toolbar-button shortcut below.
// Triage flags are read/written directly from the content script via chrome.storage.local.
export default defineBackground(() => {
  console.info('[xchat] background ready');

  const CHAT_URL = 'https://x.com/i/chat';

  // Clicking the toolbar icon jumps straight to X DMs. Reuse an existing x.com tab if one is
  // open (navigate it + focus its window) so we don't pile up tabs; otherwise open a new tab.
  // (No `default_popup` on the action, so onClicked fires. Querying x.com tabs is allowed by
  // our host_permissions.)
  chrome.action.onClicked.addListener(async () => {
    try {
      const [existing] = await chrome.tabs.query({ url: 'https://x.com/*' });
      if (existing?.id != null) {
        await chrome.tabs.update(existing.id, { url: CHAT_URL, active: true });
        if (existing.windowId != null) {
          await chrome.windows.update(existing.windowId, { focused: true });
        }
      } else {
        await chrome.tabs.create({ url: CHAT_URL });
      }
    } catch (err) {
      console.warn('[xchat] could not open chat, opening a new tab:', err);
      chrome.tabs.create({ url: CHAT_URL });
    }
  });
});
