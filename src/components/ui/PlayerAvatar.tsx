import React, { useEffect, useMemo, useRef, useState } from 'react';

interface PlayerAvatarProps {
  name: string;
  photoUrl?: string | null;
  shirtNumber?: number;
  position?: string;
  size?: number;
  rounded?: 'full' | 'xl' | '2xl';
  accent?: 'neutral' | 'home' | 'away';
  className?: string;
}

function normalizePhotoUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') return parsed.toString();
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function deriveInitials(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  if (!cleaned) return 'PL';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  name,
  photoUrl,
  shirtNumber,
  position,
  size = 36,
  rounded = 'full',
  accent = 'neutral',
  className = '',
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const resolvedUrl = useMemo(() => normalizePhotoUrl(photoUrl), [photoUrl]);

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    resolvedUrl ? 'loading' : 'error'
  );

  useEffect(() => {
    if (!resolvedUrl) {
      setStatus('error');
      return;
    }
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setStatus('loaded');
    } else {
      setStatus('loading');
    }
  }, [resolvedUrl]);

  const hasExplicitSizing = /\b(?:w|h|size)-/.test(className);
  const sizeStyle = hasExplicitSizing ? undefined : { width: size, height: size };

  const radiusClass =
    rounded === '2xl' ? 'rounded-2xl' : rounded === 'xl' ? 'rounded-xl' : 'rounded-full';

  const borderClass =
    accent === 'home'
      ? 'border-[#22FF66]/55'
      : accent === 'away'
        ? 'border-sky-400/55'
        : 'border-white/[0.12]';

  const fallbackTextClass =
    accent === 'home'
      ? 'text-[#22FF66]'
      : accent === 'away'
        ? 'text-sky-300'
        : 'text-slate-200';

  const fallbackPrimary =
    typeof shirtNumber === 'number' && shirtNumber > 0
      ? `${shirtNumber}`
      : deriveInitials(name);

  const fontSizeClass =
    size >= 60 ? 'text-base sm:text-lg' : size >= 34 ? 'text-xs' : 'text-[10px]';

  return (
    <span
      style={sizeStyle}
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none bg-gradient-to-b from-[#1B222C] to-[#0B0E13] border ${borderClass} ${radiusClass} ${className}`}
    >
      {resolvedUrl && status !== 'error' ? (
        <>
          {status === 'loading' && (
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-white/[0.06] animate-pulse"
            />
          )}
          <img
            key={resolvedUrl}
            ref={imgRef}
            src={resolvedUrl}
            alt={name}
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
            className={`w-full h-full object-cover object-top transition-opacity duration-200 ${
              status === 'loaded' ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </>
      ) : (
        <span
          role="img"
          aria-label={name}
          className={`flex flex-col items-center justify-center leading-none font-mono font-bold tabular-nums ${fallbackTextClass} ${fontSizeClass}`}
        >
          <span>{typeof shirtNumber === 'number' && shirtNumber > 0 && size >= 52 ? `#${fallbackPrimary}` : fallbackPrimary}</span>
          {position && size >= 52 && (
            <span className="text-[10px] font-normal text-slate-400 mt-1">{position}</span>
          )}
        </span>
      )}
    </span>
  );
};
