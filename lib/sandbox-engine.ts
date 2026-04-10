import type {
  StrategyResult, ChannelMixItem, SandboxParams, SandboxResult,
  ChannelPrediction, WeeklyPoint, PacingMode, SandboxInterpretation,
  CompetitionScenarioInput, CompetitionScenarioResult,
  TimingScenarioInput, TimingScenarioResult,
  ComparisonScenarioResult,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 数学预测模型（纯计算，无 LLM，< 10ms）
// ═══════════════════════════════════════════════════════════════

const DIMINISHING_THRESHOLD = 0.40;
const SATURATED_THRESHOLD = 0.55;

function diminishingFactor(pct: number): number {
  if (pct <= DIMINISHING_THRESHOLD) return 1.0;
  if (pct <= SATURATED_THRESHOLD) {
    const over = (pct - DIMINISHING_THRESHOLD) / (SATURATED_THRESHOLD - DIMINISHING_THRESHOLD);
    return 1.0 - over * 0.25;
  }
  return 0.65 - (pct - SATURATED_THRESHOLD) * 0.5;
}

const PACING_COEFFICIENTS: Record<PacingMode, { roi_mult: number; cpa_mult: number; weekly_shape: number[] }> = {
  uniform:     { roi_mult: 1.00, cpa_mult: 1.00, weekly_shape: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  burst:       { roi_mult: 1.05, cpa_mult: 1.12, weekly_shape: [0.4, 0.6, 1.0, 1.8, 2.2, 2.0, 1.6, 1.2, 0.8, 0.6, 0.5, 0.3] },
  front_heavy: { roi_mult: 0.95, cpa_mult: 0.92, weekly_shape: [2.0, 1.8, 1.5, 1.3, 1.1, 1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2] },
  back_heavy:  { roi_mult: 1.08, cpa_mult: 1.05, weekly_shape: [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.3, 1.5, 1.8, 2.0, 2.2] },
};

function classifyChannel(ch: ChannelMixItem): 'brand' | 'performance' {
  const brandTypes = ['内容种草', '品牌广告'];
  const brandRoles = ['认知种草', '口碑沉淀'];
  if (brandTypes.some(t => ch.channel_type.includes(t)) || brandRoles.some(r => ch.role.includes(r))) {
    return 'brand';
  }
  return 'performance';
}

function estimateBaselineMetrics(strategy: StrategyResult) {
  const budget = strategy.strategy_meta.budget_total;
  const roiFloor = strategy.strategy_meta.roi_floor;
  const baseRoi = roiFloor * 1.1;
  const revenue = budget * baseRoi;
  const avgOrderValue = 150;
  const conversions = Math.round((revenue * 10000) / avgOrderValue);
  const cpa = Math.round((budget * 10000) / conversions);
  return { conversions, cpa, roi: Math.round(baseRoi * 100) / 100 };
}

export function computeScenario(strategy: StrategyResult, params: SandboxParams): SandboxResult {
  const baseBudget = strategy.strategy_meta.budget_total;
  const newBudget = Math.round(baseBudget * (1 + params.budget_delta_pct / 100));
  const baseline = estimateBaselineMetrics(strategy);

  const origBrandRatio = strategy.channel_mix.reduce((s, ch) =>
    s + (classifyChannel(ch) === 'brand' ? ch.budget_pct : 0), 0) / 100;

  const brandShift = params.brand_ratio - origBrandRatio;
  const brandSynergyBoost = brandShift > 0 ? brandShift * 0.15 : brandShift * 0.05;

  const budgetScale = newBudget / baseBudget;
  const efficiencyDecay = budgetScale > 1 ? 1 - (budgetScale - 1) * 0.15 : 1 + (1 - budgetScale) * 0.08;

  const pacing = PACING_COEFFICIENTS[params.pacing];

  const channels: ChannelPrediction[] = strategy.channel_mix.map(ch => {
    const chType = classifyChannel(ch);
    let newPct = ch.budget_pct;

    if (chType === 'brand') {
      newPct = ch.budget_pct * (params.brand_ratio / Math.max(origBrandRatio, 0.01));
    } else {
      newPct = ch.budget_pct * (params.performance_ratio / Math.max(1 - origBrandRatio, 0.01));
    }

    const totalPctRaw = strategy.channel_mix.reduce((s, c) => {
      const t = classifyChannel(c);
      if (t === 'brand') return s + c.budget_pct * (params.brand_ratio / Math.max(origBrandRatio, 0.01));
      return s + c.budget_pct * (params.performance_ratio / Math.max(1 - origBrandRatio, 0.01));
    }, 0);
    newPct = newPct / totalPctRaw * 100;

    const amount = Math.round(newBudget * newPct / 100 * 10) / 10;
    const dimFactor = diminishingFactor(newPct / 100);
    const chRoi = Math.round(baseline.roi * dimFactor * (1 + brandSynergyBoost) * pacing.roi_mult * 100) / 100;

    let marginal: ChannelPrediction['marginal_status'] = 'normal';
    if (newPct / 100 > SATURATED_THRESHOLD) marginal = 'saturated';
    else if (newPct / 100 > DIMINISHING_THRESHOLD) marginal = 'diminishing';

    return {
      channel: ch.channel,
      channel_type: ch.channel_type,
      budget_pct: Math.round(newPct * 10) / 10,
      budget_amount: amount,
      predicted_roi: chRoi,
      marginal_status: marginal,
    };
  });

  const totalNormPct = channels.reduce((s, c) => s + c.budget_pct, 0);
  if (Math.abs(totalNormPct - 100) > 0.5) {
    const factor = 100 / totalNormPct;
    for (const c of channels) {
      c.budget_pct = Math.round(c.budget_pct * factor * 10) / 10;
      c.budget_amount = Math.round(newBudget * c.budget_pct / 100 * 10) / 10;
    }
  }

  const overallRoi = Math.round(baseline.roi * efficiencyDecay * (1 + brandSynergyBoost) * pacing.roi_mult * 100) / 100;
  const revenue = newBudget * overallRoi;
  const avgOrderValue = 150;
  const conversions = Math.round((revenue * 10000) / avgOrderValue);
  const cpa = conversions > 0 ? Math.round((newBudget * 10000) / conversions) : 0;

  const weekCount = Math.min(pacing.weekly_shape.length, 12);
  const shapeTotal = pacing.weekly_shape.slice(0, weekCount).reduce((s, v) => s + v, 0);
  const weekly: WeeklyPoint[] = [];
  for (let i = 0; i < weekCount; i++) {
    const w = pacing.weekly_shape[i];
    const weekConv = Math.round(conversions * (w / shapeTotal));
    const weekSpend = Math.round(newBudget * (w / shapeTotal) * 10) / 10;
    weekly.push({ week: `W${i + 1}`, conversions: weekConv, spend: weekSpend });
  }

  return {
    budget_total: newBudget,
    predicted_conversions: conversions,
    conversion_delta_pct: Math.round((conversions / baseline.conversions - 1) * 1000) / 10,
    predicted_cpa: cpa,
    cpa_delta_pct: Math.round((cpa / baseline.cpa - 1) * 1000) / 10,
    predicted_roi: overallRoi,
    roi_delta_pct: Math.round((overallRoi / baseline.roi - 1) * 1000) / 10,
    channel_breakdown: channels,
    weekly_trend: weekly,
    baseline,
  };
}

// ═══════════════════════════════════════════════════════════════
// AI 解读（LLM）
// ═══════════════════════════════════════════════════════════════

interface AgentConfig { endpoint: string; apiKey: string; model: string; }

function getConfig(): AgentConfig {
  const endpoint = process.env.LLM_ENDPOINT;
  const apiKey = process.env.LLM_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error('Missing LLM_ENDPOINT or LLM_API_KEY environment variables. See .env.example for configuration.');
  }
  return {
    endpoint,
    apiKey,
    model: process.env.LLM_MODEL || 'Claude-sonnet-4.6',
  };
}

import { getPrompt, seedPrompt } from './prompts';

function extractAndParseJSON<T>(content: string): T {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : content;
  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart === -1 || braceEnd <= braceStart) throw new Error('No JSON object found');
  const jsonStr = raw.slice(braceStart, braceEnd + 1);
  const attempts = [
    jsonStr,
    jsonStr.replace(/[\x00-\x1f]/g, c => (c === '\n' || c === '\r' || c === '\t') ? ' ' : ''),
  ];
  for (const text of attempts) {
    try { return JSON.parse(text); } catch { /* next */ }
  }
  const stripped = jsonStr.replace(/[\x00-\x1f]/g, c => (c === '\n' || c === '\r' || c === '\t') ? ' ' : '');
  const lastComma = stripped.lastIndexOf(',');
  if (lastComma > 0) {
    const truncated = stripped.slice(0, lastComma);
    let ob = 0, os = 0;
    for (const ch of truncated) { if (ch === '{') ob++; if (ch === '}') ob--; if (ch === '[') os++; if (ch === ']') os--; }
    let suffix = '';
    for (let i = 0; i < ob; i++) suffix += '}';
    for (let i = 0; i < os; i++) suffix += ']';
    try { return JSON.parse(truncated + suffix); } catch { /* final */ }
  }
  throw new Error(`Failed to parse LLM JSON: ${jsonStr.slice(0, 100)}...`);
}

