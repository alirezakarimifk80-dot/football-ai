import crypto from 'crypto';

export type AdminAuthMode = 'env' | 'claimed' | 'unclaimed';

interface StoredHash {
  saltHex: string;
  hashHex: string;
}

interface SessionRecord {
  expiresAt: number;
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_SESSIONS = 50;
const MIN_PASSCODE_LENGTH = 6;
const MAX_PASSCODE_LENGTH = 128;

let claimedHash: StoredHash | null = null;
const activeSessions = new Map<string, SessionRecord>();

function getEnvPasscode(): string {
  const raw = (process.env.ADMIN_PASSCODE ?? '').trim();
  if (!raw || raw === 'MY_ADMIN_PASSCODE') return '';
  return raw;
}

function hashPasscode(passcode: string, saltHex?: string): StoredHash {
  const salt = saltHex ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return { saltHex: salt, hashHex: derived };
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [token, rec] of activeSessions.entries()) {
    if (rec.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
  while (activeSessions.size > MAX_SESSIONS) {
    const oldestKey = activeSessions.keys().next().value;
    if (!oldestKey) break;
    activeSessions.delete(oldestKey);
  }
}

function issueSessionToken(): string {
  pruneExpiredSessions();
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function getAdminAuthStatus(): { mode: AdminAuthMode } {
  if (getEnvPasscode()) {
    return { mode: 'env' };
  }
  if (claimedHash) {
    return { mode: 'claimed' };
  }
  return { mode: 'unclaimed' };
}

export function claimAdminPasscode(rawPasscode: unknown): {
  ok: true;
  token: string;
  mode: AdminAuthMode;
} | {
  ok: false;
  status: number;
  error: string;
} {
  if (getEnvPasscode()) {
    return {
      ok: false,
      status: 409,
      error: 'Admin passcode is managed by server environment variables. Please sign in instead.',
    };
  }
  if (claimedHash) {
    return {
      ok: false,
      status: 409,
      error: 'Admin passcode has already been set. Please sign in with your passcode.',
    };
  }

  const passcode = typeof rawPasscode === 'string' ? rawPasscode.trim() : '';
  if (passcode.length < MIN_PASSCODE_LENGTH || passcode.length > MAX_PASSCODE_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Passcode must be between ${MIN_PASSCODE_LENGTH} and ${MAX_PASSCODE_LENGTH} characters.`,
    };
  }

  claimedHash = hashPasscode(passcode);
  const token = issueSessionToken();
  return { ok: true, token, mode: 'claimed' };
}

const MAX_FAILED_ATTEMPTS = 10;
const FAILED_WINDOW_MS = 5 * 60 * 1000;
let failedLoginTimestamps: number[] = [];

function isLoginRateLimited(): boolean {
  const cutoff = Date.now() - FAILED_WINDOW_MS;
  failedLoginTimestamps = failedLoginTimestamps.filter((ts) => ts > cutoff);
  return failedLoginTimestamps.length >= MAX_FAILED_ATTEMPTS;
}

export function loginAdminPasscode(rawPasscode: unknown): {
  ok: true;
  token: string;
  mode: AdminAuthMode;
} | {
  ok: false;
  status: number;
  error: string;
} {
  if (isLoginRateLimited()) {
    return {
      ok: false,
      status: 429,
      error: 'Too many failed attempts. Please wait a few minutes before trying again.',
    };
  }

  const passcode = typeof rawPasscode === 'string' ? rawPasscode.trim() : '';
  if (!passcode || passcode.length > MAX_PASSCODE_LENGTH) {
    return { ok: false, status: 400, error: 'Passcode is required.' };
  }

  const envPasscode = getEnvPasscode();
  if (envPasscode) {
    // Compare scrypt digests of both values with constant-time equality
    const salt = 'football-ai-env-admin-v1';
    const expected = hashPasscode(envPasscode, salt);
    const provided = hashPasscode(passcode, salt);
    if (!safeEqualStrings(expected.hashHex, provided.hashHex)) {
      failedLoginTimestamps.push(Date.now());
      return { ok: false, status: 401, error: 'Invalid admin passcode.' };
    }
    failedLoginTimestamps = [];
    return { ok: true, token: issueSessionToken(), mode: 'env' };
  }

  if (!claimedHash) {
    return {
      ok: false,
      status: 409,
      error: 'No admin passcode configured yet. Set one first to unlock protected actions.',
    };
  }

  const provided = hashPasscode(passcode, claimedHash.saltHex);
  if (!safeEqualStrings(claimedHash.hashHex, provided.hashHex)) {
    failedLoginTimestamps.push(Date.now());
    return { ok: false, status: 401, error: 'Invalid admin passcode.' };
  }

  failedLoginTimestamps = [];
  return { ok: true, token: issueSessionToken(), mode: 'claimed' };
}

export function getVerifiedAdminSessionKey(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) return null;

  pruneExpiredSessions();
  const record = activeSessions.get(token);
  if (!record || record.expiresAt <= Date.now()) {
    activeSessions.delete(token);
    return null;
  }

  // Sliding refresh
  record.expiresAt = Date.now() + SESSION_TTL_MS;
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyAdminBearerHeader(authHeader: string | undefined): boolean {
  return getVerifiedAdminSessionKey(authHeader) !== null;
}
