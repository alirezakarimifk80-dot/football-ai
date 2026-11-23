import React from 'react';
import { Info, Radio } from 'lucide-react';
import type { DataSourceMode, LocalizedText } from '../../types/football';
import { useLanguage } from '../../i18n/LanguageContext';

interface DataSourceNoticeProps {
  dataSource: DataSourceMode;
  disclaimer: LocalizedText;
}

export const DataSourceNotice: React.FC<DataSourceNoticeProps> = ({ dataSource, disclaimer }) => {
  const { t, localize } = useLanguage();
  const isLive = dataSource === 'live';

  return (
    <div
      className={`w-full max-w-full flex items-start sm:items-center gap-2.5 py-2.5 px-3 sm:px-3.5 rounded-lg bg-[#12161B] border text-xs text-slate-400 ${
        isLive ? 'border-[#22FF66]/20' : 'border-white/[0.06]'
      }`}
    >
      {isLive ? (
        <Radio className="h-4 w-4 text-[#22FF66] shrink-0 mt-0.5 sm:mt-0" />
      ) : (
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
      )}
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-relaxed break-words">
        <span className={`font-semibold whitespace-nowrap ${isLive ? 'text-[#22FF66]' : 'text-slate-200'}`}>
          {isLive ? t.common.liveFeedLabel : t.common.demoDataLabel}
        </span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span className="min-w-0 break-words">{localize(disclaimer)}</span>
      </div>
    </div>
  );
};
