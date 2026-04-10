import type { StrategyInput, StrategyResult, OpportunityData, StrategyChatResponse } from './types';
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
  console.log(`[Strategy Agent] Calling LLM (${config.model})...`);
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
      temperature: 0.15,
      max_tokens: 60000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  const finishReason = choice?.finish_reason;
  if (!content) throw new Error('LLM returned empty content');
  console.log(`[Strategy Agent] LLM responded in ${Date.now() - startTime}ms (${content.length} chars, finish_reason: ${finishReason})`);
  if (finishReason === 'length') {
    console.warn('[Strategy Agent] Response was truncated due to token limit');
  }
  const json = extractJSON(content);
  console.log(`[Strategy Agent] Extracted JSON: ${json.length} chars, ends: ...${json.slice(-60)}`);
  return json;
}

// ═══ Phase 1 Prompt: S(Situation) + C(Competition) ═══
const PHASE1_PROMPT = `你是一位资深营销战略顾问，擅长市场格局分析和竞争情报。

你的任务是完成 SCRAP 五层策略模型的前两层：市场态势全景（S）和竞争情报分析（C），并给出策略概览。

═══ S — 市场态势全景 ═══
1. 市场分层识别：将全量目标用户分为五层（增量新用户、竞品活跃用户、竞品不满用户、本品沉睡用户、本品高价值用户），估算规模和优先级
2. 增量 vs 存量判断：市场增速趋势，增量机会和存量争夺哪个优先
3. 市场时机判断：政策/行业/竞品动向带来的机会窗口

═══ C — 竞争情报与机会 ═══
1. 竞品优劣势矩阵：从产品功能、定价性价比、服务质量、用户口碑、品牌认知、用户粘性6个维度评分对比
2. 可争夺用户画像：竞品用户的核心痛点、迁移动因和阻力
3. 差异化切入点：重点进攻/快速补齐/强化防守/暂缓投入四象限

严格返回纯 JSON（不要 markdown 代码块），每个文本字段控制在80字以内：

{
  "strategy_meta": {
    "title": "策略标题",
    "goal_summary": "一句话核心战略定位",
    "period": "YYYY-MM-DD ~ YYYY-MM-DD",
    "budget_total": 300,
    "roi_floor": 1.8,
    "market_stage": "尝鲜期|早期|大众期|衰退期",
    "market_stage_rationale": "阶段判断理由",
    "competition_type": "存量竞争|增量开拓",
    "main_strategy": "核心策略方向（三路截流等）"
  },
  "market_situation": {
    "user_segments": [
      {
        "layer": "增量新用户|竞品活跃用户|竞品不满用户|本品沉睡用户|本品高价值用户",
        "description": "该层用户的特征描述",
        "scale_estimate": "规模估算",
        "priority": 1,
        "strategic_value": "战略意义"
      }
    ],
    "market_assessment": {
      "growth_phase": "高速增长|平稳|萎缩",
      "incremental_vs_stock": "增量优先|存量优先|并重",
      "rationale": "判断依据"
    },
    "timing_opportunities": [
      { "opportunity": "机会描述", "window": "时间窗口", "impact": "高|中|低" }
    ]
  },
  "competition_analysis": {
    "competitor_matrix": [
      {
        "name": "竞品名称",
        "dimensions": [
          { "dimension": "产品功能|定价性价比|服务质量|用户口碑|品牌认知|用户粘性", "competitor_score": 7, "own_score": 8, "gap_analysis": "差距说明" }
        ]
      }
    ],
    "targetable_users": [
      {
        "source_competitor": "来源竞品",
        "user_profile": "用户特征",
        "core_pain_point": "核心痛点",
        "migration_driver": "迁移动因",
        "migration_barrier": "迁移阻力",
        "counter_strategy": "应对策略"
      }
    ],
    "differentiation_points": [
      { "point": "差异化切入点", "zone": "重点进攻|快速补齐|强化防守|暂缓投入", "narrative": "一句话核心信息" }
    ]
  }
}

数量限制：user_segments最多5个，competitor_matrix最多3个竞品每个最多6维度，targetable_users最多3个，differentiation_points最多4个。`;

