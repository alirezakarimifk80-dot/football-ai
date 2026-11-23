import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { LocalizedText, Team } from '../../types/football';

type CrestTeamInput = Partial<
  Pick<Team, 'name' | 'shortName' | 'logo' | 'crestPrimary' | 'crestSecondary' | 'crestPattern'>
>;

interface TeamCrestProps {
  team?: CrestTeamInput;
  logoUrl?: string | null;
  alt?: string;
  fallbackLabel?: string;
  size?: number;
  className?: string;
}

function normalizeImageUrl(raw?: string | null): string | null {
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

function resolveAltText(alt?: string, name?: LocalizedText | string, fallback?: string): string {
  if (alt && alt.trim()) return alt.trim();
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (name && typeof name === 'object' && name.en) return name.en;
  return fallback || 'Club';
}

function deriveShortCode(team?: CrestTeamInput, fallbackLabel?: string, alt?: string): string {
  if (team?.shortName && team.shortName.trim()) {
    return team.shortName.trim().slice(0, 3).toUpperCase();
  }
  if (fallbackLabel && fallbackLabel.trim()) {
    return fallbackLabel.trim().slice(0, 3).toUpperCase();
  }
  const source =
    (typeof team?.name === 'string' ? team.name : team?.name?.en) ?? alt ?? 'FC';
  const cleaned = source.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  return (cleaned.slice(0, 3) || 'FC').toUpperCase();
}

export const TeamCrest: React.FC<TeamCrestProps> = ({
  team,
  logoUrl,
  alt,
  fallbackLabel,
  size = 28,
  className = '',
}) => {
  const uid = useId();
  const imgRef = useRef<HTMLImageElement | null>(null);

  const resolvedUrl = useMemo(
    () => normalizeImageUrl(logoUrl ?? team?.logo ?? null),
    [logoUrl, team?.logo]
  );

  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>(
    resolvedUrl ? 'loading' : 'error'
  );

  useEffect(() => {
    if (!resolvedUrl) {
      setImgStatus('error');
      return;
    }

    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setImgStatus('loaded');
    } else {
      setImgStatus('loading');
    }
  }, [resolvedUrl]);

  const shortCode = deriveShortCode(team, fallbackLabel, alt);
  const altLabel = resolveAltText(alt, team?.name, shortCode);
  const hasExplicitSizing = /\b(?:w|h|size)-/.test(className);
  const sizeStyle = hasExplicitSizing ? undefined : { width: size, height: size };

  // Render authentic club logo image when a valid URL is available and has not errored
  if (resolvedUrl && imgStatus !== 'error') {
    return (
      <span
        style={sizeStyle}
        className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      >
        {imgStatus === 'loading' && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-white/[0.08] animate-pulse"
          />
        )}
        <img
          key={resolvedUrl}
          ref={imgRef}
          src={resolvedUrl}
          alt={`${altLabel} logo`}
          width={size}
          height={size}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImgStatus('loaded')}
          onError={() => setImgStatus('error')}
          className={`w-full h-full object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-opacity duration-200 ${
            imgStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </span>
    );
  }

  // Graceful fallback crest when logo URL is unavailable or fails to load
  const clipId = `crest-${shortCode}-${uid}`;
  const primary = team?.crestPrimary ?? '#1E252E';
  const secondary = team?.crestSecondary ?? '#334155';
  const pattern = team?.crestPattern ?? 'solid';
  const isLightPrimary =
    primary.toUpperCase() === '#F8FAFC' || primary.toUpperCase() === '#FFFFFF';

  return (
    <span
      style={sizeStyle}
      role="img"
      aria-label={`${altLabel} crest fallback`}
      className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
        className="w-full h-full"
      >
        <defs>
          <clipPath id={clipId}>
            <path d="M18 2.5L31 7.2V17.4C31 25.1 25.4 30.8 18 33.5C10.6 30.8 5 25.1 5 17.4V7.2L18 2.5Z" />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <rect x="4" y="2" width="28" height="32" fill={primary} />
          {pattern === 'halves' && (
            <rect x="18" y="2" width="14" height="32" fill={secondary} />
          )}
          {pattern === 'stripes' && (
            <>
              <rect x="9" y="2" width="4.5" height="32" fill={secondary} />
              <rect x="18" y="2" width="4.5" height="32" fill={secondary} />
              <rect x="27" y="2" width="4.5" height="32" fill={secondary} />
            </>
          )}
          {pattern === 'sash' && (
            <path d="M3 29L28 2H34L9 34H3V29Z" fill={secondary} opacity="0.9" />
          )}
          {pattern === 'hoops' && (
            <>
              <rect x="4" y="9" width="28" height="5" fill={secondary} />
              <rect x="4" y="20" width="28" height="5" fill={secondary} />
            </>
          )}
          <rect x="4" y="13" width="28" height="10" fill="#090B0E" fillOpacity="0.65" />
        </g>

        <path
          d="M18 2.5L31 7.2V17.4C31 25.1 25.4 30.8 18 33.5C10.6 30.8 5 25.1 5 17.4V7.2L18 2.5Z"
          stroke={isLightPrimary ? '#94A3B8' : 'rgba(255,255,255,0.22)'}
          strokeWidth="1.4"
        />
        <text
          x="18"
          y="20.6"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="8.2"
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
        >
          {shortCode}
        </text>
      </svg>
    </span>
  );
};
