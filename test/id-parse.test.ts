import { describe, it, expect } from 'vitest';
import {
  convIdFromItemTestid,
  convIdFromPath,
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

  it('extracts conversation id from message-request item testid', () => {
    expect(convIdFromItemTestid('dm-message-request-item-12345678:87654321')).toBe(
      '12345678:87654321',
    );
    expect(convIdFromItemTestid('dm-message-request-item-')).toBeNull();
  });

  it('returns null for non-item testids', () => {
    expect(convIdFromItemTestid('dm-conversation-panel')).toBeNull();
    expect(convIdFromItemTestid(null)).toBeNull();
    expect(convIdFromItemTestid('dm-conversation-item-')).toBeNull();
    expect(convIdFromItemTestid('dm-message-requests-tabs')).toBeNull();
  });

  it('translates colon/dash forms', () => {
    expect(toColon('12345678-87654321')).toBe('12345678:87654321');
    expect(toDash('12345678:87654321')).toBe('12345678-87654321');
    expect(routeFor('12345678:87654321')).toBe('/i/chat/12345678-87654321');
    expect(routeFor('12345678:87654321', true)).toBe('/i/chat/requests/12345678-87654321');
  });

  it('parses conversation ids out of chat routes', () => {
    expect(convIdFromPath('/i/chat/12345678-87654321')).toBe('12345678:87654321');
    expect(convIdFromPath('/i/chat/55555555')).toBe('55555555');
    expect(convIdFromPath('/i/chat/requests/12345678-87654321')).toBe('12345678:87654321');
    expect(convIdFromPath('/i/chat/requests')).toBeNull();
    expect(convIdFromPath('/i/chat/')).toBeNull();
    expect(convIdFromPath('/i/chat/settings')).toBeNull();
    expect(convIdFromPath('/messages')).toBeNull();
  });

  it('parses g-prefixed group ids (routes and testids)', () => {
    expect(convIdFromPath('/i/chat/g2078579589736210656')).toBe('g2078579589736210656');
    expect(convIdFromPath('/i/chat/requests/g2078579589736210656')).toBe('g2078579589736210656');
    expect(convIdFromItemTestid('dm-conversation-item-g2078579589736210656')).toBe(
      'g2078579589736210656',
    );
    expect(routeFor('g2078579589736210656')).toBe('/i/chat/g2078579589736210656');
  });

  it('extracts message uuid but not from message-text-', () => {
    expect(msgIdFromTestid('message-d8590c25-c2d4-4acb-b832-2d1ddc028f42')).toBe(
      'd8590c25-c2d4-4acb-b832-2d1ddc028f42',
    );
    expect(msgIdFromTestid('message-text-d8590c25-c2d4-4acb')).toBeNull();
  });
});
