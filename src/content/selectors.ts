// SINGLE SOURCE OF TRUTH for every X DOM hook tchat depends on.
// If X changes its DM markup, this is the (usually one-line) place to fix it.
// Everything is anchored to data-testid / role — never hashed class names.

export const SEL = {
  // Layout / shell
  banner: 'header[role="banner"]',
  main: 'main[role="main"]',
  primaryColumn: '[data-testid="primaryColumn"]',
  sidebarColumn: '[data-testid="sidebarColumn"]',

  // DM containers
  dmContainer: '[data-testid="dm-container"]',
  inboxPanel: '[data-testid="dm-inbox-panel"]',
  conversationPanel: '[data-testid="dm-conversation-panel"]',
  conversationContent: '[data-testid="dm-conversation-content"]',
  conversationHeader: '[data-testid="dm-conversation-header"]',
  conversationUsername: '[data-testid="dm-conversation-username"]',
  conversationMoreButton: '[data-testid="dm-conversation-more-button"]',

  // Inbox chrome
  inboxTitle: '[data-testid="dm-inbox-title"]',
  inboxDropdownTrigger: '[data-testid="dm-inbox-dropdown-trigger"]',
  requestsButton: '[data-testid="dm-inbox-requests-button"]',
  newChatButton: '[data-testid="dm-new-chat-button"]',
  searchBar: '[data-testid="dm-search-bar"]',
  listLoadingFooter: '[data-testid="dm-conversation-list-loading-footer"]',

  // Conversation rows (prefix match; each carries its id)
  conversationItemPrefix: 'dm-conversation-item-',
  conversationItems: '[data-testid^="dm-conversation-item-"]',

  // Messages (prefix match)
  messageList: '[data-testid="dm-message-list"]',
  messageListContainer: '[data-testid="dm-message-list-container"]',
  messageBubbles: '[data-testid^="message-"]:not([data-testid^="message-text-"])',
  messageTexts: '[data-testid^="message-text-"]',

  // Composer
  composerTextarea: '[data-testid="dm-composer-textarea"]',
  composerForm: '[data-testid="dm-composer-form"]',
  composerInputContainer: '[data-testid="dm-composer-input-container"]',
  composerAttachment: '[data-testid="dm-composer-attachment-button"]',
} as const;

/** Are we currently on a DM route? (Used to gate activation + the keyboard layer.) */
export function isDmRoute(): boolean {
  return /\/(messages|i\/chat)/.test(location.pathname);
}

/** The testids we expect to exist on a healthy DM page (for the boot self-check). */
export const REQUIRED_TESTIDS = [
  SEL.dmContainer,
  SEL.inboxPanel,
  SEL.conversationItems,
] as const;

export function $(sel: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(sel);
}

export function $all(sel: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll(sel));
}

/** Rendered conversation rows, in DOM (visual) order. */
export function conversationRows(): HTMLElement[] {
  return $all(SEL.conversationItems);
}

/** Is the DM UI present on the page right now? */
export function dmPresent(): boolean {
  return !!$(SEL.dmContainer);
}
