import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from "node:crypto";

// OWASP's 32 MiB scrypt setting (N=2^15, r=8, p=3), equivalent in strength to
// its 128 MiB one: the 954 MB server cannot spare 128 MiB per login.
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 3;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

// Bounds on parameters read back from a stored hash, so a corrupted value
// cannot make a single login allocate unbounded memory or CPU.
const MAX_COST = 2 ** 17;
const MAX_BLOCK_SIZE = 32;
const MAX_PARALLELISM = 16;

type ScryptParameters = { cost: number; blockSize: number; parallelism: number };
type StoredHash = ScryptParameters & { salt: Buffer; key: Buffer };

/** Hashes a new password as `scrypt$N$r$p$<salt base64>$<key base64>`. */
export async function hashPassword(password: string): Promise<string> {
  const parameters = { cost: COST, blockSize: BLOCK_SIZE, parallelism: PARALLELISM };
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, KEY_BYTES, parameters);
  return formatHash({ ...parameters, salt, key });
}

/**
 * Checks a password against a stored hash, using the parameters in the hash.
 * A malformed stored value is a non-match, never an exception.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const stored = parseHash(storedHash);
  if (!stored) return false;
  const key = await deriveKey(password, stored.salt, stored.key.length, stored);
  return timingSafeEqual(key, stored.key);
}

// A well-formed hash with the current parameters that no password matches.
const DUMMY_HASH = formatHash({
  cost: COST,
  blockSize: BLOCK_SIZE,
  parallelism: PARALLELISM,
  salt: Buffer.alloc(SALT_BYTES),
  key: Buffer.alloc(KEY_BYTES),
});

/**
 * Does the same work as verifying a real password, for a login whose email has
 * no account - so response time does not reveal which emails exist.
 */
export async function verifyAgainstDummyHash(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_HASH);
}

function formatHash({ cost, blockSize, parallelism, salt, key }: StoredHash): string {
  return [
    "scrypt",
    cost,
    blockSize,
    parallelism,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

function parseHash(value: string): StoredHash | null {
  const parts = value.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [cost, blockSize, parallelism] = parts.slice(1, 4).map(parseWholeNumber);
  const isPowerOfTwo = (cost & (cost - 1)) === 0;
  if (!(cost > 1 && cost <= MAX_COST && isPowerOfTwo)) return null;
  if (!(blockSize >= 1 && blockSize <= MAX_BLOCK_SIZE)) return null;
  if (!(parallelism >= 1 && parallelism <= MAX_PARALLELISM)) return null;

  const salt = decodeBase64(parts[4]);
  const key = decodeBase64(parts[5]);
  if (!salt || !key || key.length < 16 || key.length > 64) return null;

  return { cost, blockSize, parallelism, salt, key };
}

function parseWholeNumber(text: string): number {
  return /^[0-9]{1,7}$/.test(text) ? Number(text) : Number.NaN;
}

function decodeBase64(text: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  const bytes = Buffer.from(text, "base64");
  return bytes.length > 0 ? bytes : null;
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  { cost, blockSize, parallelism }: ScryptParameters,
): Promise<Buffer> {
  const options: ScryptOptions = {
    N: cost,
    r: blockSize,
    p: parallelism,
    // Node rejects scrypt above ~128 * N * r bytes unless maxmem allows it.
    maxmem: 256 * cost * blockSize,
  };
  // NFC so the same password typed as composed or decomposed characters
  // (e.g. "é" from different keyboards) produces the same hash.
  const normalized = password.normalize("NFC");
  return new Promise((resolve, reject) => {
    scrypt(normalized, salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}
