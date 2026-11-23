import React from 'react';

interface StatBarProps {
  label: string;
  homeValue: number;
  awayValue: number;
  suffix?: string;
  decimals?: number;
}

export const StatBar: React.FC<StatBarProps> = ({
  label,
  homeValue,
  awayValue,
  suffix = '',
  decimals = 0,
}) => {
  const total = homeValue + awayValue;
  const homePct = total > 0 ? Math.round((homeValue / total) * 100) : 50;
  const awayPct = 100 - homePct;
  const homeLeads = homeValue > awayValue;
  const awayLeads = awayValue > homeValue;

  const formatVal = (v: number) => `${decimals > 0 ? v.toFixed(decimals) : v}${suffix}`;

  return (
    <div className="space-y-2 py-2.5">
      <div className="flex items-center justify-between text-sm">
        <span
          className={`font-mono tabular-nums font-semibold ${
            homeLeads ? 'text-[#22FF66]' : 'text-slate-200'
          }`}
        >
          {formatVal(homeValue)}
        </span>
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <span
          className={`font-mono tabular-nums font-semibold ${
            awayLeads ? 'text-sky-400' : 'text-slate-200'
          }`}
        >
          {formatVal(awayValue)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 h-1.5" dir="ltr">
        <div className="flex-1 bg-white/[0.06] rounded-full overflow-hidden flex justify-end">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              homeLeads ? 'bg-[#22FF66]' : 'bg-slate-500'
            }`}
            style={{ width: `${homePct}%` }}
          />
        </div>
        <div className="flex-1 bg-white/[0.06] rounded-full overflow-hidden flex justify-start">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              awayLeads ? 'bg-sky-400' : 'bg-slate-500'
            }`}
            style={{ width: `${awayPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
