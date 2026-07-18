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
});