export const SANDBOX_PROMPT = `你是一位量化营销策略分析师，擅长将数学模型的计算结果翻译成可供 CMO 决策参考的商业洞察。

你的任务：基于沙盘推演的参数变化和预测结果，生成 2-3 句精准的决策参考解读。

核心分析视角：

1. 边际收益递减原理
单一渠道预算占比超过40-50%后，ROI会显著下降。识别当前调整是否触发边际收益递减。

2. 品效协同逻辑
品牌广告提升后，效果广告的CTR和CVR会在滞后2-4周后上升。纯效果广告占比>70%在新市场会导致高CPA和低品牌认知。

3. 节奏模式影响
- 均匀铺开：ROI稳定但峰值低
- 集中爆发：节日/竞品关键节点，曝光峰值高，CPA可能升高
- 前重后轻：快速建立认知，后期靠口碑维持
- 前轻后重：已有认知基础的品牌冲量

质量红线：
1. 必须基于数据：解读必须和输入的具体数值对应
2. 不重复UI已展示的数字：用户已看到百分比变化，你解释"为什么"和"接下来怎么做"
3. 结论必须可操作：给具体方向，不说空话
4. 置信度诚实标注
5. 禁止虚假精确

返回纯 JSON（不要 markdown 代码块）：
{
  "insight_primary": "主要洞察（≤50字）",
  "insight_secondary": "次要建议（≤50字）",
  "risk_flag": "风险提示（存在明显风险时输出，否则null）",
  "confidence": "high|medium|low"
}`;

