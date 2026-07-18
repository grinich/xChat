// Minimal background worker. In this architecture X does all data/network, so the
// worker only exists for lifecycle/logging and future cross-tab concerns. Triage flags
// are read/written directly from the content script via chrome.storage.local.
export default defineBackground(() => {
  console.info('[tchat] background ready');
});
