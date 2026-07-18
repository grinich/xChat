// Minimal background worker. In this architecture X does all data/network, so the
// worker only exists for lifecycle/logging and the toolbar-button shortcut below.
// Triage flags are read/written directly from the content script via chrome.storage.local.
export default defineBackground(() => {
  console.info('[xchat] background ready');

  const CHAT_URL = 'https://x.com/i/chat';

  // Clicking the toolbar icon always opens X DMs in a NEW tab. (No `default_popup` on the
  // action, so onClicked fires.)
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: CHAT_URL });
  });
});
