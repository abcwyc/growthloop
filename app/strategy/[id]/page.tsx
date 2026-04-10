'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { Strategy, StrategyResult } from '@/lib/types';
import { useAssistant } from '@/lib/assistant-context';
import RefButton from '@/components/layout/RefButton';
import MarketSituationTab from '@/components/strategy/MarketSituationTab';
import CompetitionTab from '@/components/strategy/CompetitionTab';
import AudienceTab from '@/components/strategy/AudienceTab';
import ChannelTab from '@/components/strategy/ChannelTab';
import ExecutionTab from '@/components/strategy/ExecutionTab';
import PacingTab from '@/components/strategy/PacingTab';
import AssumptionTab from '@/components/strategy/AssumptionTab';

const TABS = [
  { id: 'situation', label: '市场态势' },
  { id: 'competition', label: '竞争情报' },
  { id: 'audience', label: '目标人群' },
  { id: 'channel', label: '渠道组合' },
  { id: 'execution', label: '执行方案' },
  { id: 'pacing', label: '时间节奏' },
  { id: 'assumption', label: '关键假设' },
] as const;

type TabId = typeof TABS[number]['id'];

const METRICS = ['DAU', '新增订单', 'GMV', '品牌曝光', '自定义'];

/* ─── Draft Editor ─── */

