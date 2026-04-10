'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { Strategy } from '@/lib/types';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '已生成' },
  generating: { bg: 'bg-blue-100', text: 'text-blue-700', label: '生成中' },
  error: { bg: 'bg-red-100', text: 'text-red-700', label: '失败' },
  draft: { bg: 'bg-slate-100', text: 'text-slate-500', label: '草案' },
};

export default function StrategyListPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/strategy')
      .then(r => r.json())
      .then(data => { setStrategies(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('确定删除此策略？')) return;
    await fetch(`/api/strategy/${id}`, { method: 'DELETE' });
    setStrategies(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">策略</h1>
          <p className="text-sm text-slate-500 mt-1">管理营销策略，从业务目标到可执行方案</p>
        </div>
        <Link href="/strategy/new" className="btn-primary">
          新建策略
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : strategies.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">暂无策略</h3>
          <p className="text-sm text-slate-500 mb-4">输入业务目标，AI 将为你生成结构化营销策略</p>
          <Link href="/strategy/new" className="btn-primary">
            创建第一个策略
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {strategies.map((s, idx) => {
            const status = STATUS_STYLES[s.status] || STATUS_STYLES.draft;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div
                  onClick={() => router.push(`/strategy/${s.id}`)}
                  className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{s.title}</h3>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">{s.business_goal}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                        <span>{s.core_metric}</span>
                        <span>{s.period_start} ~ {s.period_end}</span>
                        {s.budget_total > 0 && <span>{s.budget_total}万</span>}
                        <span>{new Date(s.created_at).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1"
                      >
                        删除
                      </button>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