// ═══ Phase 2 Prompt: R(Route) + A(Action) + P(Prediction) ═══
const PHASE2_PROMPT = `你是一位营销执行方案专家，专注于将市场洞察和竞争情报转化为可落地的策略路径、执行方案和关键假设。

你将收到前一阶段已完成的市场态势分析（S）和竞争情报分析（C）。基于这些分析结论，完成 SCRAP 模型的后三层：

═══ R — 策略路径与目标人群 ═══
四大策略路径：
- 进攻型：主动争夺竞品不满/流失用户（竞品差评定向投放、"平替/升级"内容营销、迁移补贴）
- 开拓型：激活增量市场潜客（品类教育、低门槛试用、KOL种草、裂变设计）
- 防守型：强化存量用户粘性（高价值专属权益、流失预警、情感化内容）
- 深耕型：提升现有用户LTV（沉睡唤醒、增购引导、分层运营）

为每个目标人群选择最优路径，说明"为什么"和"如果不这样做会怎样"。

═══ A — 执行落地设计 ═══
1. 产品承接设计：针对每类目标用户，首次关键体验如何设计？产品差异化是什么？
2. 活动方案设计：2-3个匹配策略的活动（主题/用户/机制/转化路径）
3. 内容策略：对竞品用户/新用户/存量用户分别采用什么叙事
4. 渠道组合：各渠道的角色分工（认知种草/意向拦截/场景触达/效果转化/口碑沉淀）

═══ P — 关键假设 ═══
每个假设必须可量化、可验证，标注风险等级和验证方式。

质量红线：
1. 渠道预算总和必须=100%
2. 每个策略建议必须说明"为什么"和"如果不这样做会怎样"

严格返回纯 JSON（不要 markdown 代码块），每个文本字段控制在80字以内：

{
  "target_audiences": [{
    "priority": 1,
    "name": "人群名称",
    "demographics": "人口属性",
    "scenario": "使用场景",
    "core_motivation": "核心动机",
    "relation_to_competitor": "与竞品用户关系",
    "strategy_type": "截流|顺向",
    "key_message": "核心传播信息"
  }],
  "channel_mix": [{
    "channel": "渠道名称",
    "channel_type": "效果广告|内容种草|品牌广告|线下|搜索广告",
    "role": "认知种草|意向拦截|场景触达|效果转化|口碑沉淀",
    "budget_pct": 40,
    "budget_amount": 120,
    "target_kpi": "CPM≤30,CPA≤35",
    "audience_match": ["人群名称"],
    "creative_direction": "创意方向",
    "risk": "风险说明"
  }],
  "channel_total_check": "100%",
  "execution_plan": {
    "product_designs": [
      {
        "user_group": "目标用户群",
        "first_experience": "首次关键体验设计",
        "differentiation": "产品差异化设计",
        "success_metric": "承接成功指标"
      }
    ],
    "campaign_ideas": [
      {
        "theme": "活动主题",
        "target_user": "目标用户",
        "mechanism": "激励机制",
        "expected_conversion_path": "预期转化路径"
      }
    ],
    "content_strategy": {
      "competitor_users_narrative": "对竞品用户的内容叙事",
      "new_users_narrative": "对新用户的品类教育路径",
      "existing_users_narrative": "对存量用户的激活触点"
    }
  },
  "time_pacing": [{
    "phase": "测试期|放量期|收尾期",
    "weeks": "W1-W2",
    "budget_pct": 15,
    "budget_amount": 45,
    "objective": "阶段目标",
    "decision_gate": "决策关卡条件或null"
  }],
  "key_assumptions": [{
    "id": "a1",
    "statement": "可量化假设命题",
    "basis": "假设依据",
    "risk_level": "高|中|低",
    "risk_note": "风险说明",
    "validation_method": "验证方式"
  }]
}

数量限制：target_audiences最多3个，channel_mix最多5个，product_designs最多3个，campaign_ideas最多3个，key_assumptions最多4个。`;

export const STRATEGY_PROMPT = PHASE1_PROMPT;

function buildDataSupplement(radarContext?: Record<string, unknown> | null, documentContext?: string): string {
  let supplement = '';
  if (radarContext) {
    supplement += `\n\n## 竞品雷达数据说明
用户提供了来自竞品雷达模块的实际舆情分析数据（radar_intelligence 字段）。这些数据包含：
- brands: 被监测的竞品品牌/关键词列表
- totalItems: 采集的原始数据总量
- sentiment: 情感分析统计（正面/中性/负面条数）
- topics: 话题聚类结果（话题名、涉及数量、情感倾向）
- topNegative: 差评深挖结果（核心问题、严重性判断）
- opportunities: 已识别的竞品机会点（痛点→切入点）

请深度利用这些真实数据来佐证分析，确保结论有数据支撑。`;
  }
  if (documentContext) {
    supplement += `\n\n## 参考文档说明
用户上传了参考文档（白皮书、行业报告、内部资料等），内容在 user message 的 "reference_documents" 字段中。
请深度利用文档中的行业趋势、市场数据、用户画像等关键信息作为策略依据。`;
  }
  return supplement;
}

