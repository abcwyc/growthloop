'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useAssistant } from '@/lib/assistant-context';
import type {
  SandboxParams, SandboxResult, SandboxInterpretation, PacingMode, ScenarioType,
  CompetitionScenarioResult, TimingScenarioResult, ComparisonScenarioResult,
} from '@/lib/types';

interface StrategyOption {
  id: number;
  title: string;
  budget_total: number;
  core_metric: string;
  status: string;
}

interface LatestScenario {
  id: number;
  strategy_id: number;
  radar_analysis_id: number | null;
  name: string;
  scenario_type: ScenarioType;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  interpretation: Record<string, unknown> | null;
  input_data: Record<string, unknown> | null;
  created_at: string;
}

interface RadarOption {
  id: number;
  brands: string[];
  totalItems: number;
  status: string;
  createdAt: string;
}

const SCENARIO_TABS: { id: ScenarioType; label: string; icon: string; desc: string }[] = [
  { id: 'resource', label: '资源调配', icon: '📊', desc: '调整预算/品效比/节奏，预测指标变化' },
  { id: 'competition', label: '竞争响应', icon: '⚔️', desc: '竞品动作后的应对策略推演' },
  { id: 'timing', label: '时机推演', icon: '⏱️', desc: '关键节点发力节奏优化' },
  { id: 'comparison', label: '策略对比', icon: '⚖️', desc: '多策略方案并排对比评估' },
];

const PACING_OPTIONS: { value: PacingMode; label: string; desc: string }[] = [
  { value: 'uniform', label: '均匀铺开', desc: 'ROI 稳定，峰值较低' },
  { value: 'burst', label: '集中爆发', desc: '节日/关键节点，曝光峰值高' },
  { value: 'front_heavy', label: '前重后轻', desc: '快速建立认知，后期靠口碑' },
  { value: 'back_heavy', label: '前轻后重', desc: '有认知基础时冲量' },
];

const COMPETITION_EVENTS = ['竞品降价', '竞品新品发布', '竞品服务事故', '竞品加大投放'] as const;
const SEVERITY_OPTIONS = ['轻微', '中等', '严重'] as const;

const DEFAULT_PARAMS: SandboxParams = {
  budget_delta_pct: 0,
  brand_ratio: 0.35,
  performance_ratio: 0.65,
  pacing: 'uniform',
};

