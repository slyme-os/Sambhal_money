// Identifiers. Seed data uses deterministic UUIDs so the browser demo, the SQL seed
// file and the tests agree on every id; runtime rows use random v4 UUIDs.

/** FNV-1a 32-bit hash. */
export function hash32(input: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatUuid(hex: string): string {
  const chars = hex.split("");
  chars[12] = "4"; // version 4 layout
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16); // RFC 4122 variant
  const h = chars.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Deterministic UUID for a seed key. */
export function seedUuid(key: string): string {
  const hex = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
    .map((salt) => hash32(key, salt).toString(16).padStart(8, "0"))
    .join("");
  return formatUuid(hex);
}

/** Random v4 UUID. Falls back when crypto.randomUUID is unavailable (plain-http LAN testing). */
export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return formatUuid(Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""));
}
