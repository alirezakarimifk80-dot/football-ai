import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_FILES = 1000;
const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const BLOB_UPLOAD_CONCURRENCY = 6;

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.aistudio',
  '.wrangler',
  '.next',
  '.cache',
  'coverage',
  'tmp',
  '.vscode',
]);

const ALLOWED_DOTFILES = new Set(['.env.example', '.gitignore', '.nvmrc', '.editorconfig']);

const EXCLUDED_EXACT_FILES = new Set([
  '.env',
  '.dev.vars',
  '.DS_Store',
  'Thumbs.db',
  'firebase-applet-config.json',
]);

const EXCLUDED_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx', '.log']);

export type GitHubTokenType = 'classic' | 'fine-grained' | 'oauth' | 'unknown';

interface CollectedFile {
  relativePath: string;
  absolutePath: string;
  mode: '100644' | '100755';
  size: number;
}

interface CollectSummary {
  files: CollectedFile[];
  totalSizeBytes: number;
  skippedOversizeCount: number;
  truncated: boolean;
}

interface GitHubFetchResult {
  status: number;
  ok: boolean;
  data: any;
  scopes: string[];
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
}

export type GitHubTokenSource = 'session' | 'env' | null;

export interface GitHubStatusInfo {
  availableInRuntime: true;
  tokenConfigured: boolean;
  tokenSource: GitHubTokenSource;
  tokenType: GitHubTokenType | null;
  authenticatedUser: string | null;
  scopes: string[];
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
  defaultOwner: string;
  defaultRepo: string;
  defaultBranch: string;
  fileCount: number;
  totalSizeBytes: number;
  statusNote: string | null;
}

export interface GitHubDiagnosticCheck {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  labelEn: string;
  labelFa: string;
  detailEn: string;
  detailFa: string;
}

export interface GitHubDiagnosticsResult {
  overallStatus: 'ready' | 'warning' | 'error';
  checkedAtUtc: string;
  tokenConfigured: boolean;
  tokenSource: GitHubTokenSource;
  tokenType: GitHubTokenType | null;
  authenticatedUser: string | null;
  scopes: string[];
  rateLimit: { remaining: number; limit: number } | null;
  target: {
    owner: string;
    repo: string;
    branch: string;
  };
  fileCount: number;
  totalSizeBytes: number;
  checks: GitHubDiagnosticCheck[];
  recommendationsEn: string[];
  recommendationsFa: string[];
}

export interface GitHubPushInput {
  owner?: unknown;
  repo?: unknown;
  branch?: unknown;
  commitMessage?: unknown;
  createRepoIfMissing?: unknown;
  isPrivate?: unknown;
}

export interface GitHubDiagnoseInput {
  owner?: unknown;
  repo?: unknown;
  branch?: unknown;
  createRepoIfMissing?: unknown;
}

export interface GitHubPushResult {
  ok: true;
  owner: string;
  repo: string;
  branch: string;
  filesUploaded: number;
  commitSha: string;
  repoUrl: string;
  commitUrl: string;
  repoCreated: boolean;
}

interface CachedUserLookup {
  tokenHash: string;
  login: string | null;
  scopes: string[];
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
  expiresAt: number;
  error: string | null;
  httpStatus: number | null;
}

let cachedUserLookup: CachedUserLookup | null = null;

// Ephemeral in-memory GitHub tokens scoped strictly to an authenticated admin session (never persisted to disk)
const SESSION_GITHUB_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_SESSION_GITHUB_TOKENS = 20;
const sessionGitHubTokens = new Map<string, { token: string; expiresAt: number }>();

function pruneSessionGitHubTokens(): void {
  const now = Date.now();
  for (const [key, entry] of sessionGitHubTokens.entries()) {
    if (entry.expiresAt <= now) {
      sessionGitHubTokens.delete(key);
    }
  }
  while (sessionGitHubTokens.size > MAX_SESSION_GITHUB_TOKENS) {
    const oldestKey = sessionGitHubTokens.keys().next().value;
    if (!oldestKey) break;
    sessionGitHubTokens.delete(oldestKey);
  }
}

function getEnvGitHubToken(): string {
  const raw = (process.env.GITHUB_TOKEN ?? '').trim();
  if (!raw || raw === 'MY_GITHUB_TOKEN' || raw === 'ghp_xxx') return '';
  return raw;
}

function resolveEffectiveGitHubToken(sessionKey?: string | null): {
  token: string;
  source: GitHubTokenSource;
} {
  pruneSessionGitHubTokens();
  if (sessionKey) {
    const entry = sessionGitHubTokens.get(sessionKey);
    if (entry && entry.expiresAt > Date.now()) {
      entry.expiresAt = Date.now() + SESSION_GITHUB_TOKEN_TTL_MS;
      return { token: entry.token, source: 'session' };
    }
  }
  const envToken = getEnvGitHubToken();
  if (envToken) {
    return { token: envToken, source: 'env' };
  }
  return { token: '', source: null };
}

export async function setSessionGitHubToken(
  sessionKey: string,
  rawToken: unknown
): Promise<GitHubStatusInfo> {
  const cleaned = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!cleaned) {
    throw new Error('Please paste your GitHub Personal Access Token.');
  }
  if (cleaned.length < 10 || cleaned.length > 300 || /\s/.test(cleaned)) {
    throw new Error('Invalid GitHub token format. Paste the exact token without spaces or line breaks.');
  }

  // Verify token live with GitHub before storing in ephemeral session memory
  const verified = await resolveAuthenticatedUser(cleaned, true);
  if (!verified.login) {
    throw new Error(
      verified.error ?? 'GitHub rejected this token. Check that it has not expired and try again.'
    );
  }

  pruneSessionGitHubTokens();
  sessionGitHubTokens.set(sessionKey, {
    token: cleaned,
    expiresAt: Date.now() + SESSION_GITHUB_TOKEN_TTL_MS,
  });

  return getGitHubStatus(false, sessionKey);
}

