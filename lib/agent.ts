import type { SentimentResult, TopicResult, TopNegative, OpportunityData } from './types';
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

function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/\u0000/g, '');
}

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const config = getConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('LLM not configured');

  console.log(`[Agent] Calling LLM (${config.model})...`);
  const startTime = Date.now();

  const cleanSystem = sanitizeText(systemPrompt);
  const cleanUser = sanitizeText(userMessage);

  const payload = {
    model: config.model,
    stream: false,
    temperature: 0.1,
    max_tokens: 8000,
    messages: [
      { role: 'system', content: cleanSystem },
      { role: 'user', content: cleanUser },
    ],
  };

  const bodyStr = JSON.stringify(payload);
  console.log(`[Agent] Request body length: ${bodyStr.length} chars`);

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM API error ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  console.log(`[Agent] LLM responded in ${Date.now() - startTime}ms (${content.length} chars)`);
  return extractJSON(content);
}

// ═══════════════════════════════════════════════════════════════
// 第一步：情感与主题分层
// ═══════════════════════════════════════════════════════════════

export const SENTIMENT_PROMPT = `你是一位拥有15年经验的消费互联网竞争情报分析师。

任务：对采集到的竞品评论/内容进行情感分类。

分类规则（必须明确归类，不得模糊处理）：
- positive：明确表达满意、推荐、认可、好评
- negative：明确表达不满、投诉、批评、抱怨
- neutral：客观描述事实、转述新闻、无明显情感倾向
- emoji、网络用语（如yyds、绝了、无语）也要纳入情感判断

输出要求：
- 统计三类情感的条数
- details 只取每种情感最具代表性的 5 条做摘要（最多共 15 条）
- content 字段为原文精简摘要，不超过 40 字，不含换行符

严格返回 JSON（不要加解释文字、不要加 markdown 代码块）：
{"positive":数量,"neutral":数量,"negative":数量,"details":[{"content":"摘要","sentiment":"positive|neutral|negative"}]}`;