function DraftEditor({ strategy, onSaved, onGenerate }: {
  strategy: Strategy;
  onSaved: () => void;
  onGenerate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(strategy.title);
  const [goal, setGoal] = useState(strategy.business_goal);
  const [metric, setMetric] = useState(strategy.core_metric);
  const [periodStart, setPeriodStart] = useState(strategy.period_start);
  const [periodEnd, setPeriodEnd] = useState(strategy.period_end);
  const [budget, setBudget] = useState(String(strategy.budget_total));
  const [roiFloor, setRoiFloor] = useState(String(strategy.roi_floor));

  useEffect(() => {
    setTitle(strategy.title);
    setGoal(strategy.business_goal);
    setMetric(strategy.core_metric);
    setPeriodStart(strategy.period_start);
    setPeriodEnd(strategy.period_end);
    setBudget(String(strategy.budget_total));
    setRoiFloor(String(strategy.roi_floor));
  }, [strategy]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/strategy/${strategy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, business_goal: goal, core_metric: metric,
          period_start: periodStart, period_end: periodEnd,
          budget_total: Number(budget), roi_floor: Number(roiFloor),
        }),
      });
      setEditing(false);
      onSaved();
    } finally { setSaving(false); }
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{strategy.title}</h1>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">草案</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(true)} className="btn-secondary text-xs px-3 py-1.5">
                编辑
              </button>
              <button onClick={onGenerate} className="btn-primary text-xs px-4 py-1.5">
                生成策略
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">业务目标</span>
              <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{strategy.business_goal}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">核心指标</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{strategy.core_metric}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">执行周期</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{strategy.period_start} ~ {strategy.period_end}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">预算总额</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{strategy.budget_total} 万</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">ROI 底线</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{strategy.roi_floor}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">编辑草案</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary text-xs px-3 py-1.5">取消</button>
            <button onClick={handleSave} disabled={saving || !goal.trim()} className="btn-primary text-xs px-4 py-1.5">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">策略标题</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">业务目标 *</label>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">核心指标</label>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">开始日期</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">结束日期</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">预算总额（万元）</label>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} min={1}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">ROI 底线</label>
            <input type="number" value={roiFloor} onChange={e => setRoiFloor(e.target.value)} step={0.1} min={0}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function StrategyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { setPageContext, updatePageSnapshot } = useAssistant();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('situation');
  const [error, setError] = useState('');

  useEffect(() => {
    setPageContext(`strategy:${activeTab}`, Number(id));
  }, [activeTab, id, setPageContext]);

  useEffect(() => {
    if (strategy && result) {
      updatePageSnapshot({
        strategyId: strategy.id,
        title: strategy.title,
        businessGoal: strategy.business_goal,
        coreMetric: strategy.core_metric,
        budgetTotal: strategy.budget_total,
        roiFloor: strategy.roi_floor,
        period: `${strategy.period_start} ~ ${strategy.period_end}`,
        status: strategy.status,
        activeTab,
        marketSituation: result.market_situation,
        audienceStrategy: result.audience_strategy,
        channelMix: result.channel_mix,
        executionPlan: result.execution_plan,
        pacingStrategy: result.pacing_strategy,
        assumptions: result.assumptions,
      });
    }
  }, [strategy, result, activeTab, updatePageSnapshot]);

  useEffect(() => {
    function onUpdate() { fetchStrategy(); }
    window.addEventListener('assistant:strategy-updated', onUpdate);
    return () => window.removeEventListener('assistant:strategy-updated', onUpdate);
  });

  const fetchStrategy = useCallback(async () => {
    try {
      const res = await fetch(`/api/strategy/${id}`);
      if (!res.ok) { setError('策略不存在'); return; }
      const data = await res.json();
      setStrategy(data);
      if (data.result) setResult(data.result);
      return data.status;
    } catch { setError('加载失败'); return null; }
  }, [id]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    (async () => {
      const status = await fetchStrategy();
      if (status === 'generating') {
        timer = setInterval(async () => {
          const s = await fetchStrategy();
          if (s !== 'generating') clearInterval(timer);
        }, 3000);
      }
    })();
    return () => clearInterval(timer);
  }, [fetchStrategy]);

  async function handleGenerate() {
    await fetch(`/api/strategy/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generate: true }),
    });
    fetchStrategy();
    const timer = setInterval(async () => {
      const s = await fetchStrategy();
      if (s !== 'generating') clearInterval(timer);
    }, 3000);
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">{error}</p>
        <button onClick={() => router.push('/strategy')} className="btn-secondary mt-4">返回策略列表</button>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isGenerating = strategy.status === 'generating';
  const isFailed = strategy.status === 'error';
  const isDraft = strategy.status === 'draft';

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => router.push('/strategy')} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; 返回策略列表
        </button>
      </div>

      {/* Draft: show editor */}
      {isDraft && (
        <DraftEditor strategy={strategy} onSaved={fetchStrategy} onGenerate={handleGenerate} />
      )}

      {/* Completed / Generating / Error: show meta card */}
      {!isDraft && (
        <div className="card p-5 mb-6 relative group/meta">
          <RefButton
            reference={{
              id: `strategy-meta-${id}`,
              label: '策略概览',
              type: 'strategy_meta',
              data: result?.strategy_meta || { title: strategy.title, goal: strategy.business_goal },
            }}
            className="absolute top-3 right-3 opacity-0 group-hover/meta:opacity-100 transition-opacity"
          />
          <div className="flex items-start justify-between pr-8">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{result?.strategy_meta?.title || strategy.title}</h1>
              {result?.strategy_meta?.goal_summary && (
                <p className="text-sm text-slate-500 mt-1">{result.strategy_meta.goal_summary}</p>
              )}
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              strategy.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
              strategy.status === 'generating' ? 'bg-blue-100 text-blue-700' :
              strategy.status === 'error' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-500'
            }`}>
              {strategy.status === 'completed' ? '已生成' :
               strategy.status === 'generating' ? '生成中...' :
               strategy.status === 'error' ? '失败' : '草案'}
            </span>
          </div>

          {result?.strategy_meta && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">周期</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{result.strategy_meta.period}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">预算</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{result.strategy_meta.budget_total} 万</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">ROI 底线</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{result.strategy_meta.roi_floor}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">市场阶段</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{result.strategy_meta.market_stage}</p>
              </div>
            </div>
          )}

          {!result && !isGenerating && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">核心指标</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{strategy.core_metric}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">周期</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{strategy.period_start} ~ {strategy.period_end}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">预算</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{strategy.budget_total} 万</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">ROI 底线</span>
                <p className="text-sm text-slate-700 font-medium mt-0.5">{strategy.roi_floor}</p>
              </div>
            </div>
          )}

          {result?.strategy_meta?.market_stage_rationale && (
            <div className="mt-3 px-3 py-2 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">判断依据：</span>
                {result.strategy_meta.market_stage_rationale}
              </p>
            </div>
          )}

          {result?.strategy_meta?.main_strategy && (
            <div className="mt-2 px-3 py-2 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <span className="font-medium">核心策略：</span>
                {result.strategy_meta.main_strategy}
              </p>
            </div>
          )}
        </div>
      )}

      {isGenerating && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-8 text-center">
          <div className="w-10 h-10 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-600 font-medium">AI 正在生成策略卡片...</p>
          <p className="text-xs text-slate-400 mt-1">基于业务目标和竞品洞察，预计需要 30-60 秒</p>
        </motion.div>
      )}

      {isFailed && (
        <div className="card p-6 text-center">
          <p className="text-sm text-red-600 font-medium">策略生成失败</p>
          {strategy.error_message && (
            <p className="text-xs text-slate-500 mt-2 max-w-lg mx-auto">{strategy.error_message}</p>
          )}
          <button onClick={handleGenerate} className="btn-primary mt-4">重新生成</button>
        </div>
      )}

      {/* Tabs + Content */}
      {result && (
        <>
          <div className="flex border-b border-slate-200 mb-5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors relative group/tab ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {tab.id === 'channel' && (
                  <span className="ml-1.5 text-[10px] text-slate-400">({result.channel_mix.length})</span>
                )}
                {tab.id === 'assumption' && (
                  <span className="ml-1.5 text-[10px] text-slate-400">({result.key_assumptions.length})</span>
                )}
                {tab.id === 'situation' && !result.market_situation && (
                  <span className="ml-1.5 text-[10px] text-slate-300">—</span>
                )}
                {tab.id === 'competition' && !result.competition_analysis && (
                  <span className="ml-1.5 text-[10px] text-slate-300">—</span>
                )}
                {tab.id === 'execution' && !result.execution_plan && (
                  <span className="ml-1.5 text-[10px] text-slate-300">—</span>
                )}
              </button>
            ))}
          </div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="pb-6"
          >
            {activeTab === 'situation' && (
              result.market_situation
                ? <MarketSituationTab situation={result.market_situation} />
                : <MissingModuleCard label="市场态势" onRegenerate={handleGenerate} generating={isGenerating} />
            )}
            {activeTab === 'competition' && (
              result.competition_analysis
                ? <CompetitionTab analysis={result.competition_analysis} />
                : <MissingModuleCard label="竞争情报" onRegenerate={handleGenerate} generating={isGenerating} />
            )}
            {activeTab === 'audience' && <AudienceTab audiences={result.target_audiences} />}
            {activeTab === 'channel' && <ChannelTab channels={result.channel_mix} budgetTotal={result.strategy_meta.budget_total} />}
            {activeTab === 'execution' && (
              result.execution_plan
                ? <ExecutionTab plan={result.execution_plan} />
                : <MissingModuleCard label="执行方案" onRegenerate={handleGenerate} generating={isGenerating} />
            )}
            {activeTab === 'pacing' && <PacingTab pacing={result.time_pacing} budgetTotal={result.strategy_meta.budget_total} />}
            {activeTab === 'assumption' && <AssumptionTab assumptions={result.key_assumptions} />}
          </motion.div>
        </>
      )}
    </div>
  );
}

function MissingModuleCard({ label, onRegenerate, generating }: { label: string; onRegenerate: () => void; generating: boolean }) {
  return (
    <div className="card p-10 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
          <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
      </div>
      <p className="text-sm text-slate-600 font-medium">该策略生成时未包含「{label}」</p>
      <p className="text-xs text-slate-400 mt-1.5 mb-5">
        此前生成受 Token 限制导致内容不完整，重新生成可获取完整 SCRAP 分析
      </p>
      <button
        onClick={onRegenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
      >
        {generating ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            重新生成策略
          </>
        )}
      </button>
    </div>
  );
}
