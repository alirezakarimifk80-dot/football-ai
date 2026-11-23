import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

interface DateStripProps {
  selectedDay: number; // -1, 0, 1
  onSelectDay: (day: number) => void;
  countsByDay: Record<number, number>;
}

export const DateStrip: React.FC<DateStripProps> = ({
  selectedDay,
  onSelectDay,
  countsByDay,
}) => {
  const { t, lang } = useLanguage();

  const days = [
    { offset: -1, label: t.common.yesterday, dateText: lang === 'fa' ? '۳۰ آبان' : 'Nov 21' },
    { offset: 0, label: t.common.today, dateText: lang === 'fa' ? '۱ آذر' : 'Nov 22' },
    { offset: 1, label: t.common.tomorrow, dateText: lang === 'fa' ? '۲ آذر' : 'Nov 23' },
  ];

  return (
    <div className="w-full max-w-full flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist">
      {days.map((d) => {
        const active = selectedDay === d.offset;
        const count = countsByDay[d.offset] ?? 0;
        return (
          <button
            key={d.offset}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelectDay(d.offset)}
            className={`min-h-[44px] px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2.5 whitespace-nowrap shrink-0 border ${
              active
                ? 'bg-[#22FF66] text-[#090B0E] border-[#22FF66] font-semibold'
                : 'bg-[#12161B] text-slate-300 border-white/[0.07] hover:bg-[#181D24] hover:text-white'
            }`}
          >
            <span>{d.label}</span>
            <span
              className={`text-[11px] sm:text-xs font-mono tabular-nums ${
                active ? 'text-[#090B0E]/80' : 'text-slate-500'
              }`}
            >
              {d.dateText} · {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