export async function interpretScenario(
  baselineStrategy: StrategyResult,
  params: SandboxParams,
  result: SandboxResult,
  radarContext?: Record<string, unknown> | null,
): Promise<SandboxInterpretation> {
  const config = getConfig();

  const input: Record<string, unknown> = {
    baseline_strategy: {
      budget_total: baselineStrategy.strategy_meta.budget_total,
      brand_ratio: baselineStrategy.channel_mix
        .filter(ch => classifyChannel(ch) === 'brand')
        .reduce((s, ch) => s + ch.budget_pct, 0) / 100,
      market_stage: baselineStrategy.strategy_meta.market_stage,
      channels: baselineStrategy.channel_mix.map(ch => ({
        name: ch.channel, type: ch.channel_type, role: ch.role, pct: ch.budget_pct,
      })),
    },
    sandbox_params: params,
    sandbox_result: {
      budget_total: result.budget_total,
      predicted_conversions: result.predicted_conversions,
      conversion_delta_pct: result.conversion_delta_pct,
      predicted_cpa: result.predicted_cpa,
      cpa_delta_pct: result.cpa_delta_pct,
      predicted_roi: result.predicted_roi,
      roi_delta_pct: result.roi_delta_pct,
      channel_marginal: result.channel_breakdown
        .filter(c => c.marginal_status !== 'normal')
        .map(c => `${c.channel}: ${c.marginal_status}（占比${c.budget_pct}%）`),
    },
  };

  if (radarContext) {
    input.radar_context = radarContext;
  }

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: (() => { seedPrompt('sandbox', SANDBOX_PROMPT); return getPrompt('sandbox') || SANDBOX_PROMPT; })() },
        { role: 'user', content: JSON.stringify(input, null, 2) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');

  try {
    return extractAndParseJSON<SandboxInterpretation>(content);
  } catch {
    return {
      insight_primary: '推演参数已更新，请关注渠道边际收益变化',
      insight_secondary: '建议对比多组参数后综合决策',
      risk_flag: null,
      confidence: 'low',
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 竞争变化响应推演
// ═══════════════════════════════════════════════════════════════

export const COMPETITION_SCENARIO_PROMPT = `你是一位营销战略推演专家，擅长竞争态势研判和快速响应方案设计。

用户将描述一个竞争变化事件（竞品降价/新品发布/服务事故/加大投放），以及当前的策略背景。

你的任务：
1. **影响评估**：该事件对我方用户的流失风险、带来的获客机会、响应紧迫度
2. **三套应对方案**：保守、中性、激进三种应对策略
3. **综合推荐**：推荐最优方案并说明触发条件

每个方案需包含：具体行动清单、预期效果、风险点、资源影响。
判断要基于策略数据，不做空泛推测。

返回纯 JSON（不要 markdown 代码块）：
{
  "impact_assessment": {
    "user_risk": "用户流失风险评估（≤60字）",
    "opportunity": "获客机会评估（≤60字）",
    "urgency": "立即响应|密切关注|暂不行动"
  },
  "response_options": [
    {
      "approach": "保守|中性|激进",
      "description": "方案概述（≤40字）",
      "actions": ["行动1", "行动2", "行动3"],
      "expected_outcome": "预期效果（≤50字）",
      "risk": "风险说明（≤40字）",
      "resource_impact": "资源影响（≤40字）"
    }
  ],
  "recommendation": {
    "preferred": "保守|中性|激进",
    "rationale": "推荐理由（≤60字）",
    "trigger_conditions": "触发执行的前提条件（≤60字）"
  }
}`;

export async function analyzeCompetitionScenario(
  strategy: StrategyResult,
  input: CompetitionScenarioInput,
): Promise<CompetitionScenarioResult> {
  const config = getConfig();

  const userMsg = JSON.stringify({
    event_type: input.event_type,
    event_description: input.event_description,
    severity: input.severity,
    current_strategy: {
      title: strategy.strategy_meta.title,
      main_strategy: strategy.strategy_meta.main_strategy,
      market_stage: strategy.strategy_meta.market_stage,
      budget_total: strategy.strategy_meta.budget_total,
      target_audiences: strategy.target_audiences.map(a => ({ name: a.name, strategy_type: a.strategy_type })),
      channels: strategy.channel_mix.map(ch => ({ name: ch.channel, pct: ch.budget_pct, role: ch.role })),
    },
  }, null, 2);

  seedPrompt('sandbox_competition', COMPETITION_SCENARIO_PROMPT);
  const prompt = getPrompt('sandbox_competition') || COMPETITION_SCENARIO_PROMPT;

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model, stream: false, temperature: 0.2, max_tokens: 4000,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: userMsg }],
    }),
  });

  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  return extractAndParseJSON<CompetitionScenarioResult>(content);
}

