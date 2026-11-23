import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MomentumPoint } from '../../types/football';

interface MomentumChartProps {
  data: MomentumPoint[];
  homeName: string;
  awayName: string;
}

export const MomentumChart: React.FC<MomentumChartProps> = ({ data, homeName, awayName }) => {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl bg-[#090B0E] border border-white/[0.06] p-6 text-center text-xs sm:text-sm text-slate-400">
        Minute-by-minute momentum &amp; xG timeline is not provided by the current live feed for this fixture. Check the Statistics tab for official live boxscore numbers.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 min-w-0" dir="ltr">
      {/* Attack Pressure Momentum */}
      <div className="space-y-2 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-400">
          <span className="font-medium text-slate-200 truncate">{homeName} vs {awayName} Pressure</span>
          <span className="font-mono tabular-nums text-[11px] text-[#22FF66] truncate">{homeName} (+) · {awayName} (-)</span>
        </div>
        <div className="h-52 w-full bg-[#090B0E] rounded-xl border border-white/[0.06] p-2.5 sm:p-3 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} stackOffset="sign">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="minute"
                tickFormatter={(v) => `${v}'`}
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[-100, 100]} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#12161B',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F1F5F9',
                }}
              />
              <Bar dataKey="homePressure" name={homeName} fill="#22FF66" radius={[3, 3, 0, 0]} />
              <Bar dataKey="awayPressure" name={awayName} fill="#38BDF8" radius={[0, 0, 3, 3]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cumulative xG Flow */}
      <div className="space-y-2 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-400">
          <span className="font-medium text-slate-200 truncate">Cumulative Expected Goals (xG)</span>
          <span className="font-mono tabular-nums text-[11px] text-slate-400">0&apos; – 90&apos;</span>
        </div>
        <div className="h-52 w-full bg-[#090B0E] rounded-xl border border-white/[0.06] p-2.5 sm:p-3 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="minute"
                tickFormatter={(v) => `${v}'`}
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#12161B',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F1F5F9',
                }}
              />
              <Area
                type="stepAfter"
                dataKey="homeXg"
                name={`${homeName} xG`}
                stroke="#22FF66"
                fill="#22FF66"
                fillOpacity={0.14}
                strokeWidth={2}
              />
              <Area
                type="stepAfter"
                dataKey="awayXg"
                name={`${awayName} xG`}
                stroke="#38BDF8"
                fill="#38BDF8"
                fillOpacity={0.14}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
