import { describe, it, expect } from 'vitest';
import { fuzzyScore, fuzzyRank } from '@/lib/fuzzy';

describe('fuzzy', () => {
  it('scores subsequence matches and rejects non-matches', () => {
    expect(fuzzyScore('sg', 'stephanie grant').score).toBeGreaterThan(0);
    expect(fuzzyScore('xyz', 'stephanie grant').score).toBe(0);
  });

  it('prefers contiguous and word-boundary matches', () => {
    const contig = fuzzyScore('steph', 'stephanie grant').score;
    const scattered = fuzzyScore('saie', 'stephanie grant').score;
    expect(contig).toBeGreaterThan(scattered);
  });

  it('ranks best match first and drops non-matches', () => {
    const items = ['Jordan Lee', 'Stephanie Grant', 'Alex Kim'];
    const ranked = fuzzyRank('steph', items, (x) => x);
    expect(ranked[0].item).toBe('Stephanie Grant');
    expect(ranked.find((r) => r.item === 'Jordan Lee')).toBeUndefined();
  });

  it('empty query keeps everything', () => {
    expect(fuzzyScore('', 'anything').score).toBeGreaterThan(0);
  });
});