export default function SandboxPage() {
  const { setPageContext, updatePageSnapshot } = useAssistant();
  useEffect(() => { setPageContext('sandbox'); }, [setPageContext]);

  const [scenarioType, setScenarioType] = useState<ScenarioType>('resource');
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [radarList, setRadarList] = useState<RadarOption[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [selectedRadarId, setSelectedRadarId] = useState<number | null>(null);

  // Resource scenario
  const [params, setParams] = useState<SandboxParams>({ ...DEFAULT_PARAMS });
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [interpretation, setInterpretation] = useState<SandboxInterpretation | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Competition scenario
  const [compEventType, setCompEventType] = useState<string>(COMPETITION_EVENTS[0]);
  const [compDescription, setCompDescription] = useState('');
  const [compSeverity, setCompSeverity] = useState<string>(SEVERITY_OPTIONS[1]);
  const [compResult, setCompResult] = useState<CompetitionScenarioResult | null>(null);
  const [compLoading, setCompLoading] = useState(false);

  // Timing scenario
  const [timingDates, setTimingDates] = useState<Array<{ date: string; event: string; importance: string }>>([]);
  const [timingFocus, setTimingFocus] = useState<string>('AI建议');
  const [timingResult, setTimingResult] = useState<TimingScenarioResult | null>(null);
  const [timingLoading, setTimingLoading] = useState(false);

  // Comparison scenario
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareResult, setCompareResult] = useState<ComparisonScenarioResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const [lastLoaded, setLastLoaded] = useState(false);

  useEffect(() => {
    const snapshot: Record<string, unknown> = {
      scenarioType,
      selectedStrategyId,
      selectedStrategy: selectedStrategyId ? strategies.find(s => s.id === selectedStrategyId) : null,
    };
    if (scenarioType === 'resource' && result) {
      snapshot.resourceParams = params;
      snapshot.resourceResult = result;
      snapshot.interpretation = interpretation;
    } else if (scenarioType === 'competition' && compResult) {
      snapshot.competitionInput = { eventType: compEventType, description: compDescription, severity: compSeverity };
      snapshot.competitionResult = compResult;
    } else if (scenarioType === 'timing' && timingResult) {
      snapshot.timingInput = { dates: timingDates, focus: timingFocus };
      snapshot.timingResult = timingResult;
    } else if (scenarioType === 'comparison' && compareResult) {
      snapshot.comparisonIds = compareIds;
      snapshot.comparisonResult = compareResult;
    }
    updatePageSnapshot(snapshot);
  }, [scenarioType, selectedStrategyId, strategies, params, result, interpretation,
    compEventType, compDescription, compSeverity, compResult,
    timingDates, timingFocus, timingResult, compareIds, compareResult, updatePageSnapshot]);

  function restoreScenario(latest: LatestScenario, completedStrategies: StrategyOption[]) {
    const type = latest.scenario_type || 'resource';
    setScenarioType(type);

    if (type === 'resource') {
      const sid = latest.strategy_id;
      if (completedStrategies.find(s => s.id === sid)) {
        setSelectedStrategyId(sid);
        setSelectedRadarId(latest.radar_analysis_id);
        if (latest.params) {
          const p = latest.params as unknown as SandboxParams;
          setParams(p);
        }
        if (latest.result) setResult(latest.result as unknown as SandboxResult);
        if (latest.interpretation) setInterpretation(latest.interpretation as unknown as SandboxInterpretation);
      }
    } else if (type === 'competition') {
      const sid = latest.strategy_id;
      if (completedStrategies.find(s => s.id === sid)) {
        setSelectedStrategyId(sid);
        if (latest.input_data) {
          const inp = latest.input_data as { event_type?: string; event_description?: string; severity?: string };
          if (inp.event_type) setCompEventType(inp.event_type);
          if (inp.event_description) setCompDescription(inp.event_description);
          if (inp.severity) setCompSeverity(inp.severity);
        }
        if (latest.result) setCompResult(latest.result as unknown as CompetitionScenarioResult);
      }
    } else if (type === 'timing') {
      const sid = latest.strategy_id;
      if (completedStrategies.find(s => s.id === sid)) {
        setSelectedStrategyId(sid);
        if (latest.input_data) {
          const inp = latest.input_data as { key_dates?: Array<{ date: string; event: string; importance: string }>; focus_mode?: string };
          if (inp.key_dates) setTimingDates(inp.key_dates);
          if (inp.focus_mode) setTimingFocus(inp.focus_mode);
        }
        if (latest.result) setTimingResult(latest.result as unknown as TimingScenarioResult);
      }
    } else if (type === 'comparison') {
      if (latest.input_data) {
        const inp = latest.input_data as { strategy_ids?: number[] };
        if (inp.strategy_ids) setCompareIds(inp.strategy_ids);
      }
      if (latest.result) setCompareResult(latest.result as unknown as ComparisonScenarioResult);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/strategy').then(r => r.json()),
      fetch('/api/radar/analyze').then(r => r.json()),
      fetch('/api/sandbox/latest').then(r => r.json()),
    ]).then(([stratData, radarData, latest]: [StrategyOption[], RadarOption[], LatestScenario | null]) => {
      const completed = stratData.filter((s: StrategyOption) => s.status === 'completed');
      setStrategies(completed);
      setRadarList(radarData.filter((r: RadarOption) => r.status === 'completed'));

      if (latest && !lastLoaded) {
        setLastLoaded(true);
        restoreScenario(latest, completed);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Resource Scenario Logic ───────────────────────────────
  const fetchPrediction = useCallback(async (stratId: number, p: SandboxParams, radarId: number | null) => {
    setInterpreting(true);
    try {
      const res = await fetch('/api/sandbox/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy_id: stratId, params: p, radar_analysis_id: radarId }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.result);
        setInterpretation(data.interpretation);
      }
    } catch { /* ignore */ }
    setInterpreting(false);
  }, []);

  const debouncedFetch = useCallback((stratId: number, p: SandboxParams, radarId: number | null) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPrediction(stratId, p, radarId), 400);
  }, [fetchPrediction]);

  function updateParams(patch: Partial<SandboxParams>) {
    const next = { ...params, ...patch };
    if (patch.brand_ratio !== undefined) next.performance_ratio = Math.round((1 - patch.brand_ratio) * 100) / 100;
    if (patch.performance_ratio !== undefined) next.brand_ratio = Math.round((1 - patch.performance_ratio) * 100) / 100;
    setParams(next);
    if (selectedStrategyId) debouncedFetch(selectedStrategyId, next, selectedRadarId);
  }

  function handleStrategySelect(id: number) {
    setSelectedStrategyId(id);
    setResult(null);
    setInterpretation(null);
    const reset = { ...DEFAULT_PARAMS };
    setParams(reset);
    if (scenarioType === 'resource') fetchPrediction(id, reset, selectedRadarId);
  }

  async function saveScenario() {
    if (!selectedStrategyId || !result) return;
    setSaving(true);
    try {
      await fetch('/api/sandbox/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_id: selectedStrategyId,
          radar_analysis_id: selectedRadarId,
          name: `预算${params.budget_delta_pct >= 0 ? '+' : ''}${params.budget_delta_pct}% / 品牌${Math.round(params.brand_ratio * 100)}% / ${PACING_OPTIONS.find(p => p.value === params.pacing)?.label}`,
          params, result, interpretation,
        }),
      });
    } catch { /* ignore */ }
    setSaving(false);
  }

  // ─── Competition Scenario Logic ────────────────────────────
  async function runCompetitionScenario() {
    if (!selectedStrategyId || !compDescription.trim()) return;
    setCompLoading(true);
    setCompResult(null);
    try {
      const res = await fetch('/api/sandbox/competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_id: selectedStrategyId,
          event_type: compEventType,
          event_description: compDescription,
          severity: compSeverity,
        }),
      });
      if (res.ok) setCompResult(await res.json());
    } catch { /* ignore */ }
    setCompLoading(false);
  }

  // ─── Timing Scenario Logic ─────────────────────────────────
  function addTimingDate() {
    setTimingDates(prev => [...prev, { date: '', event: '', importance: '中' }]);
  }

  async function runTimingScenario() {
    if (!selectedStrategyId || timingDates.filter(d => d.date && d.event).length === 0) return;
    setTimingLoading(true);
    setTimingResult(null);
    try {
      const res = await fetch('/api/sandbox/timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_id: selectedStrategyId,
          key_dates: timingDates.filter(d => d.date && d.event),
          focus_mode: timingFocus,
        }),
      });
      if (res.ok) setTimingResult(await res.json());
    } catch { /* ignore */ }
    setTimingLoading(false);
  }

  // ─── Comparison Scenario Logic ─────────────────────────────
  function toggleCompareId(id: number) {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  }

  async function runComparison() {
    if (compareIds.length < 2) return;
    setCompareLoading(true);
    setCompareResult(null);
    try {
      const res = await fetch('/api/sandbox/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy_ids: compareIds }),
      });
      if (res.ok) setCompareResult(await res.json());
    } catch { /* ignore */ }
    setCompareLoading(false);
  }

  const channelCompare = result ? result.channel_breakdown.map(ch => ({
    name: ch.channel.replace(/[（(].+[）)]/, ''),
    沙盘: ch.budget_amount,
    基线: Math.round(result.baseline.roi > 0 ? (result.budget_total / (1 + params.budget_delta_pct / 100)) * ch.budget_pct / 100 * 10 : 0) / 10,
  })) : [];

  const needsStrategy = scenarioType !== 'comparison';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">沙盘推演</h1>
        <p className="text-sm text-slate-500 mt-1">全维度营销战场模拟器 — 资源调配、竞争响应、时机推演、策略对比</p>
      </div>

      {/* Scenario Type Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        {SCENARIO_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setScenarioType(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              scenarioType === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Panel */}
        <div className="lg:col-span-4 space-y-4">
          {/* Strategy selector (shared for resource/competition/timing) */}
          {needsStrategy && (
            <div className="card p-4">
              <label className="block text-xs font-medium text-slate-500 mb-2">选择基线策略</label>
              <select
                value={selectedStrategyId ?? ''}
                onChange={e => e.target.value && handleStrategySelect(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">请选择一个已完成的策略</option>
                {strategies.map(s => (
                  <option key={s.id} value={s.id}>#{s.id} {s.title} ({s.budget_total}万)</option>
                ))}
              </select>
            </div>
          )}

          {/* ═══ Resource Scenario Controls ═══ */}
          {scenarioType === 'resource' && selectedStrategyId && (
            <>
              <div className="card p-4">
                <label className="block text-xs font-medium text-slate-500 mb-2">引用雷达数据（可选）</label>
                <select
                  value={selectedRadarId ?? ''}
                  onChange={e => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setSelectedRadarId(v);
                    if (selectedStrategyId) debouncedFetch(selectedStrategyId, params, v);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">不引用</option>
                  {radarList.map(r => (
                    <option key={r.id} value={r.id}>
                      #{r.id} {r.brands.slice(0, 3).join('/')}{r.brands.length > 3 ? `+${r.brands.length - 3}` : ''} ({r.totalItems}条)
                    </option>
                  ))}
                </select>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-500">总预算调整</label>
                  <span className={`text-sm font-bold ${params.budget_delta_pct > 0 ? 'text-emerald-600' : params.budget_delta_pct < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                    {params.budget_delta_pct >= 0 ? '+' : ''}{params.budget_delta_pct}%
                    {result && <span className="text-slate-400 font-normal ml-1">({result.budget_total}万)</span>}
                  </span>
                </div>
                <input type="range" min={-50} max={100} step={5} value={params.budget_delta_pct}
                  onChange={e => updateParams({ budget_delta_pct: Number(e.target.value) })} className="w-full accent-blue-600" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>-50%</span><span>0%</span><span>+100%</span></div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-500">品牌 vs 效果</label>
                  <span className="text-sm font-medium text-slate-700">
                    {Math.round(params.brand_ratio * 100)}% : {Math.round(params.performance_ratio * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-indigo-500 w-8">品牌</span>
                  <input type="range" min={0} max={100} step={5} value={Math.round(params.brand_ratio * 100)}
                    onChange={e => updateParams({ brand_ratio: Number(e.target.value) / 100 })} className="flex-1 accent-indigo-500" />
                  <span className="text-[10px] text-orange-500 w-8 text-right">效果</span>
                </div>
              </div>

              <div className="card p-4">
                <label className="block text-xs font-medium text-slate-500 mb-3">投放节奏</label>
                <div className="grid grid-cols-2 gap-2">
                  {PACING_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => updateParams({ pacing: opt.value })}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                        params.pacing === opt.value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      <div className="font-medium text-xs">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { const reset = { ...DEFAULT_PARAMS }; setParams(reset); fetchPrediction(selectedStrategyId, reset, selectedRadarId); }}
                  className="btn-secondary text-xs flex-1">重置为默认值</button>
                <button onClick={saveScenario} disabled={!result || saving} className="btn-primary text-xs flex-1">
                  {saving ? '保存中...' : '保存场景'}
                </button>
              </div>

              <AiInsightCard interpreting={interpreting} interpretation={interpretation} />
            </>
          )}

          {/* ═══ Competition Scenario Controls ═══ */}
          {scenarioType === 'competition' && selectedStrategyId && (
            <>
              <div className="card p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">竞争事件类型</label>
                  <div className="grid grid-cols-2 gap-2">
                    {COMPETITION_EVENTS.map(evt => (
                      <button key={evt} onClick={() => setCompEventType(evt)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                          compEventType === evt ? 'bg-red-50 border-red-300 text-red-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}>
                        {evt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">事件描述</label>
                  <textarea value={compDescription} onChange={e => setCompDescription(e.target.value)}
                    placeholder="例：某竞品宣布全线降价30%，有效期1个月"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">严重程度</label>
                  <div className="flex gap-2">
                    {SEVERITY_OPTIONS.map(s => (
                      <button key={s} onClick={() => setCompSeverity(s)}
                        className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          compSeverity === s ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-200 text-slate-500'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={runCompetitionScenario} disabled={compLoading || !compDescription.trim()}
                className="btn-primary w-full text-sm py-2.5">
                {compLoading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />推演中...</span> : '开始推演'}
              </button>
            </>
          )}

          {/* ═══ Timing Scenario Controls ═══ */}
          {scenarioType === 'timing' && selectedStrategyId && (
            <>
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500">关键日期/事件</label>
                  <button onClick={addTimingDate} className="text-xs text-blue-600 hover:text-blue-700">+ 添加</button>
                </div>
                {timingDates.length === 0 && (
                  <p className="text-xs text-slate-400 py-2">点击右上角添加按钮输入关键节点（大促、竞品发布等）</p>
                )}
                {timingDates.map((td, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <input type="date" value={td.date} onChange={e => {
                      const next = [...timingDates]; next[idx] = { ...next[idx], date: e.target.value }; setTimingDates(next);
                    }} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="text" value={td.event} onChange={e => {
                      const next = [...timingDates]; next[idx] = { ...next[idx], event: e.target.value }; setTimingDates(next);
                    }} placeholder="事件描述" className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <select value={td.importance} onChange={e => {
                      const next = [...timingDates]; next[idx] = { ...next[idx], importance: e.target.value }; setTimingDates(next);
                    }} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="高">高</option><option value="中">中</option><option value="低">低</option>
                    </select>
                    <button onClick={() => setTimingDates(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-500 text-xs px-1 py-1.5">×</button>
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">发力模式</label>
                  <div className="flex gap-2">
                    {['集中爆发', '持续推进', 'AI建议'].map(mode => (
                      <button key={mode} onClick={() => setTimingFocus(mode)}
                        className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          timingFocus === mode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500'
                        }`}>
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={runTimingScenario} disabled={timingLoading || timingDates.filter(d => d.date && d.event).length === 0}
                className="btn-primary w-full text-sm py-2.5">
                {timingLoading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />推演中...</span> : '开始推演'}
              </button>
            </>
          )}

          {/* ═══ Comparison Scenario Controls ═══ */}
          {scenarioType === 'comparison' && (
            <>
              <div className="card p-4">
                <label className="block text-xs font-medium text-slate-500 mb-2">选择2-3个策略进行对比</label>
                <div className="space-y-2">
                  {strategies.map(s => (
                    <button key={s.id} onClick={() => toggleCompareId(s.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all flex items-center gap-2 ${
                        compareIds.includes(s.id) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                        compareIds.includes(s.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                      }`}>
                        {compareIds.includes(s.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                      </span>
                      <span className="font-medium">#{s.id}</span>
                      <span className="truncate">{s.title}</span>
                      <span className="ml-auto text-slate-400">{s.budget_total}万</span>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={runComparison} disabled={compareLoading || compareIds.length < 2}
                className="btn-primary w-full text-sm py-2.5">
                {compareLoading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />对比分析中...</span> : `对比 ${compareIds.length} 个策略`}
              </button>
            </>
          )}
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-8 space-y-4">
          <AnimatePresence mode="wait">
            {/* ═══ Resource Results ═══ */}
            {scenarioType === 'resource' && (
              <motion.div key="resource" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {!selectedStrategyId && <EmptyState text="选择一个策略开始资源调配推演" />}
                {selectedStrategyId && !result && <LoadingState />}
                {selectedStrategyId && result && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <KpiCard label="预计转化量" value={result.predicted_conversions.toLocaleString()} delta={result.conversion_delta_pct} baseline={result.baseline.conversions.toLocaleString()} />
                      <KpiCard label="预计 CPA" value={`¥${result.predicted_cpa}`} delta={result.cpa_delta_pct} baseline={`¥${result.baseline.cpa}`} invertColor />
                      <KpiCard label="预计 ROI" value={`${result.predicted_roi}x`} delta={result.roi_delta_pct} baseline={`${result.baseline.roi}x`} />
                    </div>
                    <div className="card p-4">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">渠道预算对比</h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={channelCompare} barCategoryGap="20%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} unit="万" />
                          <Tooltip formatter={(v: number) => `${v}万`} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="基线" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="沙盘" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      {result.channel_breakdown.filter(c => c.marginal_status !== 'normal').length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {result.channel_breakdown.filter(c => c.marginal_status !== 'normal').map(c => (
                            <span key={c.channel} className={`text-[10px] px-2 py-0.5 rounded-full ${
                              c.marginal_status === 'saturated' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {c.channel}: {c.marginal_status === 'saturated' ? '饱和' : '递减'}（{c.budget_pct}%）
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="card p-4">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">周转化趋势（预估）</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={result.weekly_trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="conversions" name="转化量" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="spend" name="花费(万)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ═══ Competition Results ═══ */}
            {scenarioType === 'competition' && (
              <motion.div key="competition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {!selectedStrategyId && <EmptyState text="选择策略并描述竞争事件开始推演" />}
                {selectedStrategyId && !compResult && !compLoading && <EmptyState text="填写竞争事件信息后点击开始推演" />}
                {compLoading && <LoadingState />}
                {compResult && (
                  <>
                    <div className={`card p-5 border-l-4 ${
                      compResult.impact_assessment.urgency === '立即响应' ? 'border-red-500' :
                      compResult.impact_assessment.urgency === '密切关注' ? 'border-amber-500' : 'border-green-500'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          compResult.impact_assessment.urgency === '立即响应' ? 'bg-red-100 text-red-700' :
                          compResult.impact_assessment.urgency === '密切关注' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        }`}>{compResult.impact_assessment.urgency}</span>
                        <h3 className="text-sm font-semibold text-slate-700">影响评估</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-red-50 rounded-lg">
                          <span className="text-red-500 font-medium">用户流失风险</span>
                          <p className="text-slate-700 mt-1">{compResult.impact_assessment.user_risk}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg">
                          <span className="text-emerald-500 font-medium">获客机会</span>
                          <p className="text-slate-700 mt-1">{compResult.impact_assessment.opportunity}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-700">三套应对方案</h3>
                      {compResult.response_options.map((opt, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                          className={`card p-4 ${compResult.recommendation.preferred === opt.approach ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              opt.approach === '激进' ? 'bg-red-100 text-red-700' :
                              opt.approach === '中性' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>{opt.approach}</span>
                            <span className="text-sm font-medium text-slate-800">{opt.description}</span>
                            {compResult.recommendation.preferred === opt.approach && (
                              <span className="ml-auto px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">推荐</span>
                            )}
                          </div>
                          <div className="space-y-1.5 mb-2">
                            {opt.actions.map((a, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                                <span className="text-blue-400 mt-0.5">•</span>
                                <span>{a}</span>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div className="px-2 py-1.5 bg-emerald-50 rounded"><span className="text-emerald-600 font-medium">预期：</span>{opt.expected_outcome}</div>
                            <div className="px-2 py-1.5 bg-amber-50 rounded"><span className="text-amber-600 font-medium">风险：</span>{opt.risk}</div>
                            <div className="px-2 py-1.5 bg-slate-50 rounded"><span className="text-slate-500 font-medium">资源：</span>{opt.resource_impact}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="card p-4 bg-blue-50 border-0">
                      <h3 className="text-xs font-semibold text-blue-700 mb-1">综合推荐</h3>
                      <p className="text-sm text-slate-700">{compResult.recommendation.rationale}</p>
                      <p className="text-xs text-slate-500 mt-1">触发条件：{compResult.recommendation.trigger_conditions}</p>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ═══ Timing Results ═══ */}
            {scenarioType === 'timing' && (
              <motion.div key="timing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {!selectedStrategyId && <EmptyState text="选择策略并添加关键日期开始时机推演" />}
                {selectedStrategyId && !timingResult && !timingLoading && <EmptyState text="添加关键日期后点击开始推演" />}
                {timingLoading && <LoadingState />}
                {timingResult && (
                  <>
                    {timingResult.optimal_windows.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">最优发力窗口</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {timingResult.optimal_windows.map((win, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.08 }}
                              className={`card p-4 border-l-4 ${win.impact === '高' ? 'border-red-400' : win.impact === '中' ? 'border-amber-400' : 'border-slate-300'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  win.impact === '高' ? 'bg-red-100 text-red-700' : win.impact === '中' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>{win.impact}</span>
                                <span className="text-xs font-medium text-slate-700">{win.window}</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{win.rationale}</p>
                              <p className="text-xs text-blue-600 mt-1 font-medium">{win.recommended_action}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {timingResult.phase_plan.length > 0 && (
                      <div className="card p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">分阶段执行计划</h3>
                        <div className="space-y-3">
                          {timingResult.phase_plan.map((phase, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}
                              className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">{idx + 1}</div>
                                {idx < timingResult.phase_plan.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1" />}
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-slate-900">{phase.phase}</h4>
                                  <span className="text-[10px] text-slate-400">{phase.period}</span>
                                  <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">{phase.budget_pct}%</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">{phase.objective}</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {phase.key_actions.map((a, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{a}</span>
                                  ))}
                                </div>
                                <p className="text-[10px] text-emerald-600 mt-1.5 font-medium">里程碑：{phase.milestone}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="card p-4 bg-indigo-50 border-0">
                      <h3 className="text-xs font-semibold text-indigo-700 mb-1">节奏建议</h3>
                      <p className="text-sm text-slate-700">{timingResult.recommendation}</p>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ═══ Comparison Results ═══ */}
            {scenarioType === 'comparison' && (
              <motion.div key="comparison" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {compareIds.length < 2 && !compareResult && <EmptyState text="选择至少2个策略进行对比分析" />}
                {compareIds.length >= 2 && !compareResult && !compareLoading && <EmptyState text="点击对比按钮开始分析" />}
                {compareLoading && <LoadingState />}
                {compareResult && compareResult.strategies.length > 0 && (
                  <>
                    <div className="card p-4">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">四维度雷达图</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={[
                          { dim: '增长潜力', ...Object.fromEntries(compareResult.strategies.map(s => [s.title, s.scores.growth_potential])) },
                          { dim: '执行难度', ...Object.fromEntries(compareResult.strategies.map(s => [s.title, 10 - s.scores.execution_difficulty])) },
                          { dim: '风险可控', ...Object.fromEntries(compareResult.strategies.map(s => [s.title, 10 - s.scores.risk_level])) },
                          { dim: '资源效率', ...Object.fromEntries(compareResult.strategies.map(s => [s.title, s.scores.resource_efficiency])) },
                        ]}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9 }} />
                          {compareResult.strategies.map((s, idx) => (
                            <Radar key={s.strategy_id} name={s.title} dataKey={s.title}
                              stroke={['#6366f1', '#f59e0b', '#10b981'][idx]} fill={['#6366f1', '#f59e0b', '#10b981'][idx]} fillOpacity={0.15} strokeWidth={2} />
                          ))}
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-3">
                      {compareResult.strategies.map((s, idx) => (
                        <motion.div key={s.strategy_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                          className={`card p-4 ${compareResult.recommendation.preferred_id === s.strategy_id ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: ['#6366f1', '#f59e0b', '#10b981'][idx] }} />
                            <h4 className="text-sm font-bold text-slate-900">{s.title}</h4>
                            {compareResult.recommendation.preferred_id === s.strategy_id && (
                              <span className="ml-auto px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">推荐</span>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {Object.entries(s.scores).map(([key, val]) => (
                              <div key={key} className="text-center">
                                <p className="text-lg font-bold text-slate-900">{val}</p>
                                <p className="text-[10px] text-slate-400">
                                  {key === 'growth_potential' ? '增长潜力' :
                                   key === 'execution_difficulty' ? '执行难度' :
                                   key === 'risk_level' ? '风险水平' : '资源效率'}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-emerald-600 font-medium">优势</span>
                              <ul className="mt-1 space-y-0.5">{s.strengths.map((st, i) => <li key={i} className="text-slate-600">• {st}</li>)}</ul>
                            </div>
                            <div>
                              <span className="text-red-500 font-medium">劣势</span>
                              <ul className="mt-1 space-y-0.5">{s.weaknesses.map((w, i) => <li key={i} className="text-slate-600">• {w}</li>)}</ul>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-2">核心假设：{s.core_assumption}</p>
                        </motion.div>
                      ))}
                    </div>

                    {compareResult.trade_offs.length > 0 && (
                      <div className="card p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">核心取舍</h3>
                        <div className="space-y-1.5">
                          {compareResult.trade_offs.map((t, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-600">
                              <span className="text-amber-500 mt-0.5">⚖️</span><span>{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="card p-4 bg-blue-50 border-0">
                      <h3 className="text-xs font-semibold text-blue-700 mb-1">综合推荐</h3>
                      <p className="text-sm text-slate-700">{compareResult.recommendation.rationale}</p>
                      <p className="text-xs text-slate-500 mt-1.5">混合方案建议：{compareResult.recommendation.hybrid_suggestion}</p>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────

function KpiCard({ label, value, delta, baseline, invertColor }: {
  label: string; value: string; delta: number; baseline: string; invertColor?: boolean;
}) {
  const isPositive = invertColor ? delta < 0 : delta > 0;
  const isNegative = invertColor ? delta > 0 : delta < 0;
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-sm font-medium ${isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-slate-500'}`}>
          {delta >= 0 ? '+' : ''}{delta}%{isPositive ? ' ↑' : isNegative ? ' ↓' : ''}
        </span>
        <span className="text-[10px] text-slate-400">基线 {baseline}</span>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card p-16 text-center">
      <svg className="mx-auto mb-4 text-slate-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4.5 3h15" /><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" /><path d="M6 14h12" />
      </svg>
      <h3 className="text-base font-semibold text-slate-700">{text}</h3>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="card p-16 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      <span className="ml-3 text-sm text-slate-500">AI 推演计算中...</span>
    </div>
  );
}

function AiInsightCard({ interpreting, interpretation }: { interpreting: boolean; interpretation: SandboxInterpretation | null }) {
  return (
    <div className="card p-4 bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100">
      <div className="flex items-center gap-1.5 mb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500">
          <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a2 2 0 0 1-2 2h-1l1 5H7l1-5H7a2 2 0 0 1-2-2v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z"/>
        </svg>
        <span className="text-xs font-semibold text-indigo-700">AI 解读</span>
        {interpreting && <span className="w-3 h-3 border-2 border-indigo-300/50 border-t-indigo-500 rounded-full animate-spin" />}
      </div>
      {interpretation ? (
        <div className="space-y-1.5">
          <p className="text-sm text-slate-700">{interpretation.insight_primary}</p>
          <p className="text-sm text-slate-600">{interpretation.insight_secondary}</p>
          {interpretation.risk_flag && (
            <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md">{interpretation.risk_flag}</p>
          )}
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full ${
            interpretation.confidence === 'high' ? 'bg-emerald-50 text-emerald-600' :
            interpretation.confidence === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
          }`}>置信度: {interpretation.confidence}</span>
        </div>
      ) : (
        <p className="text-xs text-slate-400">选择策略后将自动生成解读</p>
      )}
    </div>
  );
}
