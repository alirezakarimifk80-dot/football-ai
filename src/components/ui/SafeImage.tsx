import React, { useState } from 'react';
import { Shield } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#12161B] via-[#181D24] to-[#090B0E] text-slate-500 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Shield className="h-7 w-7 text-[#22FF66]/40 mb-2" />
        {fallbackLabel && (
          <span className="text-xs text-slate-400 px-3 text-center truncate max-w-full">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
