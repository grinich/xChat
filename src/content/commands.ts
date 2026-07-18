// Central command registry. Both the keyboard layer and the command palette dispatch
// through these, so there's one definition of what each action does.
//
// Everything here maps to REAL X DM functionality — navigating, opening, replying,
// searching, composing, switching inbox/requests. We deliberately do NOT invent features
// X doesn't have (archive/star/snooze), so nothing here silently no-ops.

import * as actions from './actions';
import * as selection from './selection';
import { openPalette } from './palette';
import { openSwitcher } from './switcher';
import { requestComposerFocus } from './composer-focus';

export interface Command {
  id: string;
  title: string;
  hint?: string;
  run: () => void;
  inPalette?: boolean;
}

export const commands: Command[] = [
  { id: 'open', title: 'Open conversation', hint: 'Enter', run: () => selection.openSelected(), inPalette: false },
  { id: 'next', title: 'Next conversation', hint: 'j', run: () => selection.move(1), inPalette: false },
  { id: 'prev', title: 'Previous conversation', hint: 'k', run: () => selection.move(-1), inPalette: false },
  { id: 'compose', title: 'New chat', hint: 'c', run: () => actions.newChat(), inPalette: true },
  {
    id: 'pin',
    title: 'Pin / unpin conversation',
    hint: 'p',
    run: () => actions.togglePin(selection.getSelectedId() ?? actions.currentConversationId()),
    inPalette: true,
  },
  { id: 'reply', title: 'Reply (focus composer)', hint: 'r', run: () => requestComposerFocus(), inPalette: true },
  { id: 'search', title: 'Search', hint: '/', run: () => actions.focusSearch(), inPalette: true },
  { id: 'filter-all', title: 'Filter: All', run: () => actions.setInboxFilter('all'), inPalette: true },
  { id: 'filter-unread', title: 'Filter: Unread', run: () => actions.setInboxFilter('unread'), inPalette: true },
  { id: 'filter-direct', title: 'Filter: Direct', run: () => actions.setInboxFilter('oneonone'), inPalette: true },
  { id: 'filter-groups', title: 'Filter: Groups', run: () => actions.setInboxFilter('groups'), inPalette: true },
  { id: 'filter-next', title: 'Next inbox filter', hint: 'Tab', run: () => actions.cycleInboxFilter(1), inPalette: false },
  { id: 'filter-prev', title: 'Previous inbox filter', hint: '⇧Tab', run: () => actions.cycleInboxFilter(-1), inPalette: false },
  { id: 'requests', title: 'Message requests', hint: 'Q', run: () => actions.openRequests(), inPalette: true },
  // Contextual (only does anything on an open message request) — keyboard-only, not listed
  // in the palette so the palette never offers a silent no-op.
  { id: 'accept', title: 'Accept message request', hint: 'Enter', run: () => actions.acceptRequest(), inPalette: false },
  { id: 'switcher', title: 'Quick switcher', hint: '⌘J', run: () => openSwitcher(), inPalette: true },
  { id: 'palette', title: 'Command palette', hint: '⌘K', run: () => openPalette(), inPalette: false },
];

const byId = new Map(commands.map((c) => [c.id, c]));

export function run(id: string): void {
  byId.get(id)?.run();
}

export function paletteCommands(): Command[] {
  return commands.filter((c) => c.inPalette !== false);
}
