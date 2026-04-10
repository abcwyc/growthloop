'use client';

import { motion } from 'framer-motion';
import type { KeyAssumption } from '@/lib/types';

interface Props {
  assumptions: KeyAssumption[];
}

const RISK_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  '高': { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  '中': { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  '低': { dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
};

export default function AssumptionTab({ assumptions }: Props) {
  return (
    <div className="space-y-3">
      {assumptions.map((a, idx) => {
        const risk = RISK_STYLES[a.risk_level] || RISK_STYLES['中'];
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="card p-4"
          >
            <div className="flex items-start gap-3">
              <span className="text-sm font-bold text-slate-400 mt-0.5 w-5 shrink-0 text-right">
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-medium text-slate-900 flex-1">{a.statement}</p>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${risk.bg} ${risk.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                    风险{a.risk_level}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs mt-2">
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-400">假设依据</span>
                    <p className="text-slate-600 mt-0.5">{a.basis}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-400">风险说明</span>
                    <p className="text-slate-600 mt-0.5">{a.risk_note}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-400">验证方式</span>
                    <p className="text-slate-600 mt-0.5">{a.validation_method}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
