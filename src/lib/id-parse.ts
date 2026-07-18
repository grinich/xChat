// Conversation-id helpers.
//
// X's DM DOM tags each inbox row with `data-testid="dm-conversation-item-<A>:<B>"`
// (colon form, e.g. "12345678:87654321"). The SPA route for a thread uses the dash
// form, `/i/chat/<A>-<B>`. For 1:1 chats A/B are the two user ids; for group DMs the
// id is a single number. We treat the id as an opaque token and only translate the
// separator between the two representations.

const ITEM_PREFIX = 'dm-conversation-item-';
const MSG_PREFIX = 'message-';
const MSG_TEXT_PREFIX = 'message-text-';

/** Pull the conversation id (colon form) out of a `dm-conversation-item-*` testid. */
export function convIdFromItemTestid(testid: string | null | undefined): string | null {
  if (!testid || !testid.startsWith(ITEM_PREFIX)) return null;
  const id = testid.slice(ITEM_PREFIX.length);
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

/** SPA route for a conversation. */
export function routeFor(id: string): string {
  return `/i/chat/${toDash(id)}`;
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