export async function generateStrategy(
  input: StrategyInput,
  opportunities?: OpportunityData[],
  radarContext?: Record<string, unknown> | null,
  documentContext?: string,
): Promise<StrategyResult> {
  const userInput: Record<string, unknown> = {
    business_goal: input.business_goal,
    core_metric: input.core_metric,
    period: input.period,
    budget_total: input.budget_total,
    roi_floor: input.roi_floor,
  };

  if (opportunities && opportunities.length > 0) {
    userInput.opportunities = opportunities.map(o => ({
      title: o.title, description: o.description,
      confidence: o.confidence, brand: o.brand, topic: o.topic,
    }));
  }
  if (input.industry_context) userInput.industry_context = input.industry_context;
  if (input.competitors && input.competitors.length > 0) userInput.competitors = input.competitors;
  if (input.own_brand) userInput.own_brand = input.own_brand;
  if (input.market_background) userInput.market_background = input.market_background;
  if (radarContext) userInput.radar_intelligence = radarContext;
  if (documentContext) {
    userInput.reference_documents = documentContext;
    console.log(`[Strategy Agent] Document context: ${documentContext.length} chars`);
  }

  const dataSupplement = buildDataSupplement(radarContext, documentContext);
  const userMsg = JSON.stringify(userInput, null, 2);

  // ═══ Phase 1: S(Situation) + C(Competition) ═══
  console.log('[Strategy Agent] === Phase 1: Market Situation + Competition Analysis ===');
  const phase1Prompt = PHASE1_PROMPT + dataSupplement;
  const phase1Raw = await callLLM(
    phase1Prompt,
    `请基于以下业务输入，完成市场态势全景分析（S）和竞争情报分析（C）：\n\n${userMsg}`,
  );
  const phase1 = robustParseJSON<Partial<StrategyResult>>(phase1Raw);

  const p1Fields = ['strategy_meta', 'market_situation', 'competition_analysis'];
  const p1Missing = p1Fields.filter(f => !(f in phase1));
  if (p1Missing.length > 0) {
    console.warn(`[Strategy Agent] Phase 1 missing: ${p1Missing.join(', ')}`);
  }

  // ═══ Phase 2: R(Route) + A(Action) + P(Prediction) ═══
  console.log('[Strategy Agent] === Phase 2: Route + Action + Prediction ===');
  const phase1Summary = {
    strategy_meta: phase1.strategy_meta,
    market_situation_summary: phase1.market_situation ? {
      user_segments: phase1.market_situation.user_segments?.map(s => `${s.layer}(P${s.priority}): ${s.description}`),
      market_assessment: phase1.market_situation.market_assessment,
      timing: phase1.market_situation.timing_opportunities?.map(t => t.opportunity),
    } : null,
    competition_summary: phase1.competition_analysis ? {
      targetable_users: phase1.competition_analysis.targetable_users?.map(u => `${u.source_competitor}: ${u.core_pain_point}`),
      differentiation: phase1.competition_analysis.differentiation_points?.map(d => `[${d.zone}] ${d.point}`),
    } : null,
  };

  const phase2Prompt = PHASE2_PROMPT + dataSupplement;
  const phase2Raw = await callLLM(
    phase2Prompt,
    `以下是前一阶段的市场态势和竞争情报分析结论：\n${JSON.stringify(phase1Summary, null, 2)}\n\n原始业务输入：\n${userMsg}\n\n请基于以上分析，完成策略路径（R）、执行方案（A）和关键假设（P）。`,
  );
  const phase2 = robustParseJSON<Partial<StrategyResult>>(phase2Raw);

  const p2Fields = ['target_audiences', 'channel_mix', 'execution_plan', 'time_pacing', 'key_assumptions'];
  const p2Missing = p2Fields.filter(f => !(f in phase2));
  if (p2Missing.length > 0) {
    console.warn(`[Strategy Agent] Phase 2 missing: ${p2Missing.join(', ')}`);
  }

  // ═══ Merge results ═══
  const result: StrategyResult = {
    strategy_meta: phase1.strategy_meta || phase2.strategy_meta || ({} as StrategyResult['strategy_meta']),
    market_situation: phase1.market_situation || undefined,
    competition_analysis: phase1.competition_analysis || undefined,
    target_audiences: phase2.target_audiences || [],
    channel_mix: phase2.channel_mix || [],
    channel_total_check: phase2.channel_total_check || '100%',
    execution_plan: phase2.execution_plan || undefined,
    time_pacing: phase2.time_pacing || [],
    key_assumptions: phase2.key_assumptions || [],
  } as StrategyResult;

  const allExpected = [...p1Fields, ...p2Fields];
  const allMissing = allExpected.filter(f => !(f in result) || result[f as keyof StrategyResult] === undefined);
  if (allMissing.length > 0) {
    console.warn(`[Strategy Agent] FINAL missing fields: ${allMissing.join(', ')}`);
  } else {
    console.log('[Strategy Agent] All SCRAP fields generated successfully');
  }

  if (result.channel_mix.length > 0) {
    const totalPct = result.channel_mix.reduce((sum, ch) => sum + ch.budget_pct, 0);
    if (Math.abs(totalPct - 100) > 1) {
      console.warn(`[Strategy Agent] Channel budget total ${totalPct}% != 100%, auto-normalizing`);
      const factor = 100 / totalPct;
      for (const ch of result.channel_mix) {
        ch.budget_pct = Math.round(ch.budget_pct * factor);
        ch.budget_amount = Math.round(input.budget_total * ch.budget_pct / 100 * 10) / 10;
      }
      result.channel_total_check = '100%';
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// 对话式问答 + 策略修正
// ═══════════════════════════════════════════════════════════════

export const CHAT_PROMPT = `你是 GrowthBox 的营销决策助手，具备 CMO 级营销策略能力。你的任务：基于当前策略数据，回答用户的决策问题，并在需要时修正策略。

核心行为准则：

1. 严格基于上下文数据作答。若问题超出当前数据范围，明确告知。

2. 意图识别：
- 查询类（"哪个渠道预算最高？"）→ 从数据检索，简洁回答
- 分析类（"为什么选这个渠道？"）→ 结合策略逻辑给出有依据的分析
- 决策类（"预算砍到100万怎么办？"）→ 基于ROI和角色分工给推荐，附理由
- 调整类（"把小红书预算提到25%"）→ 修正策略并返回更新后的完整策略JSON

3. 回答风格：直接给结论再给理由，数字要具体，3-5句话。

4. 当用户意图是"调整类"时，你必须：
- 在 answer 中说明调整了什么、为什么这样调整
- 将 modification_intent.triggered 设为 true
- 在 updated_strategy 中返回修正后的完整策略 JSON（与原始策略结构完全一致）
- 渠道预算调整后确保总和 = 100%

5. 边界处理：
- 用户要求重新生成 → 引导去新建页
- 用户问与策略无关的话题 → 明确告知只能回答策略相关问题

返回纯 JSON（不要 markdown 代码块、不要解释文字）：
{
  "answer": "回答文本",
  "action_type": "query|analysis|decision|modification",
  "modification_intent": {"triggered": false, "description": null},
  "confidence": "high|medium|low",
  "updated_strategy": null
}

当 modification_intent.triggered 为 true 时，updated_strategy 必须是完整的策略 JSON（包含 strategy_meta, target_audiences, channel_mix, channel_total_check, time_pacing, key_assumptions 全部字段）。`;

export interface ChatInput {
  question: string;
  tab_context: string;
  conversation_history: Array<{ role: 'user' | 'assistant'; content: string }>;
  current_strategy: StrategyResult;
}

export async function chatWithStrategy(input: ChatInput): Promise<StrategyChatResponse> {
  const contextSummary: Record<string, unknown> = {
    page_context: 'strategy',
    active_tab: input.tab_context,
    current_data: input.current_strategy,
    user_question: input.question,
  };

  if (input.conversation_history.length > 0) {
    contextSummary.conversation_history = input.conversation_history.slice(-6);
  }

  seedPrompt('strategy_chat', CHAT_PROMPT);
  const chatPrompt = getPrompt('strategy_chat') || CHAT_PROMPT;
  const raw = await callLLM(
    chatPrompt,
    JSON.stringify(contextSummary, null, 2),
  );

  const result = robustParseJSON<StrategyChatResponse>(raw);

  if (result.updated_strategy) {
    const totalPct = result.updated_strategy.channel_mix.reduce((sum, ch) => sum + ch.budget_pct, 0);
    if (Math.abs(totalPct - 100) > 1) {
      const factor = 100 / totalPct;
      const budget = result.updated_strategy.strategy_meta.budget_total;
      for (const ch of result.updated_strategy.channel_mix) {
        ch.budget_pct = Math.round(ch.budget_pct * factor);
        ch.budget_amount = Math.round(budget * ch.budget_pct / 100 * 10) / 10;
      }
      result.updated_strategy.channel_total_check = '100%';
    }
  }

  return result;
}
