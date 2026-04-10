import type { CsvRow, RetroResult, StrategyResult, KeyAssumption } from './types';
import { getPrompt, seedPrompt } from './prompts';

interface AgentConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

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

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }
  return text.trim();
}

function robustParseJSON<T>(raw: string): T {
  const attempts = [
    raw,
    raw.replace(/("(?:[^"\\]|\\.)*")/g, (m) =>
      m.replace(/(?<!\\)\t/g, '\\t').replace(/(?<!\\)\n/g, '\\n').replace(/(?<!\\)\r/g, '\\r'),
    ),
    raw.replace(/[\x00-\x1f]/g, (c) => (c === '\n' || c === '\r' || c === '\t') ? ' ' : ''),
  ];
  for (const text of attempts) {
    try { return JSON.parse(text); } catch { /* next */ }
  }
  const stripped = raw.replace(/[\x00-\x1f]/g, (c) => (c === '\n' || c === '\r' || c === '\t') ? ' ' : '');
  const lastGoodComma = stripped.lastIndexOf(',');
  if (lastGoodComma > 0) {
    const truncated = stripped.slice(0, lastGoodComma);
    let opens = 0, openBraces = 0;
    for (const ch of truncated) {
      if (ch === '[') opens++;
      if (ch === ']') opens--;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
    }
    let suffix = '';
    for (let i = 0; i < openBraces; i++) suffix += '}';
    for (let i = 0; i < opens; i++) suffix += ']';
    try { return JSON.parse(truncated + suffix); } catch { /* final */ }
  }
  throw new Error(`Failed to parse LLM JSON (${raw.length} chars): ${raw.slice(0, 100)}...`);
}

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const config = getConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('LLM not configured');
  console.log(`[Retro Agent] Calling LLM (${config.model})...`);
  const startTime = Date.now();
  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      temperature: 0.1,
      max_tokens: 16000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM API error ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  console.log(`[Retro Agent] LLM responded in ${Date.now() - startTime}ms (${content.length} chars)`);
  return extractJSON(content);
}

export const RETRO_PROMPT = `你是一位专注于营销效果归因的增长分析师，有丰富的 Campaign 复盘经验。你的核心能力是：透过表面的 ROI 数字，找到「真正导致结果差异」的根本原因，并将复盘结论转化为下轮可执行的策略更新。

### 漏斗分层归因原则

每一层转化率的异常，都指向不同的问题域：

| 漏斗层            | 低于预期时的检查项                               |
| ----------------- | ------------------------------------------------ |
| 曝光量            | 预算花完了吗？竞价是否合理？时间段覆盖是否正确？ |
| 曝光→点击（CTR）  | 创意吸引力、标题、首帧、受众匹配度               |
| 点击→激活（CVR1） | 落地页加载速度、内容相关性、注册门槛             |
| 激活→订单（CVR2） | 新用户引导、首单优惠、产品核心体验               |

### 归因类别定义

按以下5个类别分配权重（总和必须 = 100%）：

- **素材问题**：CTR 低于预期 >15%，且不同渠道普遍存在
- **执行不足**：预算未花完，或投放时段/人群定向执行有误
- **产品承接**：CTR 正常但 CVR1 显著低于预期
- **外部竞争**：竞品同期加大投放或推出强力活动
- **策略偏差**：渠道选择或人群定向与目标人群不符

### 假设验证判断标准

- verified（成立）：实际数据在假设值 ±10% 范围内
- partial（部分成立）：方向正确但数值偏离 10%-30%
- failed（不成立）：数值偏离 >30% 或方向相反

### 执行步骤（按此顺序）

1. 汇总实际指标：按渠道聚合全周期，计算总曝光/点击/激活/订单/花费/营收/整体ROI
2. 漏斗拆解：计算每层转化率（实际 vs 目标），标记 green/yellow/red，红色层给出初步假设原因
3. 渠道表现评级：每渠道实际ROI vs 目标ROI，评级超预期/达标/低于预期，生成1句洞察
4. 归因分析：基于漏斗结果按5类分配权重，每类附至少1条数据证据
5. 假设验证：逐条对照，输出验证结论 + 建议更新值
6. 下轮建议：渠道预算调整（明确百分比）+ 素材建议 + 人群建议 + 假设更新值

### 输出格式（严格遵守 JSON）

{
  "overall_summary": {
    "goal_achievement": "一句话说明目标完成情况",
    "roi_achievement": "ROI实际值 vs 底线",
    "total_spend": 数字,
    "total_revenue": 数字,
    "total_orders": 数字,
    "status": "达成|部分达成|未达成"
  },
  "funnel_breakdown": [
    {
      "stage": "曝光→点击",
      "actual_rate": 小数,
      "target_rate": 小数,
      "delta_pct": 百分比偏差,
      "status": "green|yellow|red",
      "hypothesis": "原因假设"
    }
  ],
  "channel_performance": [
    {
      "channel": "渠道名",
      "actual_roi": 数字,
      "target_roi": 数字,
      "delta_pct": 百分比偏差,
      "status": "超预期|达标|低于预期",
      "insight": "1句洞察",
      "next_round_action": "下轮建议动作",
      "spend": 花费,
      "revenue": 营收,
      "impressions": 曝光,
      "clicks": 点击,
      "orders": 订单
    }
  ],
  "attribution": [
    {
      "category": "素材问题|执行不足|产品承接|外部竞争|策略偏差",
      "weight": 占比(总和=100),
      "evidence": "数据证据",
      "detail": "补充说明或null"
    }
  ],
  "assumption_validation": [
    {
      "assumption_id": "id",
      "statement": "假设原文",
      "actual_value": "实际数值",
      "status": "verified|partial|failed",
      "conclusion": "验证结论",
      "updated_assumption": "更新后的假设"
    }
  ],
  "next_round_recommendations": {
    "budget_reallocation": [
      { "channel": "渠道", "current_pct": 当前占比, "recommended_pct": 建议占比, "reason": "原因" }
    ],
    "creative_strategy": ["素材建议1", "素材建议2"],
    "audience_strategy": ["人群建议1"],
    "updated_assumptions": [
      { "id": "假设ID", "old": "旧值", "new": "新值", "basis": "依据" }
    ]
  }
}

### 质量红线

1. 禁止懒归因：「整体执行不到位」无效，必须指向具体渠道、具体时段、具体数据
2. 正向归因同样重要：超预期的渠道必须解释原因
3. 假设验证必须给更新建议：不能只说「假设不成立」，必须给出修正后的新值
4. 下轮建议必须有具体百分比：「适当增加小红书」无效，「小红书15%→20%」有效
5. 归因权重总和必须 = 100%，不能均等平摊

### 长度控制（非常重要）
- 每个字符串字段不超过 80 字
- insight / hypothesis / conclusion / evidence 等描述性字段保持精练
- 如果无关联策略假设可对照，assumption_validation 返回空数组 []
- 严格只返回 JSON，不要加任何前后说明文字`;

