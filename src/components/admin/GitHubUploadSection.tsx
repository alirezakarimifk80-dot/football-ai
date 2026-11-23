import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  Terminal,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const GITHUB_CLASSIC_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=repo&description=Football+AI+Deploy';
const GITHUB_FINE_GRAINED_TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new';

type GitHubTokenType = 'classic' | 'fine-grained' | 'oauth' | 'unknown';
type GitHubTokenSource = 'session' | 'env' | null;

interface GitHubStatusResponse {
  availableInRuntime: boolean;
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

interface GitHubDiagnosticCheck {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  labelEn: string;
  labelFa: string;
  detailEn: string;
  detailFa: string;
}

interface GitHubDiagnosticsResponse {
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

interface AdminAuthStatusResponse {
  mode: 'env' | 'claimed' | 'unclaimed';
}

interface GitHubPushResponse {
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

function isSafeGitHubUrl(raw: string): boolean {
  return raw.startsWith('https://github.com/');
}

function formatTokenTypeLabel(type: GitHubTokenType | null, isFa: boolean): string {
  if (!type) return '';
  if (type === 'classic') return isFa ? 'توکن کلاسیک (ghp_)' : 'Classic PAT';
  if (type === 'fine-grained') return isFa ? 'توکن Fine-Grained' : 'Fine-Grained PAT';
  if (type === 'oauth') return 'OAuth';
  return isFa ? 'توکن سفارشی' : 'Custom';
}

function buildPreUnlockDiagnostics(
  gh: GitHubStatusResponse,
  owner: string,
  repo: string,
  branch: string
): GitHubDiagnosticsResponse {
  const checks: GitHubDiagnosticCheck[] = [];
  const recommendationsEn: string[] = [];
  const recommendationsFa: string[] = [];
  const totalMb = ((gh.totalSizeBytes || 0) / (1024 * 1024)).toFixed(2);

  checks.push({
    id: 'runtime',
    status: gh.availableInRuntime ? 'pass' : 'fail',
    labelEn: 'Server Workspace Runtime',
    labelFa: 'محیط سرور و فایل‌های پروژه',
    detailEn: gh.availableInRuntime
      ? 'Node.js workspace active with direct access to source files.'
      : 'Running on compiled Edge deployment without source files.',
    detailFa: gh.availableInRuntime
      ? 'سرور Node.js فعال است و به سورس تمیز پروژه دسترسی دارد.'
      : 'نسخه منتشرشده روی کلادفلر دسترسی به فایل‌های سورس ندارد.',
  });

  if (gh.availableInRuntime) {
    checks.push({
      id: 'files',
      status: gh.fileCount > 0 ? 'pass' : 'fail',
      labelEn: 'Project Source Files',
      labelFa: 'فایل‌های سورس آماده آپلود',
      detailEn: `${gh.fileCount} clean files (${totalMb} MB). .env, secrets, node_modules & dist automatically excluded.`,
      detailFa: `${gh.fileCount} فایل تمیز (${totalMb} مگابایت). فایل‌های .env، کلیدها، node_modules و dist به‌طور خودکار حذف شده‌اند.`,
    });

    if (!gh.tokenConfigured) {
      checks.push({
        id: 'token',
        status: 'fail',
        labelEn: 'GitHub Personal Access Token',
        labelFa: 'توکن دسترسی گیت‌هاب',
        detailEn: 'No GitHub token connected yet. Unlock Step 1 and paste your token in the GitHub Token field below.',
        detailFa: 'هنوز توکن گیت‌هاب متصل نشده است. قفل مرحله ۱ را باز کنید و توکن را در کادر توکن گیت‌هاب وارد کنید.',
      });
      recommendationsEn.push(
        'Unlock Step 1 (Admin Passcode), click "Get GitHub Token", paste your ghp_ token into the token field, and click "Connect Token".'
      );
      recommendationsFa.push(
        'ابتدا قفل ادمین (مرحله ۱) را باز کنید، روی «دریافت توکن گیت‌هاب» بزنید، توکن را در کادر وارد کرده و «اتصال توکن» را بزنید.'
      );
    } else if (!gh.authenticatedUser) {
      checks.push({
        id: 'token',
        status: 'fail',
        labelEn: 'GitHub API Authentication',
        labelFa: 'احراز هویت توکن در گیت‌هاب',
        detailEn: gh.statusNote || 'GitHub rejected the configured token.',
        detailFa: gh.statusNote
          ? `توکن رد شد: ${gh.statusNote}`
          : 'توکن تنظیم‌شده در گیت‌هاب معتبر نیست یا منقضی شده است.',
      });
      recommendationsEn.push(
        'Generate a new token via "Get GitHub Token" and connect it in the token field.'
      );
      recommendationsFa.push(
        'یک توکن جدید از دکمه «دریافت توکن گیت‌هاب» بگیرید و در کادر توکن وارد و متصل کنید.'
      );
    } else {
      checks.push({
        id: 'auth',
        status: 'pass',
        labelEn: 'GitHub API Authentication',
        labelFa: 'احراز هویت توکن در گیت‌هاب',
        detailEn: `Authenticated as @${gh.authenticatedUser}${gh.scopes.length ? ` · scopes: ${gh.scopes.join(', ')}` : ''}`,
        detailFa: `متصل به حساب @${gh.authenticatedUser}${gh.scopes.length ? ` · دسترسی‌ها: ${gh.scopes.join(', ')}` : ''}`,
      });

      checks.push({
        id: 'repository',
        status: 'warn',
        labelEn: 'Target Repository Write Check',
        labelFa: 'بررسی دسترسی نوشتن روی مخزن هدف',
        detailEn: 'Unlock Step 1 (Admin Passcode) and run diagnostics again to inspect target repository & branch permissions.',
        detailFa: 'برای تست دسترسی نوشتن روی مخزن و شاخه هدف، ابتدا قفل ادمین (مرحله ۱) را باز کنید و دوباره اشکال‌زدایی را بزنید.',
      });
      recommendationsEn.push('Unlock Admin Verification (Step 1) to run the repository & branch write check.');
      recommendationsFa.push('برای تست کامل مخزن هدف و فعال شدن دکمه آپلود، قفل امنیتی ادمین (مرحله ۱) را باز کنید.');
    }
  }

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');

  return {
    overallStatus: hasFail ? 'error' : hasWarn ? 'warning' : 'ready',
    checkedAtUtc: new Date().toISOString(),
    tokenConfigured: gh.tokenConfigured,
    tokenSource: gh.tokenSource,
    tokenType: gh.tokenType,
    authenticatedUser: gh.authenticatedUser,
    scopes: gh.scopes,
    rateLimit:
      gh.rateLimitRemaining !== null && gh.rateLimitLimit !== null
        ? { remaining: gh.rateLimitRemaining, limit: gh.rateLimitLimit }
        : null,
    target: {
      owner: owner.trim() || gh.defaultOwner || '',
      repo: repo.trim() || gh.defaultRepo || 'football-ai',
      branch: branch.trim() || gh.defaultBranch || 'main',
    },
    fileCount: gh.fileCount,
    totalSizeBytes: gh.totalSizeBytes || 0,
    checks,
    recommendationsEn,
    recommendationsFa,
  };
}

export const GitHubUploadSection: React.FC = () => {
  const { lang } = useLanguage();
  const isFa = lang === 'fa';

  const [status, setStatus] = useState<GitHubStatusResponse | null>(null);
  const [authMode, setAuthMode] = useState<'env' | 'claimed' | 'unclaimed'>('unclaimed');
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Admin Bearer session kept strictly in React memory (never persisted to storage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Ephemeral GitHub token input (sent over Bearer to server RAM, cleared immediately on connect)
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenText, setShowTokenText] = useState(false);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);

