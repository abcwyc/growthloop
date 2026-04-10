'use client';

import { motion } from 'framer-motion';
import type { CompetitionAnalysis } from '@/lib/types';

interface Props {
  analysis: CompetitionAnalysis;
}

const ZONE_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  '重点进攻': { bg: 'bg-red-50', text: 'text-red-700', icon: '🎯' },
  '快速补齐': { bg: 'bg-amber-50', text: 'text-amber-700', icon: '⚡' },
  '强化防守': { bg: 'bg-green-50', text: 'text-green-700', icon: '🛡️' },
  '暂缓投入': { bg: 'bg-slate-50', text: 'text-slate-600', icon: '⏭️' },
};

function ScoreBar({ score, maxScore = 10, color }: { score: number; maxScore?: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(score / maxScore) * 100}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-xs font-bold text-slate-700 w-5 text-right">{score}</span>
    </div>
  );
}

export default function CompetitionTab({ analysis }: Props) {
  return (
    <div className="space-y-6">
      {/* Competitor Matrix */}
      {analysis.competitor_matrix.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">竞品优劣势矩阵</h3>
          <div className="space-y-4">
            {analysis.competitor_matrix.map((comp, cIdx) => (
              <motion.div
                key={cIdx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cIdx * 0.1 }}
                className="card p-4"
              >
                <h4 className="text-sm font-bold text-slate-900 mb-3">vs {comp.name}</h4>
                <div className="space-y-2.5">
                  {comp.dimensions.map((dim, dIdx) => (
                    <div key={dIdx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600">{dim.dimension}</span>
                        <span className="text-[10px] text-slate-400">{dim.gap_analysis}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-slate-400">竞品</span>
                          <ScoreBar score={dim.competitor_score} color="bg-slate-400" />
                        </div>
                        <div>
                          <span className="text-[10px] text-blue-500">本品</span>
                          <ScoreBar
                            score={dim.own_score}
                            color={dim.own_score > dim.competitor_score ? 'bg-emerald-500' : dim.own_score < dim.competitor_score ? 'bg-red-400' : 'bg-blue-500'}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Targetable Users */}
      {analysis.targetable_users.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">可争夺用户画像</h3>
          <div className="space-y-3">
            {analysis.targetable_users.map((user, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="card p-4 border-l-4 border-red-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded font-medium">
                    来自 {user.source_competitor}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400">用户特征</span>
                    <p className="text-slate-700 mt-0.5">{user.user_profile}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">核心痛点</span>
                    <p className="text-red-700 mt-0.5 font-medium">{user.core_pain_point}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">迁移动因</span>
                    <p className="text-emerald-700 mt-0.5">{user.migration_driver}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">迁移阻力</span>
                    <p className="text-amber-700 mt-0.5">{user.migration_barrier}</p>
                  </div>
                </div>
                <div className="mt-2 px-2.5 py-1.5 bg-blue-50 rounded">
                  <p className="text-[11px] text-blue-700">
                    <span className="font-medium">应对策略：</span>{user.counter_strategy}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Differentiation Points */}
      {analysis.differentiation_points.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">差异化切入点矩阵</h3>
          <div className="grid grid-cols-2 gap-3">
            {analysis.differentiation_points.map((dp, idx) => {
              const style = ZONE_STYLES[dp.zone] || ZONE_STYLES['暂缓投入'];
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.08 }}
                  className={`card p-4 ${style.bg} border-0`}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span>{style.icon}</span>
                    <span className={`text-xs font-bold ${style.text}`}>{dp.zone}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{dp.point}</p>
                  <p className="text-xs text-slate-600 mt-1.5 italic">&ldquo;{dp.narrative}&rdquo;</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
