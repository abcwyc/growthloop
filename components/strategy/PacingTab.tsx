'use client';

import { motion } from 'framer-motion';
import type { TimePacing } from '@/lib/types';

interface Props {
  pacing: TimePacing[];
  budgetTotal: number;
}

const PHASE_STYLES: Record<string, { bg: string; bar: string; text: string }> = {
  '测试期': { bg: 'bg-sky-50', bar: 'bg-sky-400', text: 'text-sky-700' },
  '放量期': { bg: 'bg-emerald-50', bar: 'bg-emerald-500', text: 'text-emerald-700' },
  '收尾期': { bg: 'bg-amber-50', bar: 'bg-amber-400', text: 'text-amber-700' },
};

export default function PacingTab({ pacing, budgetTotal }: Props) {
  const totalWeeks = pacing.reduce((sum, p) => {
    const match = p.weeks.match(/W(\d+).*?W?(\d+)/);
    if (match) return sum + (Number(match[2]) - Number(match[1]) + 1);
    return sum + 2;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Timeline bar */}
      <div className="card p-4">
        <h4 className="text-xs font-medium text-slate-500 mb-3">时间节奏概览</h4>
        <div className="flex h-10 rounded-lg overflow-hidden border border-slate-200">
          {pacing.map((p, idx) => {
            const style = PHASE_STYLES[p.phase] || PHASE_STYLES['测试期'];
            return (
              <motion.div
                key={idx}
                initial={{ width: 0 }}
                animate={{ width: `${p.budget_pct}%` }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className={`${style.bar} flex items-center justify-center relative`}
              >
                <span className="text-[11px] font-bold text-white">{p.phase} {p.budget_pct}%</span>
              </motion.div>
            );
          })}
        </div>
        <div className="flex mt-1">
          {pacing.map((p, idx) => (
            <div key={idx} style={{ width: `${p.budget_pct}%` }} className="text-center text-[10px] text-slate-400">
              {p.weeks}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-right">总周期约 {totalWeeks} 周</p>
      </div>

      {/* Phase detail cards */}
      {pacing.map((p, idx) => {
        const style = PHASE_STYLES[p.phase] || PHASE_STYLES['测试期'];
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`card p-4 border-l-4 ${style.bg}`}
            style={{ borderLeftColor: style.bar.replace('bg-', '').includes('sky') ? '#38bdf8' : style.bar.includes('emerald') ? '#10b981' : '#fbbf24' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <h4 className={`text-sm font-bold ${style.text}`}>{p.phase}</h4>
              <span className="text-xs text-slate-500">{p.weeks}</span>
              <span className="ml-auto text-sm font-bold text-slate-900">{p.budget_amount} 万 ({p.budget_pct}%)</span>
            </div>
            <p className="text-xs text-slate-600 mb-2">{p.objective}</p>
            {p.decision_gate && (
              <div className="px-2.5 py-1.5 bg-white/80 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400">决策关卡</span>
                <p className="text-xs text-slate-700 font-medium mt-0.5">{p.decision_gate}</p>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
