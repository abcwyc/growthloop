'use client';

import { motion } from 'framer-motion';
import type { TargetAudience } from '@/lib/types';

interface Props {
  audiences: TargetAudience[];
}

const PRIORITY_COLORS: Record<number, { border: string; badge: string }> = {
  1: { border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  2: { border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  3: { border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
};

export default function AudienceTab({ audiences }: Props) {
  return (
    <div className="space-y-4">
      {audiences.map((aud, idx) => {
        const colors = PRIORITY_COLORS[aud.priority] || PRIORITY_COLORS[3];
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className={`card p-5 border-l-4 ${colors.border}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colors.badge}`}>
                P{aud.priority}
              </span>
              <h4 className="text-sm font-bold text-slate-900">{aud.name}</h4>
              <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium ${
                aud.strategy_type === '截流' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}>
                {aud.strategy_type}策略
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-slate-400">人口属性</span>
                <p className="text-slate-700 mt-0.5">{aud.demographics}</p>
              </div>
              <div>
                <span className="text-slate-400">使用场景</span>
                <p className="text-slate-700 mt-0.5">{aud.scenario}</p>
              </div>
              <div>
                <span className="text-slate-400">核心动机</span>
                <p className="text-slate-700 mt-0.5">{aud.core_motivation}</p>
              </div>
              <div>
                <span className="text-slate-400">竞品关系</span>
                <p className="text-slate-700 mt-0.5">{aud.relation_to_competitor}</p>
              </div>
            </div>

            <div className="mt-3 p-2.5 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-400">核心传播信息</span>
              <p className="text-sm text-slate-800 font-medium mt-0.5">&ldquo;{aud.key_message}&rdquo;</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