// ═══════════════════════════════════════════════════════════════
// 时机节奏推演
// ═══════════════════════════════════════════════════════════════

export const TIMING_SCENARIO_PROMPT = `你是一位营销节奏规划专家，擅长根据市场时机和关键节点设计最优发力节奏。

用户将提供关键日期/事件列表和当前策略背景。

你的任务：
1. **最优时机窗口**：识别2-4个最值得发力的时间节点
2. **分阶段执行计划**：预热→主攻→收割→维稳，每阶段的预算占比、关键动作和里程碑
3. **综合推荐**：最优节奏策略的一句话总结

返回纯 JSON（不要 markdown 代码块）：
{
  "optimal_windows": [
    {
      "window": "时间窗口描述",
      "rationale": "选择理由",
      "recommended_action": "建议动作",
      "impact": "高|中|低"
    }
  ],
  "phase_plan": [
    {
      "phase": "预热期|主攻期|收割期|维稳期",
      "period": "具体日期范围",
      "objective": "阶段目标",
      "budget_pct": 20,
      "key_actions": ["行动1", "行动2"],
      "milestone": "关键里程碑"
    }
  ],
  "recommendation": "整体节奏建议（≤80字）"
}`;

export async function analyzeTimingScenario(
  strategy: StrategyResult,
  input: TimingScenarioInput,
): Promise<TimingScenarioResult> {
  const config = getConfig();

  const userMsg = JSON.stringify({
    key_dates: input.key_dates,
    focus_mode: input.focus_mode,
    current_strategy: {
      title: strategy.strategy_meta.title,
      period: strategy.strategy_meta.period,
      budget_total: strategy.strategy_meta.budget_total,
      market_stage: strategy.strategy_meta.market_stage,
      channels: strategy.channel_mix.map(ch => ({ name: ch.channel, pct: ch.budget_pct })),
      current_pacing: strategy.time_pacing,
    },
  }, null, 2);

  seedPrompt('sandbox_timing', TIMING_SCENARIO_PROMPT);
  const prompt = getPrompt('sandbox_timing') || TIMING_SCENARIO_PROMPT;

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model, stream: false, temperature: 0.2, max_tokens: 4000,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: userMsg }],
    }),
  });

  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  return extractAndParseJSON<TimingScenarioResult>(content);
}

