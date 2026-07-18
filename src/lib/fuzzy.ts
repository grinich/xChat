// Tiny subsequence fuzzy matcher for the quick-switcher.
// Scores higher for contiguous runs, word-boundary starts, and earlier matches.

export interface FuzzyResult<T> {
  item: T;
  score: number;
  /** Indices in the target string that matched, for optional highlighting. */
  matches: number[];
}

/** Returns a score >= 0 (0 = no match) plus matched indices. */
export function fuzzyScore(query: string, target: string): { score: number; matches: number[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 1, matches: [] };
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let run = 0;
  let prevMatchIdx = -2;
  const matches: number[] = [];

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      run = 0;
      continue;
    }
    matches.push(ti);
    // Base point per matched char.
    let pts = 1;
    // Contiguous run bonus.
    if (prevMatchIdx === ti - 1) {
      run += 1;
      pts += run * 2;
    } else {
      run = 0;
    }
    // Word-boundary bonus (start of string, or after space/@/_/-).
    const prev = ti > 0 ? t[ti - 1] : '';
    if (ti === 0 || prev === ' ' || prev === '@' || prev === '_' || prev === '-' || prev === '.') {
      pts += 3;
    }
    // Earliness bonus.
    pts += Math.max(0, 2 - ti * 0.02);
    score += pts;
    prevMatchIdx = ti;
    qi += 1;
  }

  if (qi < q.length) return { score: 0, matches: [] };
  return { score, matches };
}

/** Rank items by fuzzy match against a derived key; drops non-matches. */
export function fuzzyRank<T>(
  query: string,
  items: T[],
  key: (item: T) => string,
): FuzzyResult<T>[] {
  const out: FuzzyResult<T>[] = [];
  for (const item of items) {
    const { score, matches } = fuzzyScore(query, key(item));
    if (score > 0) out.push({ item, score, matches });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
