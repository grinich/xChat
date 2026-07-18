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
  { id: 'reply', title: 'Reply (focus composer)', hint: 'r', run: () => requestComposerFocus(), inPalette: true },
  { id: 'search', title: 'Search', hint: '/', run: () => actions.focusSearch(), inPalette: true },
  { id: 'inbox', title: 'Inbox filter', hint: '1', run: () => actions.openInboxFilter(), inPalette: true },
  { id: 'requests', title: 'Message requests', hint: '2', run: () => actions.openRequests(), inPalette: true },
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