  // Push form fields (non-secret metadata only)
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('football-ai');
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState(
    'Deploy Football AI (Live World & Iran Football + Cloudflare Pages)'
  );
  const [createRepoIfMissing, setCreateRepoIfMissing] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);

  // Diagnostics state
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagReport, setDiagReport] = useState<GitHubDiagnosticsResponse | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<GitHubPushResponse | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const loadStatus = useCallback(
    async (forceRefresh = false, bearerOverride?: string | null): Promise<GitHubStatusResponse | null> => {
      setLoadingStatus(true);
      let latestGh: GitHubStatusResponse | null = null;
      const effectiveBearer = bearerOverride !== undefined ? bearerOverride : adminToken;
      try {
        const statusUrl = forceRefresh
          ? '/api/admin/github/status?refresh=1'
          : '/api/admin/github/status';
        const headers: Record<string, string> = {};
        if (effectiveBearer) {
          headers.Authorization = `Bearer ${effectiveBearer}`;
        }
        const [ghRes, authRes] = await Promise.all([
          fetch(statusUrl, { headers }),
          fetch('/api/admin/auth/status'),
        ]);
        if (ghRes.ok) {
          const ghData = (await ghRes.json()) as GitHubStatusResponse;
          latestGh = ghData;
          setStatus(ghData);
          setOwner((prev) => prev || ghData.defaultOwner || '');
          setRepo((prev) => prev || ghData.defaultRepo || 'football-ai');
          setBranch((prev) => prev || ghData.defaultBranch || 'main');
        }
        if (authRes.ok) {
          const authData = (await authRes.json()) as AdminAuthStatusResponse;
          setAuthMode(authData.mode);
        }
      } catch {
        // Handled by null status state
      } finally {
        setLoadingStatus(false);
      }
      return latestGh;
    },
    [adminToken]
  );