function aggregateCsvData(rows: CsvRow[]) {
  const channels = new Map<string, {
    impressions: number; clicks: number; activations: number;
    orders: number; spend: number; revenue: number; days: number;
  }>();

  for (const row of rows) {
    const ch = channels.get(row.channel) || {
      impressions: 0, clicks: 0, activations: 0,
      orders: 0, spend: 0, revenue: 0, days: 0,
    };
    ch.impressions += row.impressions;
    ch.clicks += row.clicks;
    ch.activations += row.activations;
    ch.orders += row.orders;
    ch.spend += row.spend;
    ch.revenue += row.revenue;
    ch.days += 1;
    channels.set(row.channel, ch);
  }

  let totalImpressions = 0, totalClicks = 0, totalActivations = 0;
  let totalOrders = 0, totalSpend = 0, totalRevenue = 0;
  for (const v of channels.values()) {
    totalImpressions += v.impressions;
    totalClicks += v.clicks;
    totalActivations += v.activations;
    totalOrders += v.orders;
    totalSpend += v.spend;
    totalRevenue += v.revenue;
  }

  return {
    channels,
    totals: { totalImpressions, totalClicks, totalActivations, totalOrders, totalSpend, totalRevenue },
  };
}

export async function generateRetroReport(
  csvRows: CsvRow[],
  strategy?: StrategyResult | null,
): Promise<RetroResult> {
  const { channels, totals } = aggregateCsvData(csvRows);

  const channelSummary = Array.from(channels.entries()).map(([name, d]) => ({
    channel: name,
    impressions: d.impressions,
    clicks: d.clicks,
    activations: d.activations,
    orders: d.orders,
    spend: d.spend,
    revenue: d.revenue,
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) : 0,
    cvr1: d.clicks > 0 ? (d.activations / d.clicks) : 0,
    cvr2: d.activations > 0 ? (d.orders / d.activations) : 0,
    roi: d.spend > 0 ? (d.revenue / d.spend) : 0,
  }));

  const overallROI = totals.totalSpend > 0 ? (totals.totalRevenue / totals.totalSpend) : 0;

  const strategyContext = strategy ? {
    goal: strategy.strategy_meta.goal_summary,
    budget_total: strategy.strategy_meta.budget_total,
    roi_floor: strategy.strategy_meta.roi_floor,
    channels: strategy.channel_mix.map(c => ({
      channel: c.channel,
      budget_pct: c.budget_pct,
      target_kpi: c.target_kpi,
      role: c.role,
    })),
    key_assumptions: strategy.key_assumptions,
  } : null;

  const userMessage = JSON.stringify({
    actual_data_summary: {
      overall: {
        ...totals,
        overall_roi: Math.round(overallROI * 100) / 100,
      },
      by_channel: channelSummary,
      date_range: {
        start: csvRows[0]?.date,
        end: csvRows[csvRows.length - 1]?.date,
      },
      total_days: new Set(csvRows.map(r => r.date)).size,
    },
    strategy_context: strategyContext,
  }, null, 2);

  seedPrompt('retro', RETRO_PROMPT);
  const retroPrompt = getPrompt('retro') || RETRO_PROMPT;
  const raw = await callLLM(retroPrompt, userMessage);
  return robustParseJSON<RetroResult>(raw);
}

export function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ['CSV至少需要包含标题行和一行数据'] };

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const required = ['channel', 'date', 'impressions', 'clicks', 'activations', 'orders', 'spend', 'revenue'];
  const missing = required.filter(f => !header.includes(f));
  if (missing.length > 0) return { rows: [], errors: [`缺少必要字段: ${missing.join(', ')}`] };

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim());
    if (vals.length < header.length) {
      errors.push(`第${i + 1}行: 字段数量不足（期望${header.length}列，实际${vals.length}列）`);
      continue;
    }
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => { obj[h] = vals[idx]; });

    const numFields = ['impressions', 'clicks', 'activations', 'orders', 'spend', 'revenue'];
    let hasError = false;
    for (const f of numFields) {
      if (isNaN(Number(obj[f]))) {
        errors.push(`第${i + 1}行: ${f}不是有效数字（值="${obj[f]}"）`);
        hasError = true;
      }
    }
    if (hasError) continue;

    rows.push({
      channel: obj.channel,
      date: obj.date,
      impressions: Number(obj.impressions),
      clicks: Number(obj.clicks),
      activations: Number(obj.activations),
      orders: Number(obj.orders),
      spend: Number(obj.spend),
      revenue: Number(obj.revenue),
    });
  }

  return { rows, errors };
}
