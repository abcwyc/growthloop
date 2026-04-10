'use client';

import { motion } from 'framer-motion';
import type { MarketSituation } from '@/lib/types';

interface Props {
  situation: MarketSituation;
}

const LAYER_ICONS: Record<string, string> = {
  '增量新用户': '🌱',
  '竞品活跃用户': '⚔️',
  '竞品不满用户': '🎯',
  '本品沉睡用户': '💤',
  '本品高价值用户': '💎',
};

const LAYER_COLORS: Record<string, { border: string; bg: string }> = {
  '增量新用户': { border: 'border-green-200', bg: 'bg-green-50' },
  '竞品活跃用户': { border: 'border-orange-200', bg: 'bg-orange-50' },
  '竞品不满用户': { border: 'border-red-200', bg: 'bg-red-50' },
  '本品沉睡用户': { border: 'border-slate-200', bg: 'bg-slate-50' },
  '本品高价值用户': { border: 'border-purple-200', bg: 'bg-purple-50' },
};

const IMPACT_COLORS: Record<string, string> = {
  '高': 'bg-red-100 text-red-700',
  '中': 'bg-amber-100 text-amber-700',
  '低': 'bg-slate-100 text-slate-600',
};

export default function MarketSituationTab({ situation }: Props) {
  return (
    <div className="space-y-6">
      {/* User Segments */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">五层用户分析</h3>
        <div className="space-y-3">
          {situation.user_segments.map((seg, idx) => {
            const colors = LAYER_COLORS[seg.layer] || LAYER_COLORS['增量新用户'];
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
                className={`card p-4 border-l-4 ${colors.border}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{LAYER_ICONS[seg.layer] || '📊'}</span>
                  <h4 className="text-sm font-bold text-slate-900">{seg.layer}</h4>
                  <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
                    优先级 P{seg.priority}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs mt-2">
                  <div>
                    <span className="text-slate-400">用户特征</span>
                    <p className="text-slate-700 mt-0.5">{seg.description}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">规模估算</span>
                    <p className="text-slate-700 mt-0.5 font-medium">{seg.scale_estimate}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">战略意义</span>
                    <p className="text-slate-700 mt-0.5">{seg.strategic_value}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Market Assessment */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card p-5"
      >
        <h3 className="text-sm font-semibold text-slate-700 mb-3">增量 vs 存量判断</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <span className="text-[10px] text-blue-500 uppercase tracking-wider">市场增长阶段</span>
            <p className="text-lg font-bold text-blue-900 mt-1">{situation.market_assessment.growth_phase}</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg">
            <span className="text-[10px] text-indigo-500 uppercase tracking-wider">投入优先级</span>
            <p className="text-lg font-bold text-indigo-900 mt-1">{situation.market_assessment.incremental_vs_stock}</p>
          </div>
        </div>
        <div className="mt-3 px-3 py-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">判断依据：</span>
            {situation.market_assessment.rationale}
          </p>
        </div>
      </motion.div>

      {/* Timing Opportunities */}
      {situation.timing_opportunities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-sm font-semibold text-slate-700 mb-3">市场时机窗口</h3>
          <div className="space-y-2">
            {situation.timing_opportunities.map((opp, idx) => (
              <div key={idx} className="card p-3 flex items-start gap-3">
                <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${IMPACT_COLORS[opp.impact] || IMPACT_COLORS['中']}`}>
                  {opp.impact}影响
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium">{opp.opportunity}</p>
                  <p className="text-xs text-slate-500 mt-0.5">窗口期：{opp.window}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