  useEffect(() => {
    void loadStatus(false);
  }, [loadStatus]);

  const connectGitHubTokenWithBearer = useCallback(
    async (bearer: string, rawToken: string): Promise<GitHubStatusResponse | null> => {
      const trimmed = rawToken.trim();
      if (!trimmed) {
        setTokenError(
          isFa
            ? 'لطفاً ابتدا توکن گیت‌هاب خود (شروع با ghp_ یا github_pat_) را در کادر وارد کنید.'
            : 'Please paste your GitHub Personal Access Token first.'
        );
        return null;
      }

      setTokenBusy(true);
      setTokenError(null);
      setTokenSuccess(null);

      try {
        const res = await fetch('/api/admin/github/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          body: JSON.stringify({ token: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setAdminToken(null);
          setTokenError(
            isFa
              ? 'نشست ادمین منقضی شد. لطفاً دوباره رمز ادمین را وارد کنید.'
              : 'Admin session expired. Please unlock again.'
          );
          return null;
        }
        if (!res.ok || !data.ok || !data.status) {
          setTokenError(
            typeof data.error === 'string'
              ? data.error
              : isFa
                ? 'توکن گیت‌هاب تأیید نشد.'
                : 'Could not verify GitHub token.'
          );
          return null;
        }

        const nextStatus = data.status as GitHubStatusResponse;
        setStatus(nextStatus);
        if (nextStatus.defaultOwner) {
          setOwner((prev) => prev || nextStatus.defaultOwner);
        }
        // Immediately wipe token from browser input/state once bound to server session RAM
        setTokenInput('');
        setShowTokenText(false);
        setTokenSuccess(
          isFa
            ? `توکن با موفقیت به حساب @${nextStatus.authenticatedUser} متصل شد.`
            : `Token verified and connected as @${nextStatus.authenticatedUser}.`
        );
        return nextStatus;
      } catch {
        setTokenError(isFa ? 'خطای شبکه هنگام بررسی توکن.' : 'Network error verifying token.');
        return null;
      } finally {
        setTokenBusy(false);
      }
    },
    [isFa]
  );

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      const endpoint =
        authMode === 'unclaimed' ? '/api/admin/auth/claim' : '/api/admin/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        setAuthError(
          typeof data.error === 'string'
            ? data.error
            : isFa
              ? 'تأیید رمز ادمین ناموفق بود.'
              : 'Admin verification failed.'
        );
        return;
      }
      const newBearer = String(data.token);
      setAdminToken(newBearer);
      setAuthMode(data.mode === 'env' ? 'env' : 'claimed');
      setPasscodeInput('');

      // If user already pasted a GitHub token before unlocking Step 1, auto-connect it right away
      if (tokenInput.trim()) {
        await connectGitHubTokenWithBearer(newBearer, tokenInput);
      } else {
        await loadStatus(false, newBearer);
      }
    } catch {
      setAuthError(isFa ? 'خطا در ارتباط با سرور.' : 'Unable to reach server.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) {
      setTokenError(
        isFa
          ? 'برای امنیت توکن، ابتدا رمز ادمین مرحله ۱ را در کادر بالا وارد و قفل را باز کنید (توکن شما پس از باز شدن قفل خودکار متصل می‌شود).'
          : 'Please unlock Admin Verification (Step 1) above first — your pasted token will connect automatically.'
      );
      return;
    }
    await connectGitHubTokenWithBearer(adminToken, tokenInput);
  };

  const handleDisconnectToken = async () => {
    if (!adminToken) return;
    setTokenBusy(true);
    setTokenError(null);
    setTokenSuccess(null);
    try {
      const res = await fetch('/api/admin/github/token', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status) {
        setStatus(data.status as GitHubStatusResponse);
        setDiagReport(null);
        setTokenSuccess(
          isFa
            ? 'توکن از حافظه موقت سرور پاک شد.'
            : 'Session GitHub token cleared from server memory.'
        );
      }
    } catch {
      setTokenError(isFa ? 'خطا در پاک کردن توکن.' : 'Failed to clear session token.');
    } finally {
      setTokenBusy(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setDiagnosing(true);
    setDiagError(null);
    try {
      if (!adminToken) {
        const fresh = await loadStatus(true, null);
        if (!fresh) {
          setDiagError(
            isFa ? 'عدم دسترسی به وضعیت سرور گیت‌هاب.' : 'Unable to reach GitHub status endpoint.'
          );
          return;
        }
        setDiagReport(buildPreUnlockDiagnostics(fresh, owner, repo, branch));
        return;
      }

      // If user typed a token in the box without clicking Connect yet, connect it seamlessly first
      if (tokenInput.trim()) {
        const connected = await connectGitHubTokenWithBearer(adminToken, tokenInput);
        if (!connected) {
          return;
        }
      }

      const res = await fetch('/api/admin/github/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          owner: owner.trim(),
          repo: repo.trim(),
          branch: branch.trim() || 'main',
          createRepoIfMissing,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setAdminToken(null);
        setDiagError(
          isFa
            ? 'نشست ادمین منقضی شد. لطفاً دوباره رمز ادمین را وارد کنید.'
            : 'Admin session expired. Please unlock again.'
        );
        return;
      }
      if (!res.ok) {
        setDiagError(
          typeof data.error === 'string'
            ? data.error
            : isFa
              ? 'خطا در اجرای اشکال‌زدایی گیت‌هاب.'
              : 'GitHub diagnostics failed.'
        );
        return;
      }
      setDiagReport(data as GitHubDiagnosticsResponse);
      void loadStatus(false, adminToken);
    } catch {
      setDiagError(
        isFa ? 'خطای شبکه هنگام اجرای اشکال‌زدایی.' : 'Network error while running diagnostics.'
      );
    } finally {
      setDiagnosing(false);
    }
  };

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) {
      setPushError(
        isFa
          ? 'ابتدا قفل امنیتی ادمین را در مرحله ۱ باز کنید.'
          : 'Please unlock admin verification in Step 1 first.'
      );
      return;
    }

    setPushing(true);
    setPushError(null);
    setPushResult(null);

    try {
      // If user pasted a token in the box and clicked Upload directly, connect it first
      if (tokenInput.trim()) {
        const connected = await connectGitHubTokenWithBearer(adminToken, tokenInput);
        if (!connected) {
          setPushError(
            isFa
              ? 'توکن واردشده تأیید نشد. خطای کادر توکن بالا را بررسی کنید.'
              : 'The pasted GitHub token could not be verified. Check the error above.'
          );
          return;
        }
      }

      const res = await fetch('/api/admin/github/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          owner: owner.trim(),
          repo: repo.trim(),
          branch: branch.trim() || 'main',
          commitMessage: commitMessage.trim(),
          createRepoIfMissing,
          isPrivate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setAdminToken(null);
        setPushError(
          isFa
            ? 'نشست ادمین منقضی شد. لطفاً دوباره رمز ادمین را وارد کنید.'
            : 'Admin session expired. Please unlock again.'
        );
        return;
      }
      if (!res.ok || !data.ok) {
        setPushError(
          typeof data.error === 'string'
            ? data.error
            : isFa
              ? 'آپلود به گیت‌هاب با خطا مواجه شد.'
              : 'GitHub upload failed.'
        );
        return;
      }
      setPushResult(data as GitHubPushResponse);
    } catch {
      setPushError(
        isFa ? 'خطای شبکه هنگام ارسال به سرور.' : 'Network error while uploading to GitHub.'
      );
    } finally {
      setPushing(false);
    }
  };

  const handleCopyCli = async () => {
    try {
      await navigator.clipboard.writeText('bash scripts/github-push.sh');
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  const hasValidTokenOrPendingInput =
    (Boolean(status?.tokenConfigured) && Boolean(status?.authenticatedUser)) ||
    tokenInput.trim().length >= 10;

  const canPush =
    Boolean(status?.availableInRuntime) &&
    Boolean(adminToken) &&
    hasValidTokenOrPendingInput &&
    repo.trim().length > 0 &&
    !pushing &&
    !tokenBusy;

  const missingStepsFa: string[] = [];
  const missingStepsEn: string[] = [];
  if (status?.availableInRuntime) {
    if (!adminToken) {
      missingStepsFa.push('۱) باز کردن قفل ادمین (مرحله ۱)');
      missingStepsEn.push('1) Unlock Admin Verification (Step 1)');
    }
    if (!hasValidTokenOrPendingInput) {
      missingStepsFa.push('۲) وارد کردن توکن گیت‌هاب (مرحله ۲)');
      missingStepsEn.push('2) Paste & connect your GitHub Token (Step 2)');
    }
    if (!repo.trim()) {
      missingStepsFa.push('وارد کردن نام مخزن');
      missingStepsEn.push('Enter repository name');
    }
  }

  return (
    <section
      id="github-upload-section"
      className="rounded-2xl bg-[#12161B] border border-white/[0.08] p-4 sm:p-5 space-y-4 min-w-0 overflow-hidden"
    >
      {/* Header Row with Get Token + Diagnose + Check Status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <UploadCloud className="h-5 w-5 text-[#22FF66] shrink-0" />
            <span>{isFa ? 'آپلود مستقیم پروژه روی گیت‌هاب' : 'Direct Upload to GitHub'}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isFa
              ? 'سورس تمیز پروژه (بدون .env و node_modules) به‌صورت مستقیم از سرور روی مخزن گیت‌هاب شما آپلود می‌شود تا بلافاصله به Cloudflare Pages متصل شود.'
              : 'Pushes the clean project source tree (excluding .env and node_modules) directly from the server to your GitHub repository for instant Cloudflare Pages deployment.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={GITHUB_CLASSIC_TOKEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#22FF66]/15 border border-[#22FF66]/45 hover:bg-[#22FF66] hover:text-[#090B0E] text-xs font-semibold text-[#22FF66] inline-flex items-center gap-1.5 transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{isFa ? 'دریافت توکن گیت‌هاب' : 'Get GitHub Token'}</span>
            <ExternalLink className="h-3 w-3 opacity-80" />
          </a>

          <button
            type="button"
            onClick={() => void handleRunDiagnostics()}
            disabled={diagnosing || loadingStatus}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#090B0E] border border-cyan-500/35 hover:border-cyan-400 text-xs font-medium text-cyan-300 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
          >
            {diagnosing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Stethoscope className="h-3.5 w-3.5" />
            )}
            <span>{isFa ? 'اشکال‌زدایی اتصال' : 'Run Diagnostics'}</span>
          </button>

          <button
            type="button"
            onClick={() => void loadStatus(true)}
            disabled={loadingStatus}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#090B0E] border border-white/[0.08] hover:border-white/[0.18] text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            <span>{isFa ? 'بررسی وضعیت' : 'Check Status'}</span>
          </button>
        </div>
      </div>

      {/* Status Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1">
          <div className="text-[11px] text-slate-400">
            {isFa ? 'وضعیت توکن گیت‌هاب' : 'GitHub Token Status'}
          </div>
          <div
            className={`text-sm font-semibold ${
              status?.tokenConfigured && status?.authenticatedUser
                ? 'text-[#22FF66]'
                : 'text-amber-400'
            }`}
          >
            {loadingStatus
              ? isFa
                ? 'در حال بررسی...'
                : 'Checking...'
              : status?.tokenConfigured && status?.authenticatedUser
                ? isFa
                  ? `متصل (@${status.authenticatedUser})`
                  : `Connected (@${status.authenticatedUser})`
                : status?.tokenConfigured
                  ? isFa
                    ? 'توکن نامعتبر یا منقضی است'
                    : 'Token invalid or expired'
                  : isFa
                    ? 'هنوز متصل نشده'
                    : 'Not connected'}
          </div>
          {status?.tokenType && (
            <div className="text-[11px] text-slate-400 font-mono">
              {formatTokenTypeLabel(status.tokenType, isFa)}
              {status.tokenSource === 'session'
                ? isFa
                  ? ' · نشست فعلی'
                  : ' · Session'
                : status.tokenSource === 'env'
                  ? isFa
                    ? ' · سرور'
                    : ' · Server Env'
                  : ''}
              {status.scopes.length > 0 ? ` · ${status.scopes.join(', ')}` : ''}
            </div>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1">
          <div className="text-[11px] text-slate-400">
            {isFa ? 'فایل‌های تمیز آماده آپلود' : 'Clean Files Ready'}
          </div>
          <div className="text-sm font-mono font-bold tabular-nums text-white">
            {status?.availableInRuntime
              ? isFa
                ? `${status.fileCount} فایل (${((status.totalSizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB)`
                : `${status.fileCount} files (${((status.totalSizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB)`
              : '—'}
          </div>
          {status?.rateLimitRemaining !== null && status?.rateLimitLimit !== null && status && (
            <div className="text-[11px] text-slate-400 font-mono tabular-nums">
              {isFa
                ? `سهمیه API: ${status.rateLimitRemaining}/${status.rateLimitLimit}`
                : `API Quota: ${status.rateLimitRemaining}/${status.rateLimitLimit}`}
            </div>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1">
          <div className="text-[11px] text-slate-400">
            {isFa ? 'قفل امنیتی ادمین' : 'Admin Verification'}
          </div>
          <div
            className={`text-sm font-semibold ${adminToken ? 'text-[#22FF66]' : 'text-slate-300'}`}
          >
            {adminToken
              ? isFa
                ? 'باز شد (آماده آپلود)'
                : 'Unlocked (Ready)'
              : authMode === 'unclaimed'
                ? isFa
                  ? 'نیاز به تنظیم اولیه'
                  : 'First-run setup needed'
                : isFa
                  ? 'قفل است'
                  : 'Locked'}
          </div>
        </div>
      </div>

      {/* Notice if running on Cloudflare Edge */}
      {status && !status.availableInRuntime && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            {isFa
              ? 'آپلود مستقیم سورس‌کد فقط از محیط توسعه (سرور Node / AI Studio) انجام می‌شود؛ روی نسخه منتشرشده کلادفلر فایل‌های سورس وجود ندارد.'
              : status.statusNote}
          </span>
        </div>
      )}

      {/* Step 1: Inline Admin Passcode Claim / Unlock (Bearer token stored in memory only) */}
      {status?.availableInRuntime && !adminToken && (
        <form
          onSubmit={handleAdminAuth}
          className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.08] space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Lock className="h-4 w-4 text-[#22FF66] shrink-0" />
            <span>
              {authMode === 'unclaimed'
                ? isFa
                  ? 'مرحله ۱: یک رمز ادمین انتخاب کنید (حداقل ۶ کاراکتر) تا اتصال توکن و آپلود محافظت شود'
                  : 'Step 1: Set an admin passcode (min 6 characters) to protect token connection & uploads'
                : isFa
                  ? 'مرحله ۱: رمز ادمین را وارد کنید تا بخش توکن و آپلود باز شود'
                  : 'Step 1: Enter admin passcode to unlock token connection & uploads'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="password"
              required
              minLength={6}
              maxLength={128}
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder={
                authMode === 'unclaimed'
                  ? isFa
                    ? 'رمز دلخواه ادمین (حداقل ۶ کاراکتر)'
                    : 'Choose admin passcode (min 6 chars)'
                  : isFa
                    ? 'رمز ادمین'
                    : 'Enter admin passcode'
              }
              className="flex-1 min-h-[42px] px-3 rounded-lg bg-[#12161B] border border-white/[0.12] text-sm text-white placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={authBusy}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-[#181D24] border border-[#22FF66]/45 text-[#22FF66] text-xs font-semibold hover:bg-[#22FF66] hover:text-[#090B0E] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2 shrink-0"
            >
              {authBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>
                {authMode === 'unclaimed'
                  ? isFa
                    ? 'ثبت رمز و باز کردن قفل'
                    : 'Set Passcode & Unlock'
                  : isFa
                    ? 'باز کردن قفل'
                    : 'Unlock'}
              </span>
            </button>
          </div>

          {authError && <p className="text-xs text-red-300">{authError}</p>}
        </form>
      )}

      {/* Step 2: Direct GitHub Token Input Box (Always visible in Node runtime) */}
      {status?.availableInRuntime && (
        <form
          onSubmit={handleConnectToken}
          className={`p-4 rounded-xl bg-[#090B0E] border space-y-3 ${
            status.tokenConfigured && status.authenticatedUser
              ? 'border-[#22FF66]/30'
              : 'border-amber-500/35'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <KeyRound className="h-4 w-4 text-[#22FF66] shrink-0" />
              <span>
                {isFa
                  ? 'مرحله ۲: توکن گیت‌هاب خود را اینجا وارد کنید (GitHub Personal Access Token)'
                  : 'Step 2: Paste Your GitHub Personal Access Token'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={GITHUB_CLASSIC_TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-[#22FF66] hover:underline inline-flex items-center gap-1"
              >
                <span>{isFa ? 'ساخت توکن کلاسیک (repo)' : 'Create Classic Token (repo)'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-slate-600">·</span>
              <a
                href={GITHUB_FINE_GRAINED_TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-slate-400 hover:text-white hover:underline inline-flex items-center gap-1"
              >
                <span>{isFa ? 'توکن Fine-Grained' : 'Fine-Grained'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {status.tokenConfigured && status.authenticatedUser && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#22FF66]/10 border border-[#22FF66]/25 text-xs">
              <div className="flex items-center gap-2 text-[#22FF66] font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  {isFa
                    ? `توکن متصل است: @${status.authenticatedUser} (${status.tokenSource === 'session' ? 'حافظه موقت سرور' : 'تنظیمات سرور'})`
                    : `Connected as @${status.authenticatedUser} (${status.tokenSource === 'session' ? 'server session RAM' : 'server Secrets'})`}
                </span>
              </div>
              {status.tokenSource === 'session' && adminToken && (
                <button
                  type="button"
                  onClick={() => void handleDisconnectToken()}
                  disabled={tokenBusy}
                  className="px-2.5 py-1 rounded-md bg-[#090B0E] border border-white/[0.12] hover:border-red-400/50 text-[11px] text-slate-300 hover:text-red-300 inline-flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{isFa ? 'قطع اتصال و پاک کردن توکن' : 'Disconnect Token'}</span>
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1 min-w-0">
              <input
                type={showTokenText ? 'text' : 'password'}
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  if (tokenError) setTokenError(null);
                }}
                placeholder={
                  status.tokenConfigured && status.authenticatedUser
                    ? isFa
                      ? 'برای تعویض توکن، توکن جدید (ghp_...) را اینجا وارد کنید'
                      : 'Optional: paste a new ghp_ or github_pat_ token to replace'
                    : 'ghp_xxxxxxxxxxxxxxxxxxxx  /  github_pat_xxxx'
                }
                className="w-full min-h-[42px] pl-3 pr-10 rounded-lg bg-[#12161B] border border-white/[0.14] focus:border-[#22FF66]/60 focus:outline-none text-sm text-white font-mono placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowTokenText((v) => !v)}
                aria-label={showTokenText ? 'Hide token' : 'Show token'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                {showTokenText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={tokenBusy || !tokenInput.trim()}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-[#22FF66] text-[#090B0E] text-xs font-bold hover:bg-[#3bff77] transition-colors disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shrink-0"
            >
              {tokenBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              <span>
                {tokenBusy
                  ? isFa
                    ? 'در حال بررسی توکن...'
                    : 'Verifying...'
                  : isFa
                    ? 'اتصال و تأیید توکن'
                    : 'Connect & Verify Token'}
              </span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isFa
              ? 'توکن شما پس از تأیید، فقط در حافظه موقت سرور (RAM) برای همین نشست ادمین نگهداری می‌شود، در هیچ فایلی یا حافظه مرورگر ذخیره نمی‌شود و بلافاصله پس از اتصال از این کادر پاک می‌شود.'
              : 'After verification, your token is held strictly in ephemeral server memory for this admin session only — never saved to disk or browser storage — and is cleared from this field immediately.'}
          </p>

          {tokenError && (
            <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
              {tokenError}
            </p>
          )}
          {tokenSuccess && (
            <p className="text-xs text-[#22FF66] bg-[#22FF66]/10 border border-[#22FF66]/25 rounded-lg px-3 py-2">
              {tokenSuccess}
            </p>
          )}
          {status.statusNote && !tokenError && (
            <p className="text-[11px] text-amber-300/90 font-mono break-words bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              {status.statusNote}
            </p>
          )}
        </form>
      )}

      {/* Diagnostics Result Panel */}
      {diagError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 leading-relaxed flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <span>{diagError}</span>
        </div>
      )}

      {diagReport && (
        <div
          className={`p-4 rounded-xl border space-y-3 ${
            diagReport.overallStatus === 'ready'
              ? 'bg-[#22FF66]/[0.06] border-[#22FF66]/35'
              : diagReport.overallStatus === 'warning'
                ? 'bg-amber-500/[0.06] border-amber-500/35'
                : 'bg-red-500/[0.06] border-red-500/35'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Stethoscope
                className={`h-4 w-4 shrink-0 ${
                  diagReport.overallStatus === 'ready'
                    ? 'text-[#22FF66]'
                    : diagReport.overallStatus === 'warning'
                      ? 'text-amber-400'
                      : 'text-red-400'
                }`}
              />
              <span>
                {diagReport.overallStatus === 'ready'
                  ? isFa
                    ? 'نتیجه اشکال‌زدایی: همه‌چیز آماده آپلود بدون خطاست'
                    : 'Diagnostics Passed: Ready for Clean GitHub Upload'
                  : diagReport.overallStatus === 'warning'
                    ? isFa
                      ? 'نتیجه اشکال‌زدایی: دارای هشدار (موارد زیر را بررسی کنید)'
                      : 'Diagnostics Completed with Warnings'
                    : isFa
                      ? 'نتیجه اشکال‌زدایی: مشکل پیدا شد (راهکار زیر را انجام دهید)'
                      : 'Diagnostics Found Issues to Fix'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400" dir="ltr">
              {diagReport.target.owner ? `${diagReport.target.owner}/` : ''}
              {diagReport.target.repo} ({diagReport.target.branch})
            </span>
          </div>

          <div className="space-y-2">
            {diagReport.checks.map((check) => (
              <div
                key={check.id}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#090B0E]/90 border border-white/[0.06]"
              >
                {check.status === 'pass' ? (
                  <CheckCircle2 className="h-4 w-4 text-[#22FF66] shrink-0 mt-0.5" />
                ) : check.status === 'warn' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-semibold text-white">
                    {isFa ? check.labelFa : check.labelEn}
                  </div>
                  <div className="text-[11px] text-slate-300 leading-relaxed break-words">
                    {isFa ? check.detailFa : check.detailEn}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(isFa ? diagReport.recommendationsFa : diagReport.recommendationsEn).length > 0 && (
            <div className="pt-1 space-y-1.5 border-t border-white/[0.08]">
              <div className="text-[11px] font-semibold text-amber-300">
                {isFa ? 'اقدامات پیشنهادی برای رفع مشکل:' : 'Recommended Fixes:'}
              </div>
              <ul className="text-xs text-slate-200 space-y-1 list-disc list-inside leading-relaxed">
                {(isFa ? diagReport.recommendationsFa : diagReport.recommendationsEn).map(
                  (rec, idx) => (
                    <li key={idx}>{rec}</li>
                  )
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Repository Target & Upload Button */}
      {status?.availableInRuntime && (
        <form onSubmit={handlePush} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">
                {isFa ? 'نام کاربری گیت‌هاب (اختیاری)' : 'GitHub Username (optional)'}
              </span>
              <input
                type="text"
                dir="ltr"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder={status.authenticatedUser || 'your-username'}
                className="w-full min-h-[42px] px-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white font-mono placeholder:text-slate-600"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-slate-400">
                {isFa ? 'نام مخزن (Repository)' : 'Repository Name'}
              </span>
              <input
                type="text"
                dir="ltr"
                required
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="football-ai"
                className="w-full min-h-[42px] px-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white font-mono placeholder:text-slate-600"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                <span>{isFa ? 'شاخه (Branch)' : 'Branch'}</span>
              </span>
              <input
                type="text"
                dir="ltr"
                required
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full min-h-[42px] px-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white font-mono placeholder:text-slate-600"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-slate-400">
              {isFa ? 'پیام کامیت (Commit Message)' : 'Commit Message'}
            </span>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              maxLength={160}
              className="w-full min-h-[42px] px-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white"
            />
          </label>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createRepoIfMissing}
                onChange={(e) => setCreateRepoIfMissing(e.target.checked)}
                className="h-4 w-4 rounded accent-[#22FF66]"
              />
              <span>
                {isFa ? 'در صورت نبود مخزن، خودکار ساخته شود' : 'Create repository if it does not exist'}
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 rounded accent-[#22FF66]"
              />
              <span>{isFa ? 'مخزن خصوصی (Private)' : 'Private repository'}</span>
            </label>
          </div>

          {/* Clear prerequisite hint when Upload button is disabled */}
          {!canPush && !pushing && (isFa ? missingStepsFa : missingStepsEn).length > 0 && (
            <div className="text-[11px] text-slate-400 leading-relaxed">
              <span className="text-amber-300 font-medium">
                {isFa ? 'پیش‌نیاز فعال شدن آپلود: ' : 'To enable Upload: '}
              </span>
              {(isFa ? missingStepsFa : missingStepsEn).join(' · ')}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="submit"
              disabled={!canPush}
              className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-lg bg-[#22FF66] text-[#090B0E] text-sm font-bold hover:bg-[#3bff77] transition-colors disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {pushing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              <span>
                {pushing
                  ? isFa
                    ? 'در حال آپلود فایل‌ها به گیت‌هاب...'
                    : 'Uploading files to GitHub...'
                  : isFa
                    ? 'آپلود مستقیم روی گیت‌هاب'
                    : 'Upload to GitHub'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyCli()}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-lg bg-[#090B0E] border border-white/[0.1] hover:border-white/[0.2] text-xs font-medium text-slate-300 inline-flex items-center justify-center gap-2 transition-colors"
            >
              {copiedCmd ? (
                <Check className="h-3.5 w-3.5 text-[#22FF66]" />
              ) : (
                <Terminal className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span className="font-mono">
                {copiedCmd
                  ? isFa
                    ? 'دستور کپی شد'
                    : 'Command copied'
                  : 'bash scripts/github-push.sh'}
              </span>
              {!copiedCmd && <Copy className="h-3.5 w-3.5 text-slate-500" />}
            </button>
          </div>
        </form>
      )}

      {/* Error Message */}
      {pushError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 leading-relaxed space-y-2">
          <div>{pushError}</div>
          <button
            type="button"
            onClick={() => void handleRunDiagnostics()}
            className="text-[11px] font-semibold text-cyan-300 hover:underline inline-flex items-center gap-1"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            <span>{isFa ? 'اجرای اشکال‌زدایی برای یافتن علت دقیق خطا' : 'Run diagnostics to find exact cause'}</span>
          </button>
        </div>
      )}

      {/* Success Banner */}
      {pushResult && (
        <div className="p-4 rounded-xl bg-[#22FF66]/10 border border-[#22FF66]/35 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#22FF66]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              {isFa
                ? `${pushResult.filesUploaded} فایل با موفقیت روی گیت‌هاب آپلود شد!`
                : `Successfully uploaded ${pushResult.filesUploaded} files to GitHub!`}
            </span>
          </div>
          <div className="text-xs text-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="font-mono">
              {pushResult.owner}/{pushResult.repo} ({pushResult.branch})
            </span>
            <span className="font-mono text-slate-400">
              SHA: {pushResult.commitSha.slice(0, 7)}
            </span>
            {pushResult.repoCreated && (
              <span className="text-[#22FF66]">
                {isFa ? 'مخزن جدید ساخته شد' : 'New repository created'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isSafeGitHubUrl(pushResult.repoUrl) && (
              <a
                href={pushResult.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22FF66] hover:underline"
              >
                <span>{isFa ? 'مشاهده مخزن در گیت‌هاب' : 'Open Repository on GitHub'}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {isSafeGitHubUrl(pushResult.commitUrl) && (
              <a
                href={pushResult.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white hover:underline"
              >
                <span>{isFa ? 'مشاهده کامیت' : 'View Commit'}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