export function clearSessionGitHubToken(sessionKey: string): void {
  sessionGitHubTokens.delete(sessionKey);
  cachedUserLookup = null;
}

function detectTokenType(token: string): GitHubTokenType {
  if (token.startsWith('ghp_')) return 'classic';
  if (token.startsWith('github_pat_')) return 'fine-grained';
  if (token.startsWith('gho_') || token.startsWith('ghu_') || token.startsWith('ghs_')) return 'oauth';
  return 'unknown';
}

function isExcludedFile(fileName: string): boolean {
  if (ALLOWED_DOTFILES.has(fileName)) return false;
  if (EXCLUDED_EXACT_FILES.has(fileName)) return true;
  if (fileName.startsWith('.env.')) return true;
  if (fileName.startsWith('id_rsa') || fileName.startsWith('service-account')) return true;
  const ext = path.extname(fileName).toLowerCase();
  if (EXCLUDED_EXTENSIONS.has(ext)) return true;
  return false;
}

async function collectProjectFilesDetailed(): Promise<CollectSummary> {
  const files: CollectedFile[] = [];
  let totalSizeBytes = 0;
  let skippedOversizeCount = 0;
  let truncated = false;

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true;
        break;
      }
      // Never follow symlinks to keep traversal strictly confined
      if (entry.isSymbolicLink()) continue;

      const resolved = path.resolve(currentDir, entry.name);
      if (!resolved.startsWith(PROJECT_ROOT + path.sep)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(resolved);
      } else if (entry.isFile()) {
        if (isExcludedFile(entry.name)) continue;
        const stat = await fs.stat(resolved);
        if (stat.size > MAX_SINGLE_FILE_BYTES) {
          skippedOversizeCount += 1;
          continue;
        }

        const rel = path.relative(PROJECT_ROOT, resolved).split(path.sep).join('/');
        const isShellScript = rel.endsWith('.sh');
        files.push({
          relativePath: rel,
          absolutePath: resolved,
          mode: isShellScript ? '100755' : '100644',
          size: stat.size,
        });
        totalSizeBytes += stat.size;
      }
    }
  }

  await walk(PROJECT_ROOT);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { files, totalSizeBytes, skippedOversizeCount, truncated };
}

export async function collectProjectFiles(): Promise<CollectedFile[]> {
  const summary = await collectProjectFilesDetailed();
  return summary.files;
}

