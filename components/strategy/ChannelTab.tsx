'use client';

import { motion } from 'framer-motion';
import type { ChannelMixItem } from '@/lib/types';

interface Props {
  channels: ChannelMixItem[];
  budgetTotal: number;
}

const ROLE_COLORS: Record<string, string> = {
  '认知种草': 'bg-pink-100 text-pink-700',
  '意向拦截': 'bg-purple-100 text-purple-700',
  '场景触达': 'bg-cyan-100 text-cyan-700',
  '效果转化': 'bg-orange-100 text-orange-700',
  '口碑沉淀': 'bg-green-100 text-green-700',
};

const BAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500',
];

export default function ChannelTab({ channels, budgetTotal }: Props) {
  const maxPct = Math.max(...channels.map(c => c.budget_pct), 1);

  return (
    <div className="space-y-5">
      {/* Budget bar chart */}
      <div className="card p-4">
        <h4 className="text-xs font-medium text-slate-500 mb-3">预算分配（总计 {budgetTotal} 万）</h4>
        <div className="space-y-2">
          {channels.map((ch, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-20 shrink-0 text-right">{ch.channel}</span>
              <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(ch.budget_pct / maxPct) * 100}%` }}
                  transition={{ duration: 0.6, delay: idx * 0.08 }}
                  className={`h-full rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                />
                <span className="absolute inset-0 flex items-center pl-2 text-[11px] font-medium text-white mix-blend-difference">
                  {ch.budget_pct}% ({ch.budget_amount}万)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Channel detail cards */}
      {channels.map((ch, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.06 }}
          className="card p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2.5 h-2.5 rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`} />
            <h4 className="text-sm font-bold text-slate-900">{ch.channel}</h4>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">{ch.channel_type}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[ch.role] || 'bg-slate-100 text-slate-500'}`}>
              {ch.role}
            </span>
            <span className="ml-auto text-sm font-bold text-slate-900">{ch.budget_pct}%</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400">预算金额</span>
              <p className="text-slate-700 font-medium">{ch.budget_amount} 万</p>
            </div>
            <div>
              <span className="text-slate-400">目标 KPI</span>
              <p className="text-slate-700 font-medium">{ch.target_kpi}</p>
            </div>
            <div>
              <span className="text-slate-400">创意方向</span>
              <p className="text-slate-600">{ch.creative_direction}</p>
            </div>
            <div>
              <span className="text-slate-400">覆盖人群</span>
              <p className="text-slate-600">{ch.audience_match.join('、')}</p>
            </div>
          </div>

          {ch.risk && (
            <div className="mt-2.5 px-2.5 py-1.5 bg-amber-50 rounded border border-amber-100">
              <p className="text-[11px] text-amber-700">
                <span className="font-medium">风险：</span>{ch.risk}
              </p>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
