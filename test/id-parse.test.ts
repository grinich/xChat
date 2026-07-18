import { describe, it, expect } from 'vitest';
import {
  convIdFromItemTestid,
  toColon,
  toDash,
  routeFor,
  msgIdFromTestid,
} from '@/lib/id-parse';

describe('id-parse', () => {
  it('extracts conversation id from item testid', () => {
    expect(convIdFromItemTestid('dm-conversation-item-12345678:87654321')).toBe('12345678:87654321');
    expect(convIdFromItemTestid('dm-conversation-item-55555555')).toBe('55555555');
  });

  it('returns null for non-item testids', () => {
    expect(convIdFromItemTestid('dm-conversation-panel')).toBeNull();
    expect(convIdFromItemTestid(null)).toBeNull();
    expect(convIdFromItemTestid('dm-conversation-item-')).toBeNull();
  });

  it('translates colon/dash forms', () => {
    expect(toColon('12345678-87654321')).toBe('12345678:87654321');
    expect(toDash('12345678:87654321')).toBe('12345678-87654321');
    expect(routeFor('12345678:87654321')).toBe('/i/chat/12345678-87654321');
  });

  it('extracts message uuid but not from message-text-', () => {
    expect(msgIdFromTestid('message-d8590c25-c2d4-4acb-b832-2d1ddc028f42')).toBe(
      'd8590c25-c2d4-4acb-b832-2d1ddc028f42',
    );
    expect(msgIdFromTestid('message-text-d8590c25-c2d4-4acb')).toBeNull();
  });
});