function parseScopesHeader(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNullableInt(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

async function githubFetch(
  apiPath: string,
  token: string,
  init: RequestInit = {}
): Promise<GitHubFetchResult> {
  if (!apiPath.startsWith('/') || apiPath.startsWith('//')) {
    throw new Error('Invalid GitHub API path');
  }
  const url = `${GITHUB_API_BASE}${apiPath}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'FootballAI-Publisher/1.1',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });

  const scopes = parseScopesHeader(res.headers.get('x-oauth-scopes'));
  const rateLimitRemaining = parseNullableInt(res.headers.get('x-ratelimit-remaining'));
  const rateLimitLimit = parseNullableInt(res.headers.get('x-ratelimit-limit'));

  let data: any = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 200) };
    }
  }
  return {
    status: res.status,
    ok: res.ok,
    data,
    scopes,
    rateLimitRemaining,
    rateLimitLimit,
  };
}

async function resolveAuthenticatedUser(
  token: string,
  forceRefresh = false
): Promise<{
  login: string | null;
  scopes: string[];
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
  error: string | null;
  httpStatus: number | null;
}> {
  const tokenHint = crypto.createHash('sha256').update(token).digest('hex');
  if (
    !forceRefresh &&
    cachedUserLookup &&
    cachedUserLookup.tokenHash === tokenHint &&
    cachedUserLookup.expiresAt > Date.now()
  ) {
    return {
      login: cachedUserLookup.login,
      scopes: cachedUserLookup.scopes,
      rateLimitRemaining: cachedUserLookup.rateLimitRemaining,
      rateLimitLimit: cachedUserLookup.rateLimitLimit,
      error: cachedUserLookup.error,
      httpStatus: cachedUserLookup.httpStatus,
    };
  }

  try {
    const res = await githubFetch('/user', token, { method: 'GET' });
    if (res.ok && typeof res.data?.login === 'string') {
      cachedUserLookup = {
        tokenHash: tokenHint,
        login: res.data.login,
        scopes: res.scopes,
        rateLimitRemaining: res.rateLimitRemaining,
        rateLimitLimit: res.rateLimitLimit,
        expiresAt: Date.now() + 60_000,
        error: null,
        httpStatus: res.status,
      };
      return {
        login: res.data.login,
        scopes: res.scopes,
        rateLimitRemaining: res.rateLimitRemaining,
        rateLimitLimit: res.rateLimitLimit,
        error: null,
        httpStatus: res.status,
      };
    }

    const baseMsg =
      typeof res.data?.message === 'string' ? res.data.message : `GitHub returned HTTP ${res.status}`;
    const errMsg =
      res.status === 401
        ? `Invalid or expired GitHub token (${baseMsg}). Generate a new Personal Access Token and update GITHUB_TOKEN in Settings -> Secrets.`
        : baseMsg;

    cachedUserLookup = {
      tokenHash: tokenHint,
      login: null,
      scopes: res.scopes,
      rateLimitRemaining: res.rateLimitRemaining,
      rateLimitLimit: res.rateLimitLimit,
      expiresAt: Date.now() + 15_000,
      error: errMsg,
      httpStatus: res.status,
    };
    return {
      login: null,
      scopes: res.scopes,
      rateLimitRemaining: res.rateLimitRemaining,
      rateLimitLimit: res.rateLimitLimit,
      error: errMsg,
      httpStatus: res.status,
    };
  } catch (err) {
    return {
      login: null,
      scopes: [],
      rateLimitRemaining: null,
      rateLimitLimit: null,
      error: err instanceof Error ? err.message : 'Unable to reach GitHub API',
      httpStatus: null,
    };
  }
}

export async function getGitHubStatus(
  forceRefresh = false,
  sessionKey?: string | null
): Promise<GitHubStatusInfo> {
  const { token, source } = resolveEffectiveGitHubToken(sessionKey);
  const collected = await collectProjectFilesDetailed();
  const envOwner = (process.env.GITHUB_OWNER ?? '').trim();
  const envRepo = (process.env.GITHUB_REPO ?? 'football-ai').trim() || 'football-ai';
  const envBranch = (process.env.GITHUB_BRANCH ?? 'main').trim() || 'main';

  if (!token) {
    return {
      availableInRuntime: true,
      tokenConfigured: false,
      tokenSource: null,
      tokenType: null,
      authenticatedUser: null,
      scopes: [],
      rateLimitRemaining: null,
      rateLimitLimit: null,
      defaultOwner: envOwner,
      defaultRepo: envRepo,
      defaultBranch: envBranch,
      fileCount: collected.files.length,
      totalSizeBytes: collected.totalSizeBytes,
      statusNote: null,
    };
  }

  const tokenType = detectTokenType(token);
  const user = await resolveAuthenticatedUser(token, forceRefresh);
  return {
    availableInRuntime: true,
    tokenConfigured: true,
    tokenSource: source,
    tokenType,
    authenticatedUser: user.login,
    scopes: user.scopes,
    rateLimitRemaining: user.rateLimitRemaining,
    rateLimitLimit: user.rateLimitLimit,
    defaultOwner: envOwner || user.login || '',
    defaultRepo: envRepo,
    defaultBranch: envBranch,
    fileCount: collected.files.length,
    totalSizeBytes: collected.totalSizeBytes,
    statusNote: user.error,
  };
}

function validateOwner(raw: unknown): string {
  const val = typeof raw === 'string' ? raw.trim() : '';
  if (!val) return '';
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(val)) {
    throw new Error('Invalid GitHub username/organization format.');
  }
  return val;
}

function validateRepo(raw: unknown): string {
  const val = typeof raw === 'string' ? raw.trim() : '';
  if (!val || val === '.' || val === '..' || !/^[A-Za-z0-9._-]{1,100}$/.test(val)) {
    throw new Error('Invalid repository name. Use letters, numbers, hyphens, dots, or underscores.');
  }
  return val;
}

function validateBranch(raw: unknown): string {
  const val = typeof raw === 'string' ? raw.trim() : 'main';
  const branch = val || 'main';
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(branch) || branch === '.' || branch === '..') {
    throw new Error('Invalid branch name. Use a simple branch name such as main.');
  }
  return branch;
}

function sanitizeCommitMessage(raw: unknown): string {
  const cleaned = (typeof raw === 'string' ? raw : '')
    .replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ')
    .trim()
    .slice(0, 160);
  return cleaned || 'Deploy Football AI (Live World & Iran Football + Cloudflare Pages)';
}

export async function diagnoseGitHubUpload(
  input: GitHubDiagnoseInput,
  sessionKey?: string | null
): Promise<GitHubDiagnosticsResult> {
  const checkedAtUtc = new Date().toISOString();
  const checks: GitHubDiagnosticCheck[] = [];
  const recommendationsEn: string[] = [];
  const recommendationsFa: string[] = [];

  const collected = await collectProjectFilesDetailed();
  const totalMb = (collected.totalSizeBytes / (1024 * 1024)).toFixed(2);

  // Validate inputs first so invalid owner/repo/branch fail fast with 400
  const requestedOwner = validateOwner(input.owner);
  const repo = validateRepo(input.repo ?? process.env.GITHUB_REPO ?? 'football-ai');
  const branch = validateBranch(input.branch ?? process.env.GITHUB_BRANCH ?? 'main');
  const createRepoIfMissing = input.createRepoIfMissing !== false;

  // 1. Runtime & workspace check
  checks.push({
    id: 'runtime',
    status: 'pass',
    labelEn: 'Server Workspace Runtime',
    labelFa: 'محیط سرور و فایل‌های پروژه',
    detailEn: 'Node.js workspace active with direct access to source files.',
    detailFa: 'سرور Node.js فعال است و به سورس تمیز پروژه دسترسی دارد.',
  });

  // 2. Clean files check
  if (collected.files.length === 0) {
    checks.push({
      id: 'files',
      status: 'fail',
      labelEn: 'Project Source Files',
      labelFa: 'فایل‌های سورس آماده آپلود',
      detailEn: 'No uploadable project files were found.',
      detailFa: 'هیچ فایلی برای آپلود پیدا نشد.',
    });
  } else if (collected.truncated) {
    checks.push({
      id: 'files',
      status: 'warn',
      labelEn: 'Project Source Files',
      labelFa: 'فایل‌های سورس آماده آپلود',
      detailEn: `Reached ${MAX_FILES}-file cap (${totalMb} MB). Sensitive files (.env, keys, node_modules, dist) excluded.`,
      detailFa: `به سقف ${MAX_FILES} فایل رسید (${totalMb} مگابایت). فایل‌های حساس (.env، کلیدها، node_modules و dist) حذف شده‌اند.`,
    });
  } else {
    checks.push({
      id: 'files',
      status: 'pass',
      labelEn: 'Project Source Files',
      labelFa: 'فایل‌های سورس آماده آپلود',
      detailEn: `${collected.files.length} clean files (${totalMb} MB). .env, secrets, node_modules & dist automatically excluded.`,
      detailFa: `${collected.files.length} فایل تمیز (${totalMb} مگابایت). فایل‌های .env، کلیدها، node_modules و dist به‌طور خودکار حذف شده‌اند.`,
    });
  }

  // 3. GitHub token check (session or server env)
  const { token, source: tokenSource } = resolveEffectiveGitHubToken(sessionKey);
  if (!token) {
    checks.push({
      id: 'token',
      status: 'fail',
      labelEn: 'GitHub Personal Access Token',
      labelFa: 'توکن دسترسی گیت‌هاب',
      detailEn: 'No GitHub token connected yet. Paste your token in the token box above or set GITHUB_TOKEN in server Secrets.',
      detailFa: 'هنوز توکن گیت‌هاب متصل نشده است. توکن خود را در کادر «توکن گیت‌هاب» وارد و متصل کنید (یا GITHUB_TOKEN را در Secrets سرور بگذارید).',
    });
    recommendationsEn.push(
      'Click "Get GitHub Token" to generate a Classic Personal Access Token with the "repo" scope, then paste it into the GitHub Token field above and click "Connect Token".'
    );
    recommendationsFa.push(
      'روی دکمه «دریافت توکن گیت‌هاب» کلیک کنید، یک توکن کلاسیک با دسترسی repo بسازید و آن را در کادر توکن گیت‌هاب بالا وارد کرده و «اتصال توکن» را بزنید.'
    );

    return {
      overallStatus: 'error',
      checkedAtUtc,
      tokenConfigured: false,
      tokenSource: null,
      tokenType: null,
      authenticatedUser: null,
      scopes: [],
      rateLimit: null,
      target: {
        owner: requestedOwner || (process.env.GITHUB_OWNER ?? '').trim(),
        repo,
        branch,
      },
      fileCount: collected.files.length,
      totalSizeBytes: collected.totalSizeBytes,
      checks,
      recommendationsEn,
      recommendationsFa,
    };
  }

  const tokenType = detectTokenType(token);
  const hasWhitespace = /\s/.test(token);
  if (hasWhitespace) {
    checks.push({
      id: 'token',
      status: 'fail',
      labelEn: 'GitHub Personal Access Token',
      labelFa: 'توکن دسترسی گیت‌هاب',
      detailEn: 'Token contains spaces or line breaks. Re-paste it cleanly without extra spaces.',
      detailFa: 'در مقدار توکن فاصله یا خط اضافه وجود دارد. آن را دوباره بدون فاصله اضافی وارد کنید.',
    });
    recommendationsEn.push('Re-enter your GitHub token cleanly without leading/trailing spaces.');
    recommendationsFa.push('توکن گیت‌هاب را بدون فاصله یا خط جدید دوباره وارد کنید.');
  } else {
    const typeLabelEn =
      tokenType === 'classic'
        ? 'Classic PAT (ghp_)'
        : tokenType === 'fine-grained'
          ? 'Fine-Grained PAT (github_pat_)'
          : tokenType === 'oauth'
            ? 'OAuth Token'
            : 'Custom Token';
    const typeLabelFa =
      tokenType === 'classic'
        ? 'توکن کلاسیک (ghp_)'
        : tokenType === 'fine-grained'
          ? 'توکن محدود Fine-Grained (github_pat_)'
          : tokenType === 'oauth'
            ? 'توکن OAuth'
            : 'توکن سفارشی';
    const sourceLabelEn = tokenSource === 'session' ? 'active admin session RAM' : 'server Secrets';
    const sourceLabelFa = tokenSource === 'session' ? 'حافظه موقت نشست فعلی سرور' : 'متغیرهای محرمانه سرور';
    checks.push({
      id: 'token',
      status: 'pass',
      labelEn: 'GitHub Personal Access Token',
      labelFa: 'توکن دسترسی گیت‌هاب',
      detailEn: `Loaded securely from ${sourceLabelEn} (${typeLabelEn}).`,
      detailFa: `به‌صورت امن در ${sourceLabelFa} متصل است (${typeLabelFa}).`,
    });
  }

  // 4. Live GitHub /user authentication & rate limit check (bypass cache)
  const user = await resolveAuthenticatedUser(token, true);
  const rateLimit =
    user.rateLimitRemaining !== null && user.rateLimitLimit !== null
      ? { remaining: user.rateLimitRemaining, limit: user.rateLimitLimit }
      : null;

  if (!user.login) {
    checks.push({
      id: 'auth',
      status: 'fail',
      labelEn: 'GitHub API Authentication',
      labelFa: 'احراز هویت در API گیت‌هاب',
      detailEn: user.error ?? 'GitHub rejected the token.',
      detailFa:
        user.httpStatus === 401
          ? 'توکن گیت‌هاب نامعتبر یا منقضی شده است (خطای 401).'
          : `خطا در اتصال به گیت‌هاب: ${user.error ?? 'نامشخص'}`,
    });
    recommendationsEn.push(
      'Generate a fresh token via "Get GitHub Token" and connect it in the GitHub Token field above.'
    );
    recommendationsFa.push(
      'یک توکن جدید از دکمه «دریافت توکن گیت‌هاب» بسازید و در کادر توکن بالا وارد و متصل کنید.'
    );

    return {
      overallStatus: 'error',
      checkedAtUtc,
      tokenConfigured: true,
      tokenSource,
      tokenType,
      authenticatedUser: null,
      scopes: user.scopes,
      rateLimit,
      target: {
        owner: requestedOwner || (process.env.GITHUB_OWNER ?? '').trim(),
        repo,
        branch,
      },
      fileCount: collected.files.length,
      totalSizeBytes: collected.totalSizeBytes,
      checks,
      recommendationsEn,
      recommendationsFa,
    };
  }

  const rateTextEn = rateLimit ? ` · API quota: ${rateLimit.remaining}/${rateLimit.limit}` : '';
  const rateTextFa = rateLimit ? ` · سهمیه باقی‌مانده: ${rateLimit.remaining}/${rateLimit.limit}` : '';
  const lowQuota = rateLimit !== null && rateLimit.remaining < Math.max(40, collected.files.length + 10);

  checks.push({
    id: 'auth',
    status: lowQuota ? 'warn' : 'pass',
    labelEn: 'GitHub API Authentication',
    labelFa: 'احراز هویت در API گیت‌هاب',
    detailEn: `Authenticated as @${user.login}${rateTextEn}`,
    detailFa: `متصل به حساب @${user.login}${rateTextFa}`,
  });

  if (lowQuota) {
    recommendationsEn.push('GitHub API rate limit is running low for a full file upload; wait a few minutes before pushing.');
    recommendationsFa.push('سهمیه درخواست API گیت‌هاب کم است؛ چند دقیقه صبر کنید و سپس آپلود را بزنید.');
  }

  // 5. Scope / Permission check
  if (tokenType === 'classic') {
    const hasRepoScope = user.scopes.includes('repo');
    const hasPublicRepoOnly = !hasRepoScope && user.scopes.includes('public_repo');
    if (hasRepoScope) {
      checks.push({
        id: 'scopes',
        status: 'pass',
        labelEn: 'Token Permissions (Scopes)',
        labelFa: 'سطح دسترسی توکن (Scopes)',
        detailEn: `Includes full "repo" scope (${user.scopes.join(', ')}). Supports public & private repos.`,
        detailFa: `دارای دسترسی کامل repo (${user.scopes.join(', ')}) برای مخازن عمومی و خصوصی.`,
      });
    } else if (hasPublicRepoOnly) {
      checks.push({
        id: 'scopes',
        status: 'warn',
        labelEn: 'Token Permissions (Scopes)',
        labelFa: 'سطح دسترسی توکن (Scopes)',
        detailEn: 'Only "public_repo" scope detected. Works for public repos, but private repos will fail.',
        detailFa: 'فقط دسترسی public_repo فعال است. برای مخزن عمومی کار می‌کند اما مخزن خصوصی خطا می‌دهد.',
      });
      recommendationsEn.push('For private repositories, regenerate the token with full "repo" scope.');
      recommendationsFa.push('اگر مخزن خصوصی می‌خواهید، توکن را با تیک کامل «repo» بسازید.');
    } else {
      checks.push({
        id: 'scopes',
        status: 'fail',
        labelEn: 'Token Permissions (Scopes)',
        labelFa: 'سطح دسترسی توکن (Scopes)',
        detailEn: `Missing "repo" scope (current scopes: ${user.scopes.length ? user.scopes.join(', ') : 'none'}).`,
        detailFa: `دسترسی repo در این توکن فعال نیست (دسترسی فعلی: ${user.scopes.length ? user.scopes.join(', ') : 'هیچکدام'}).`,
      });
      recommendationsEn.push(
        'Create a Classic token with the "repo" checkbox enabled using the "Get GitHub Token" button.'
      );
      recommendationsFa.push(
        'از دکمه «دریافت توکن گیت‌هاب» یک توکن جدید بسازید و حتماً تیک دسترسی repo را فعال کنید.'
      );
    }
  } else if (tokenType === 'fine-grained') {
    checks.push({
      id: 'scopes',
      status: 'pass',
      labelEn: 'Token Permissions (Fine-Grained)',
      labelFa: 'سطح دسترسی توکن (Fine-Grained)',
      detailEn: 'Fine-Grained PAT active. Ensure "Contents: Read and write" is granted on the target repository.',
      detailFa: 'توکن Fine-Grained فعال است. مطمئن شوید دسترسی «Contents: Read and write» برای مخزن هدف فعال باشد.',
    });
  } else {
    checks.push({
      id: 'scopes',
      status: 'warn',
      labelEn: 'Token Permissions',
      labelFa: 'سطح دسترسی توکن',
      detailEn: 'Token accepted by GitHub; verifying target repository write access below.',
      detailFa: 'توکن توسط گیت‌هاب پذیرفته شد؛ دسترسی نوشتن روی مخزن هدف در مرحله بعد بررسی می‌شود.',
    });
  }

  // 6. Live target repository & branch inspection
  const owner = requestedOwner || (process.env.GITHUB_OWNER ?? '').trim() || user.login;
  const ownerEnc = encodeURIComponent(owner);
  const repoEnc = encodeURIComponent(repo);
  const branchEnc = encodeURIComponent(branch);

  try {
    const repoRes = await githubFetch(`/repos/${ownerEnc}/${repoEnc}`, token, { method: 'GET' });
    if (repoRes.ok) {
      const canPush = repoRes.data?.permissions?.push;
      const defaultBranch =
        typeof repoRes.data?.default_branch === 'string' ? repoRes.data.default_branch : 'main';

      if (canPush === false) {
        checks.push({
          id: 'repository',
          status: 'fail',
          labelEn: 'Target Repository & Write Access',
          labelFa: 'مخزن هدف و مجوز نوشتن (Push)',
          detailEn: `Repository ${owner}/${repo} exists, but this token does NOT have push/write permission.`,
          detailFa: `مخزن ${owner}/${repo} وجود دارد اما این توکن مجوز نوشتن (Push) روی آن ندارد.`,
        });
        recommendationsEn.push(
          `Grant write access ("repo" or "Contents: Read and write") to ${owner}/${repo}.`
        );
        recommendationsFa.push(
          `دسترسی نوشتن (repo یا Contents: Read and write) را برای مخزن ${owner}/${repo} به این توکن بدهید.`
        );
      } else {
        const refRes = await githubFetch(
          `/repos/${ownerEnc}/${repoEnc}/git/ref/heads/${branchEnc}`,
          token,
          { method: 'GET' }
        );
        if (refRes.ok) {
          checks.push({
            id: 'repository',
            status: 'pass',
            labelEn: 'Target Repository & Branch',
            labelFa: 'مخزن هدف و شاخه (Branch)',
            detailEn: `${owner}/${repo} (${branch}) is accessible and writable (default branch: ${defaultBranch}).`,
            detailFa: `مخزن ${owner}/${repo} و شاخه ${branch} در دسترس و آماده دریافت کامیت است.`,
          });
        } else if (refRes.status === 409) {
          checks.push({
            id: 'repository',
            status: 'pass',
            labelEn: 'Target Repository & Branch',
            labelFa: 'مخزن هدف و شاخه (Branch)',
            detailEn: `${owner}/${repo} exists and is currently empty — uploader will initialize branch "${branch}" automatically.`,
            detailFa: `مخزن ${owner}/${repo} خالی است و هنگام آپلود به‌صورت خودکار با شاخه ${branch} راه‌اندازی می‌شود.`,
          });
        } else if (refRes.status === 404) {
          checks.push({
            id: 'repository',
            status: 'pass',
            labelEn: 'Target Repository & Branch',
            labelFa: 'مخزن هدف و شاخه (Branch)',
            detailEn: `${owner}/${repo} is writable. Branch "${branch}" does not exist yet and will be created from "${defaultBranch}".`,
            detailFa: `مخزن ${owner}/${repo} قابل نوشتن است؛ شاخه ${branch} هنوز ساخته نشده و خودکار از روی ${defaultBranch} ایجاد می‌شود.`,
          });
        } else {
          checks.push({
            id: 'repository',
            status: 'warn',
            labelEn: 'Target Repository & Branch',
            labelFa: 'مخزن هدف و شاخه (Branch)',
            detailEn: `Repository ${owner}/${repo} found, but branch check returned HTTP ${refRes.status}.`,
            detailFa: `مخزن ${owner}/${repo} پیدا شد اما بررسی شاخه خطای HTTP ${refRes.status} داد.`,
          });
        }
      }
    } else if (repoRes.status === 404) {
      if (!createRepoIfMissing) {
        checks.push({
          id: 'repository',
          status: 'fail',
          labelEn: 'Target Repository',
          labelFa: 'مخزن هدف در گیت‌هاب',
          detailEn: `Repository ${owner}/${repo} was not found, and "Create repository if it does not exist" is unchecked.`,
          detailFa: `مخزن ${owner}/${repo} پیدا نشد و گزینه «ساخت خودکار مخزن» خاموش است.`,
        });
        recommendationsEn.push(
          'Enable "Create repository if it does not exist" or create the repository on GitHub first.'
        );
        recommendationsFa.push(
          'گزینه «در صورت نبود مخزن، خودکار ساخته شود» را تیک بزنید یا مخزن را ابتدا در گیت‌هاب بسازید.'
        );
      } else if (tokenType === 'fine-grained') {
        checks.push({
          id: 'repository',
          status: 'warn',
          labelEn: 'Target Repository (Will Auto-Create)',
          labelFa: 'مخزن هدف (ساخت خودکار)',
          detailEn: `${owner}/${repo} does not exist yet. Fine-Grained PAT requires "Administration: Read and write" to create new repos; otherwise create an empty repo on GitHub first.`,
          detailFa: `مخزن ${owner}/${repo} هنوز وجود ندارد. توکن Fine-Grained برای ساخت مخزن جدید نیاز به دسترسی «Administration: Read and write» دارد؛ یا می‌توانید مخزن خالی را دستی در گیت‌هاب بسازید.`,
        });
        recommendationsEn.push(
          'Using a Classic PAT with "repo" scope is the easiest way to auto-create repositories.'
        );
        recommendationsFa.push(
          'استفاده از توکن کلاسیک با دسترسی repo ساده‌ترین راه برای ساخت خودکار مخزن و آپلود بدون خطاست.'
        );
      } else {
        checks.push({
          id: 'repository',
          status: 'pass',
          labelEn: 'Target Repository (Will Auto-Create)',
          labelFa: 'مخزن هدف (ساخت خودکار)',
          detailEn: `${owner}/${repo} does not exist yet and will be created automatically when you click Upload.`,
          detailFa: `مخزن ${owner}/${repo} هنوز وجود ندارد و با زدن دکمه آپلود به‌صورت خودکار ساخته می‌شود.`,
        });
      }
    } else {
      checks.push({
        id: 'repository',
        status: 'fail',
        labelEn: 'Target Repository',
        labelFa: 'مخزن هدف در گیت‌هاب',
        detailEn: `Unable to inspect ${owner}/${repo}: ${repoRes.data?.message ?? `HTTP ${repoRes.status}`}`,
        detailFa: `عدم دسترسی به ${owner}/${repo}: ${repoRes.data?.message ?? `HTTP ${repoRes.status}`}`,
      });
    }
  } catch (err) {
    checks.push({
      id: 'repository',
      status: 'fail',
      labelEn: 'Target Repository',
      labelFa: 'مخزن هدف در گیت‌هاب',
      detailEn: err instanceof Error ? err.message : 'Network error checking target repository.',
      detailFa: 'خطای شبکه هنگام بررسی مخزن هدف در گیت‌هاب.',
    });
  }

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');

  return {
    overallStatus: hasFail ? 'error' : hasWarn ? 'warning' : 'ready',
    checkedAtUtc,
    tokenConfigured: true,
    tokenSource,
    tokenType,
    authenticatedUser: user.login,
    scopes: user.scopes,
    rateLimit,
    target: { owner, repo, branch },
    fileCount: collected.files.length,
    totalSizeBytes: collected.totalSizeBytes,
    checks,
    recommendationsEn,
    recommendationsFa,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIdx = 0;

  async function next(): Promise<void> {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

async function fetchBranchRefWithRetry(
  ownerEnc: string,
  repoEnc: string,
  branchEnc: string,
  token: string,
  attempts: number
): Promise<GitHubFetchResult> {
  let lastRes = await githubFetch(
    `/repos/${ownerEnc}/${repoEnc}/git/ref/heads/${branchEnc}`,
    token,
    { method: 'GET' }
  );
  for (let i = 1; i < attempts && !lastRes.ok && (lastRes.status === 404 || lastRes.status === 409); i++) {
    await new Promise((r) => setTimeout(r, 1000));
    lastRes = await githubFetch(
      `/repos/${ownerEnc}/${repoEnc}/git/ref/heads/${branchEnc}`,
      token,
      { method: 'GET' }
    );
  }
  return lastRes;
}

export async function pushProjectToGitHub(
  input: GitHubPushInput,
  sessionKey?: string | null
): Promise<GitHubPushResult> {
  const { token } = resolveEffectiveGitHubToken(sessionKey);
  if (!token) {
    throw new Error(
      'No GitHub token connected. Paste your Personal Access Token in the token box above or configure GITHUB_TOKEN in Settings -> Secrets.'
    );
  }

  const tokenType = detectTokenType(token);
  const authUser = await resolveAuthenticatedUser(token, true);
  if (!authUser.login) {
    throw new Error(
      `GitHub token verification failed: ${authUser.error ?? 'Check token validity and permissions (repo / Contents: Read and write).'}`
    );
  }

  const owner = validateOwner(input.owner) || (process.env.GITHUB_OWNER ?? '').trim() || authUser.login;
  const repo = validateRepo(input.repo ?? process.env.GITHUB_REPO ?? 'football-ai');
  const branch = validateBranch(input.branch ?? process.env.GITHUB_BRANCH ?? 'main');
  const commitMessage = sanitizeCommitMessage(input.commitMessage);
  const createRepoIfMissing = input.createRepoIfMissing !== false;
  const isPrivate = input.isPrivate === true;

  if (tokenType === 'classic' && authUser.scopes.length > 0) {
    const hasRepo = authUser.scopes.includes('repo');
    const hasPublic = authUser.scopes.includes('public_repo');
    if (!hasRepo && (!hasPublic || isPrivate)) {
      throw new Error(
        `Your Classic GitHub token is missing the "${isPrivate ? 'repo' : 'repo / public_repo'}" scope (current: ${authUser.scopes.join(', ')}). Generate a new token with the "repo" scope.`
      );
    }
  }

  const ownerEnc = encodeURIComponent(owner);
  const repoEnc = encodeURIComponent(repo);
  const branchEnc = encodeURIComponent(branch);

  // 1. Check whether target repository exists
  let repoCreated = false;
  let defaultBranch = branch;
  const repoRes = await githubFetch(`/repos/${ownerEnc}/${repoEnc}`, token, { method: 'GET' });

  if (repoRes.status === 404) {
    if (!createRepoIfMissing) {
      throw new Error(
        `Repository ${owner}/${repo} not found on GitHub. Enable "Create repository if it does not exist" or create it on GitHub first.`
      );
    }
    const createEndpoint =
      owner.toLowerCase() === authUser.login.toLowerCase()
        ? '/user/repos'
        : `/orgs/${ownerEnc}/repos`;
    const created = await githubFetch(createEndpoint, token, {
      method: 'POST',
      body: JSON.stringify({
        name: repo,
        description: 'Football AI — Live World & Iran Football Analytics Platform',
        private: isPrivate,
        auto_init: true,
      }),
    });
    if (!created.ok) {
      const hint =
        created.status === 403
          ? ' (Classic PAT needs "repo" scope; Fine-Grained PAT needs "Administration: Read and write" — or create the empty repo manually on GitHub and uncheck auto-create.)'
          : '';
      throw new Error(
        `Could not create repository ${owner}/${repo}: ${created.data?.message ?? `HTTP ${created.status}`}${hint}`
      );
    }
    repoCreated = true;
    defaultBranch = typeof created.data?.default_branch === 'string' ? created.data.default_branch : 'main';
    // Brief initial pause while GitHub initializes the first commit ref
    await new Promise((r) => setTimeout(r, 1000));
  } else if (!repoRes.ok) {
    throw new Error(
      `Unable to access repository ${owner}/${repo}: ${repoRes.data?.message ?? `HTTP ${repoRes.status}`}`
    );
  } else {
    if (repoRes.data?.permissions && repoRes.data.permissions.push === false) {
      throw new Error(
        `Your GitHub token does not have write/push permission on ${owner}/${repo}. Grant "repo" (Classic PAT) or "Contents: Read and write" (Fine-Grained PAT).`
      );
    }
    defaultBranch = typeof repoRes.data?.default_branch === 'string' ? repoRes.data.default_branch : 'main';
  }

  // 2. Resolve branch ref (with retry after auto_init and graceful empty-repo initialization)
  let branchExists = false;
  let parentCommitSha: string | null = null;

  const refRes = await fetchBranchRefWithRetry(
    ownerEnc,
    repoEnc,
    branchEnc,
    token,
    repoCreated ? 4 : 1
  );

  if (refRes.ok && typeof refRes.data?.object?.sha === 'string') {
    branchExists = true;
    parentCommitSha = refRes.data.object.sha;
  } else if (refRes.status === 409) {
    // Repository exists but is completely empty — seed it with a tiny .gitkeep commit via Contents API
    const seedRes = await githubFetch(`/repos/${ownerEnc}/${repoEnc}/contents/.gitkeep`, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'Initialize repository',
        content: Buffer.from('', 'utf8').toString('base64'),
        branch,
      }),
    });
    if (!seedRes.ok) {
      throw new Error(
        `Repository is empty and could not be initialized: ${seedRes.data?.message ?? `HTTP ${seedRes.status}`}. Verify token has "Contents: Read and write" / "repo" scope.`
      );
    }
    const seededSha = seedRes.data?.commit?.sha;
    if (typeof seededSha === 'string') {
      branchExists = true;
      parentCommitSha = seededSha;
    }
  } else if (refRes.status === 404) {
    // Target branch does not exist yet — try default branch for parent commit
    const defRef = await fetchBranchRefWithRetry(
      ownerEnc,
      repoEnc,
      encodeURIComponent(defaultBranch),
      token,
      repoCreated ? 3 : 1
    );
    if (defRef.ok && typeof defRef.data?.object?.sha === 'string') {
      parentCommitSha = defRef.data.object.sha;
    } else if (defRef.status === 409 || defRef.status === 404) {
      const seedRes = await githubFetch(`/repos/${ownerEnc}/${repoEnc}/contents/.gitkeep`, token, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'Initialize repository',
          content: Buffer.from('', 'utf8').toString('base64'),
          branch,
        }),
      });
      if (!seedRes.ok) {
        throw new Error(
          `Could not initialize branch "${branch}": ${seedRes.data?.message ?? `HTTP ${seedRes.status}`}`
        );
      }
      if (typeof seedRes.data?.commit?.sha === 'string') {
        branchExists = true;
        parentCommitSha = seedRes.data.commit.sha;
      }
    }
  } else {
    throw new Error(`Unable to inspect branch ${branch}: ${refRes.data?.message ?? `HTTP ${refRes.status}`}`);
  }

  // 3. Collect clean project files & upload blobs to GitHub Git Data API
  const files = await collectProjectFiles();
  if (files.length === 0) {
    throw new Error('No project files found to upload.');
  }

  const treeEntries = await runWithConcurrency(files, BLOB_UPLOAD_CONCURRENCY, async (file) => {
    const contentBuf = await fs.readFile(file.absolutePath);
    const blobRes = await githubFetch(`/repos/${ownerEnc}/${repoEnc}/git/blobs`, token, {
      method: 'POST',
      body: JSON.stringify({
        content: contentBuf.toString('base64'),
        encoding: 'base64',
      }),
    });
    if (!blobRes.ok || typeof blobRes.data?.sha !== 'string') {
      const permHint =
        blobRes.status === 403 || blobRes.status === 404
          ? ' (Check that your token has "repo" or "Contents: Read and write" permission.)'
          : '';
      throw new Error(
        `Failed uploading ${file.relativePath}: ${blobRes.data?.message ?? `HTTP ${blobRes.status}`}${permHint}`
      );
    }
    return {
      path: file.relativePath,
      mode: file.mode,
      type: 'blob' as const,
      sha: blobRes.data.sha as string,
    };
  });

  // 4. Create full snapshot Git Tree
  const treeRes = await githubFetch(`/repos/${ownerEnc}/${repoEnc}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({ tree: treeEntries }),
  });
  if (!treeRes.ok || typeof treeRes.data?.sha !== 'string') {
    throw new Error(`Failed creating Git tree: ${treeRes.data?.message ?? `HTTP ${treeRes.status}`}`);
  }

  // 5. Create Commit pointing to the new tree
  const commitRes = await githubFetch(`/repos/${ownerEnc}/${repoEnc}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({
      message: commitMessage,
      tree: treeRes.data.sha,
      parents: parentCommitSha ? [parentCommitSha] : [],
    }),
  });
  if (!commitRes.ok || typeof commitRes.data?.sha !== 'string') {
    throw new Error(`Failed creating Git commit: ${commitRes.data?.message ?? `HTTP ${commitRes.status}`}`);
  }
  const commitSha = commitRes.data.sha as string;

  // 6. Update or create the branch ref
  if (branchExists) {
    const patchRes = await githubFetch(`/repos/${ownerEnc}/${repoEnc}/git/refs/heads/${branchEnc}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitSha, force: false }),
    });
    if (!patchRes.ok) {
      const hint =
        patchRes.status === 422
          ? ' (Branch changed remotely during upload; retry once or use a new branch name.)'
          : patchRes.status === 403
            ? ' (Branch may be protected by repository rules.)'
            : '';
      throw new Error(
        `Failed updating branch ${branch}: ${patchRes.data?.message ?? `HTTP ${patchRes.status}`}${hint}`
      );
    }
  } else {
    const createRefRes = await githubFetch(`/repos/${ownerEnc}/${repoEnc}/git/refs`, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: commitSha,
      }),
    });
    if (!createRefRes.ok) {
      throw new Error(
        `Failed creating branch ${branch}: ${createRefRes.data?.message ?? `HTTP ${createRefRes.status}`}`
      );
    }
  }

  return {
    ok: true,
    owner,
    repo,
    branch,
    filesUploaded: files.length,
    commitSha,
    repoUrl: `https://github.com/${ownerEnc}/${repoEnc}`,
    commitUrl: `https://github.com/${ownerEnc}/${repoEnc}/commit/${encodeURIComponent(commitSha)}`,
    repoCreated,
  };
}
