// Conversation-id helpers.
//
// X's DM DOM tags each inbox row with `data-testid="dm-conversation-item-<A>:<B>"`
// and each message-requests row with `data-testid="dm-message-request-item-<A>:<B>"`
// (colon form, e.g. "12345678:87654321"). The SPA route for a thread uses the dash
// form: `/i/chat/<A>-<B>` for inbox threads, `/i/chat/requests/<A>-<B>` for request
// threads. For 1:1 chats A/B are the two user ids; for group DMs the id is a single
// number. We treat the id as an opaque token and only translate the separator between
// the two representations.

const ITEM_PREFIX = 'dm-conversation-item-';
const REQUEST_ITEM_PREFIX = 'dm-message-request-item-';
const MSG_PREFIX = 'message-';
const MSG_TEXT_PREFIX = 'message-text-';

/** Pull the conversation id (colon form) out of a `dm-conversation-item-*` or
 *  `dm-message-request-item-*` testid. */
export function convIdFromItemTestid(testid: string | null | undefined): string | null {
  if (!testid) return null;
  const prefix = [ITEM_PREFIX, REQUEST_ITEM_PREFIX].find((p) => testid.startsWith(p));
  if (!prefix) return null;
  const id = testid.slice(prefix.length);
  return id.length ? id : null;
}

/** Colon form ("A:B") used in testids and as our canonical key. */
export function toColon(id: string): string {
  return id.replace(/-/g, ':');
}

/** Dash form ("A-B") used in the `/i/chat/<id>` route. */
export function toDash(id: string): string {
  return id.replace(/:/g, '-');
}

/** SPA route for a conversation (request threads live under `/i/chat/requests/`). */
export function routeFor(id: string, requests = false): string {
  return `${requests ? '/i/chat/requests/' : '/i/chat/'}${toDash(id)}`;
}

/** Conversation id (colon form) from an `/i/chat/...` pathname, or null. Handles both
 *  `/i/chat/<id>` and `/i/chat/requests/<id>`, and rejects non-id segments so bare views
 *  like `/i/chat/requests` or `/i/chat/settings` don't parse as a conversation. */
export function convIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/i\/chat\/(?:requests\/)?(\d+(?:-\d+)?)(?:[/?#]|$)/);
  return m ? toColon(m[1]) : null;
}

/** Message uuid from a `message-<uuid>` testid (not `message-text-`). */
export function msgIdFromTestid(testid: string | null | undefined): string | null {
  if (!testid) return null;
  if (testid.startsWith(MSG_TEXT_PREFIX)) return null;
  if (!testid.startsWith(MSG_PREFIX)) return null;
  const id = testid.slice(MSG_PREFIX.length);
  return id.length ? id : null;
}

export { ITEM_PREFIX, MSG_PREFIX, MSG_TEXT_PREFIX };