export async function analyzeSentiment(items: Array<{ content: string }>): Promise<SentimentResult> {
  seedPrompt('sentiment', SENTIMENT_PROMPT);
  const prompt = getPrompt('sentiment') || SENTIMENT_PROMPT;
  const sample = items.slice(0, 100);
  const texts = sample.map((it, i) => `${i + 1}. ${it.content.slice(0, 60)}`).join('\n');
  const raw = await callLLM(prompt, `以下是从微博、小红书等渠道采集的 ${sample.length} 条竞品相关内容（共采集 ${items.length} 条）：\n\n${texts}`);
  const result = robustParseJSON<SentimentResult>(raw);
  if (items.length > sample.length) {
    const ratio = items.length / sample.length;
    result.positive = Math.round(result.positive * ratio);
    result.neutral = Math.round(result.neutral * ratio);
    result.negative = Math.round(result.negative * ratio);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// 第一步（续）：主题聚类
// ═══════════════════════════════════════════════════════════════

export const TOPIC_PROMPT = `你是一位拥有15年经验的消费互联网竞争情报分析师。

任务：对竞品评论数据进行主题聚类，识别用户讨论的核心话题。

主题标签参考（可根据实际内容新增）：
- 价格体验（价格、性价比、收费、计费、优惠）
- 取还车流程（取车、还车、解锁、停车桩、等待）
- 车况与安全（车况、刹车、故障、脏、旧、安全）
- 客服响应（客服、投诉、回复、退款）
- App体验（App、定位、闪退、操作、导航）
- 活动权益（优惠券、月卡、骑行卡、促销、积分）
- 品牌对比（评测、对比、推荐、选择）
- 覆盖范围（找不到车、投放量、区域覆盖）

规则：
- 最多 8 个话题，按评论数量降序
- 同一条评论可归属多个主题（但统计时不重复计数）
- 每个话题必须判断整体情感倾向
- negative_ratio 高的话题重点标注

严格返回 JSON（不要加解释文字、不要加 markdown 代码块）：
{"topics":[{"name":"话题名称","count":涉及评论数,"sentiment":"positive|neutral|negative|mixed","keywords":["关键词1","关键词2","关键词3"]}]}`;

export async function analyzeTopics(items: Array<{ content: string }>): Promise<TopicResult> {
  seedPrompt('topic', TOPIC_PROMPT);
  const prompt = getPrompt('topic') || TOPIC_PROMPT;
  const sample = items.slice(0, 100);
  const texts = sample.map((it, i) => `${i + 1}. ${it.content.slice(0, 80)}`).join('\n');
  const raw = await callLLM(prompt, `以下是 ${sample.length} 条竞品评论/内容：\n\n${texts}`);
  return robustParseJSON<TopicResult>(raw);
}

// ═══════════════════════════════════════════════════════════════
// 第二步：差评深挖（重点）
// ═══════════════════════════════════════════════════════════════

export const NEGATIVE_PROMPT = `你是一位拥有15年经验的消费互联网竞争情报分析师，专注差评深挖。

任务：从负面评论中识别高频痛点，并判断严重性。

分析维度：
1. 高频痛点：同类诉求出现 ≥3 次即视为高频
2. 严重性判断：
   - "系统性缺陷"：跨不同时间段、跨用户的重复投诉，说明是产品/服务层面的结构性问题
   - "偶发抱怨"：个别用户的特定情境反馈，不具有普遍性
3. 情绪烈度：通过用词判断用户不满程度（强烈不满 vs 一般不满）

规则：
- 合并相似诉求，归纳为差评主题
- 每个主题给出 2-3 条原始证据（原文摘要不超过50字，不含换行符）
- 按 count 降序排列，必须输出 3-5 个差评主题（即使某些主题只有 1-2 条提及也应列出）
- severity 必须为 "系统性缺陷" 或 "偶发抱怨"
- 如果负面文本总量较少，也要尽量从中提取不同维度的痛点（如价格、服务、产品质量、体验流程等）

质量红线：
- 禁止模糊表述，"用户体验较差"不是有效洞察，"取车等待超5分钟被提及12次"才是
- 所有结论必须有原始信号支撑

严格返回 JSON（不要加解释文字、不要加 markdown 代码块）：
{"items":[{"summary":"差评核心问题概括（具体、可量化）","count":涉及条数,"topic":"所属话题","severity":"系统性缺陷|偶发抱怨","examples":["原文示例1","原文示例2"]}]}`;

export async function analyzeTopNegative(items: Array<{ content: string; sentiment?: string }>): Promise<TopNegative> {
  const negItems = items.filter(i => i.sentiment === 'negative');
  const feedItems = negItems.length >= 10 ? negItems : items;
  if (feedItems.length === 0) {
    return { items: [] };
  }
  seedPrompt('negative', NEGATIVE_PROMPT);
  const prompt = getPrompt('negative') || NEGATIVE_PROMPT;
  const texts = feedItems.slice(0, 80).map((it, i) => `${i + 1}. ${it.content.slice(0, 100)}`).join('\n');
  const label = negItems.length >= 10
    ? `以下是 ${negItems.length} 条被判定为负面情感的竞品评论`
    : `以下是 ${feedItems.length} 条竞品评论（含正面/中性/负面），请从中识别负面痛点`;
  const raw = await callLLM(prompt, `${label}：\n\n${texts}`);
  return robustParseJSON<TopNegative>(raw);
}

// ═══════════════════════════════════════════════════════════════
// 第四步：机会点识别（核心输出）
// ═══════════════════════════════════════════════════════════════

export function buildOpportunityPrompt(ownBrand?: string): string {
  const ownContext = ownBrand
    ? `\n\n本品（我方产品）：「${ownBrand}」
其余品牌均为竞品。分析时请始终站在「${ownBrand}」的视角：
- 竞品差评中暴露的问题，是否恰好是「${ownBrand}」已有或可打造的优势
- 竞品好评中的亮点，「${ownBrand}」是否存在差距需要补齐
- 用户提到「${ownBrand}」的正面/负面评价，作为本品现状参考`
    : '';

  return `你是一位拥有15年经验的消费互联网竞争情报分析师，专注于将竞品洞察转化为营销机会。${ownContext}

任务：基于竞品舆情分析结果，识别${ownBrand ? `「${ownBrand}」` : '我方'}可转化为营销策略的机会点。

每个机会点必须满足以下逻辑链：
竞品高频/严重差评 → 用户真实未被满足的需求 → ${ownBrand ? `「${ownBrand}」` : '我方'}现有或可打造的优势 → 可验证的切入卖点

机会点置信度评估：
- 5（高）：≥10条一致证据，覆盖多渠道
- 4（中高）：5-9条证据
- 3（中）：3-5条证据，或单一渠道
- 2（低）：<3条证据，或存在反向证据
- 1（极低）：仅为推测

规则：
- title 格式："竞品痛点 → ${ownBrand ? `${ownBrand}` : '我方'}切入点"
- description 包含：竞品痛点概述 + 用户未满足需求 + 建议策略方向（不超过120字，不含换行符）
- evidence 从原始评论中摘取，每条不超过50字
- risk_note 标注执行此策略的风险或前提条件（不超过40字）
- 最多 5 个机会点，按 confidence 降序

质量红线：
1. 禁止编造数据：所有机会点必须有可追溯的原始信号支撑
2. 禁止模糊表述：要具体、可量化
3. 竞品好评要如实看待：不要为凑机会点数量而忽略竞品真正的优势
4. 优先级排序：按「置信度 × 用户需求强度」降序

严格返回 JSON（不要加解释文字、不要加 markdown 代码块）：
{"opportunities":[{"title":"痛点 → 切入点","description":"策略描述","confidence":5,"evidence":["原文1","原文2"],"brand":"涉及品牌","topic":"所属话题","risk_note":"风险提示"}]}`;
}

export async function identifyOpportunities(
  sentimentResult: SentimentResult,
  topicResult: TopicResult,
  topNegative: TopNegative,
  brands: string[],
  ownBrand?: string,
): Promise<OpportunityData[]> {
  const competitorBrands = ownBrand ? brands.filter(b => b !== ownBrand) : brands;
  const brandLabel = ownBrand
    ? `本品「${ownBrand}」及竞品「${competitorBrands.join('、')}」`
    : `品牌「${brands.join('、')}」`;
  seedPrompt('opportunity', buildOpportunityPrompt());
  const customPrompt = getPrompt('opportunity');
  const ctx = JSON.stringify({ sentimentResult, topicResult, topNegative, brands, ownBrand: ownBrand || null }, null, 2);
  const raw = await callLLM(
    customPrompt || buildOpportunityPrompt(ownBrand),
    `以下是对${brandLabel}的多渠道舆情分析结果，请识别机会点：\n\n${ctx}`,
  );
  const parsed = robustParseJSON<{ opportunities: OpportunityData[] }>(raw);
  return parsed.opportunities || [];
}