// ═══════════════════════════════════════════════════════════════
// 策略方案对比推演
// ═══════════════════════════════════════════════════════════════

export const COMPARISON_SCENARIO_PROMPT = `你是一位营销策略评估专家，擅长多方案对比分析和最优方案推荐。

用户将提供2-3个营销策略方案的完整数据。

你的任务：
1. **多维度评分**：对每个方案从增长潜力、执行难度、风险水平、资源效率四个维度打分（1-10）
2. **优劣势分析**：每个方案的2-3个核心优势和2-3个核心劣势
3. **取舍分析**：方案间的核心权衡点
4. **综合推荐**：推荐最优方案或混合方案

返回纯 JSON（不要 markdown 代码块）：
{
  "strategies": [
    {
      "strategy_id": 1,
      "title": "策略标题",
      "scores": {
        "growth_potential": 8,
        "execution_difficulty": 6,
        "risk_level": 5,
        "resource_efficiency": 7
      },
      "strengths": ["优势1", "优势2"],
      "weaknesses": ["劣势1", "劣势2"],
      "core_assumption": "核心假设（≤40字）"
    }
  ],
  "trade_offs": ["取舍点1", "取舍点2"],
  "recommendation": {
    "preferred_id": 1,
    "rationale": "推荐理由（≤60字）",
    "hybrid_suggestion": "混合方案建议（≤80字）"
  }
}`;

export async function compareStrategies(
  strategies: Array<{ id: number; result: StrategyResult }>,
): Promise<ComparisonScenarioResult> {
  const config = getConfig();

  const userMsg = JSON.stringify({
    strategies: strategies.map(s => ({
      id: s.id,
      title: s.result.strategy_meta.title,
      goal: s.result.strategy_meta.goal_summary,
      budget: s.result.strategy_meta.budget_total,
      market_stage: s.result.strategy_meta.market_stage,
      main_strategy: s.result.strategy_meta.main_strategy,
      audiences: s.result.target_audiences.map(a => ({ name: a.name, strategy_type: a.strategy_type })),
      channels: s.result.channel_mix.map(ch => ({ name: ch.channel, pct: ch.budget_pct, role: ch.role })),
      assumptions: s.result.key_assumptions.map(a => a.statement),
    })),
  }, null, 2);

  seedPrompt('sandbox_comparison', COMPARISON_SCENARIO_PROMPT);
  const prompt = getPrompt('sandbox_comparison') || COMPARISON_SCENARIO_PROMPT;

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model, stream: false, temperature: 0.2, max_tokens: 4000,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: userMsg }],
    }),
  });

  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  return extractAndParseJSON<ComparisonScenarioResult>(content);
}
