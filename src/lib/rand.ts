/** Deterministic pseudo-random in [-1, 1] from a string seed (FNV-1a + xorshift). */
export function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

export function seededInt(seed: string, minInclusive: number, maxInclusive: number): number {
  const u = (seededUnit(seed) + 1) / 2;
  return minInclusive + Math.floor(u * (maxInclusive - minInclusive + 1));
}
