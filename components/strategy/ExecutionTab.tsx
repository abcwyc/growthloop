'use client';

import { motion } from 'framer-motion';
import type { ExecutionPlan } from '@/lib/types';

interface Props {
  plan: ExecutionPlan;
}

export default function ExecutionTab({ plan }: Props) {
  return (
    <div className="space-y-6">
      {/* Product Designs */}
      {plan.product_designs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">产品/服务承接设计</h3>
          <div className="space-y-3">
            {plan.product_designs.map((pd, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="card p-4 border-l-4 border-violet-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                    {idx + 1}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{pd.user_group}</h4>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">首次关键体验</span>
                    <p className="text-slate-700 mt-0.5">{pd.first_experience}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">差异化设计</span>
                    <p className="text-slate-700 mt-0.5">{pd.differentiation}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">成功指标</span>
                    <p className="text-emerald-700 mt-0.5 font-medium">{pd.success_metric}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign Ideas */}
      {plan.campaign_ideas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">活动策略方案</h3>
          <div className="space-y-3">
            {plan.campaign_ideas.map((ci, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="card p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900">{ci.theme}</h4>
                    <div className="grid grid-cols-3 gap-3 text-xs mt-2">
                      <div>
                        <span className="text-slate-400">目标用户</span>
                        <p className="text-slate-700 mt-0.5">{ci.target_user}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">激励机制</span>
                        <p className="text-slate-700 mt-0.5">{ci.mechanism}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">转化路径</span>
                        <p className="text-blue-700 mt-0.5">{ci.expected_conversion_path}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Content Strategy */}
      {plan.content_strategy && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">内容策略框架</h3>
          <div className="grid grid-cols-3 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card p-4 bg-red-50 border-0"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">⚔️</span>
                <span className="text-xs font-bold text-red-700">竞品用户</span>
              </div>
              <p className="text-xs text-slate-700">{plan.content_strategy.competitor_users_narrative}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="card p-4 bg-green-50 border-0"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">🌱</span>
                <span className="text-xs font-bold text-green-700">新用户</span>
              </div>
              <p className="text-xs text-slate-700">{plan.content_strategy.new_users_narrative}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-4 bg-purple-50 border-0"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">💎</span>
                <span className="text-xs font-bold text-purple-700">存量用户</span>
              </div>
              <p className="text-xs text-slate-700">{plan.content_strategy.existing_users_narrative}</p>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
