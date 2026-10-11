// Tiny SQL literal helpers for the seed generators.
export const q = (v: string | number | null | undefined): string =>
  v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;

export const arr = (v: string[] = []): string => (v.length ? `array[${v.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
