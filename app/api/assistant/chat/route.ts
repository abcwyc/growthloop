import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { chatWithStrategy } from '@/lib/strategy-agent';
import { getPrompt, seedPrompt } from '@/lib/prompts';
import type { StrategyResult, Strategy } from '@/lib/types';

interface AgentConfig { endpoint: string; apiKey: string; model: string; }
function getCfg(): AgentConfig {
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

export const SYSTEM_PROMPT = `你是 GrowthLoop 营销增长决策平台的 AI 助手。你既是平台的智能向导，也是一位资深的营销战略顾问。

## 你的身份
你同时具备两种能力：
1. **平台助手**：熟悉 GrowthLoop 的所有功能模块（研究、策略、沙盘、复盘），能基于用户当前页面的实际数据给出精准分析。
2. **营销顾问**：拥有 CMO 级别的营销专业知识，能回答品牌战略、增长黑客、用户生命周期、渠道组合、内容营销、效果广告、私域运营等各类营销问题。

## 营销专业知识范围
你可以自由回答以下领域的问题（不限于平台数据）：
- 品牌定位与差异化策略（定位理论、品类创新、心智占领）
- 增长模型与用户漏斗（AARRR、北极星指标、LTV/CAC）
- 渠道策略（信息流、搜索、社媒种草、KOL/KOC、户外、私域）
- 内容营销（选题策划、爆款公式、传播裂变）
- 效果广告优化（ROAS、oCPX、素材迭代、人群包）
- 营销预算分配（品效比、边际收益递减、多触点归因）
- 竞品分析方法论（SWOT、波特五力、行业对标）
- 大促与Campaign策划（节奏把控、预热-爆发-长尾、ROI预估）
- 用户洞察与消费者心理（需求层次、决策路径、行为经济学）
- 数据分析与AB测试（统计显著性、归因模型、增量测试）

## 页面上下文感知
系统会自动传入用户当前所在页面的信息和数据。你应该：
- 主动感知用户所在的页面，并理解页面上下文
- 当页面有分析数据时，结合这些数据回答问题
- 如果用户的问题与当前页面数据相关，优先使用页面数据佐证你的回答
- 如果用户问的是通用营销问题，则直接用你的专业知识回答，同时可以适当关联当前页面

## 回答风格
- 专业但不晦涩，像一位经验丰富的营销负责人在交流
- 先给结论、再给理由和论据
- 数字和数据要具体，避免空泛描述
- 3-8句话为宜，复杂问题可以适当展开
- 可以主动提供可操作的建议
- 当涉及平台数据时标注数据来源

返回纯 JSON（不要 markdown 代码块）：
{
  "answer": "回答文本",
  "action_type": "query|analysis|decision|modification|general",
  "modification_intent": {"triggered": false, "description": null},
  "confidence": "high|medium|low"
}`;

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e > s) return text.slice(s, e + 1);
  return text.trim();
}

interface PageSnapshot {
  page: string;
  path: string;
  data: Record<string, unknown>;
}

function buildPageContextBlock(snapshot?: PageSnapshot): string {
  if (!snapshot) return '';
  const parts: string[] = [];
  parts.push(`📍 用户当前所在页面：${snapshot.page}（路径：${snapshot.path}）`);

  const d = snapshot.data;
  if (!d || Object.keys(d).length === 0) {
    parts.push('（该页面暂无加载数据）');
    return parts.join('\n');
  }

  if (snapshot.path === '/radar' || snapshot.page.includes('研究')) {
    parts.push('\n=== 竞品研究数据 ===');
    if (d.brands) parts.push(`分析品牌：${JSON.stringify(d.brands)}`);
    if (d.ownBrand) parts.push(`本品：${d.ownBrand}`);
    if (d.totalItems) parts.push(`数据量：${d.totalItems} 条`);
    if (d.sentiment) parts.push(`情感分析：${JSON.stringify(d.sentiment)}`);
    if (d.topics) parts.push(`热门话题：${JSON.stringify(d.topics)}`);
    if (d.topNegative) {
      const neg = Array.isArray(d.topNegative) ? d.topNegative.slice(0, 5) : d.topNegative;
      parts.push(`差评洞察（top5）：${JSON.stringify(neg)}`);
    }
    if (d.opportunities) parts.push(`发现的机会点：${JSON.stringify(d.opportunities)}`);
  }

  if (snapshot.path.startsWith('/strategy/')) {
    parts.push('\n=== 当前策略详情 ===');
    if (d.title) parts.push(`策略名称：${d.title}`);
    if (d.businessGoal) parts.push(`业务目标：${d.businessGoal}`);
    if (d.coreMetric) parts.push(`核心指标：${d.coreMetric}`);
    if (d.budgetTotal) parts.push(`总预算：${d.budgetTotal}万`);
    if (d.period) parts.push(`执行周期：${d.period}`);
    if (d.activeTab) parts.push(`用户正在查看的Tab：${d.activeTab}`);
    if (d.marketSituation) parts.push(`市场态势：${JSON.stringify(d.marketSituation)}`);
    if (d.audienceStrategy) parts.push(`人群策略：${JSON.stringify(d.audienceStrategy)}`);
    if (d.channelMix) parts.push(`渠道组合：${JSON.stringify(d.channelMix)}`);
    if (d.executionPlan) parts.push(`执行方案：${JSON.stringify(d.executionPlan)}`);
    if (d.pacingStrategy) parts.push(`节奏策略：${JSON.stringify(d.pacingStrategy)}`);
    if (d.assumptions) parts.push(`假设条件：${JSON.stringify(d.assumptions)}`);
  }

  if (snapshot.path === '/sandbox') {
    parts.push('\n=== 沙盘推演数据 ===');
    if (d.scenarioType) parts.push(`当前场景：${d.scenarioType}`);
    if (d.selectedStrategy) parts.push(`基线策略：${JSON.stringify(d.selectedStrategy)}`);
    if (d.resourceParams) parts.push(`资源调配参数：${JSON.stringify(d.resourceParams)}`);
    if (d.resourceResult) parts.push(`推演结果：${JSON.stringify(d.resourceResult)}`);
    if (d.interpretation) parts.push(`AI 解读：${JSON.stringify(d.interpretation)}`);
    if (d.competitionInput) parts.push(`竞争事件输入：${JSON.stringify(d.competitionInput)}`);
    if (d.competitionResult) parts.push(`竞争响应方案：${JSON.stringify(d.competitionResult)}`);
    if (d.timingInput) parts.push(`时机推演输入：${JSON.stringify(d.timingInput)}`);
    if (d.timingResult) parts.push(`时机推演结果：${JSON.stringify(d.timingResult)}`);
    if (d.comparisonResult) parts.push(`策略对比结果：${JSON.stringify(d.comparisonResult)}`);
  }

  return parts.join('\n');
}

function truncateContext(text: string, maxLen = 12000): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n...(数据过长已截断)';
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    question: string;
    page_context: string;
    strategy_id: number | null;
    page_snapshot?: PageSnapshot;
    references: Array<{ label: string; type: string; data: unknown }>;
    conversation_history: Array<{ role: string; content: string }>;
  };

  if (!body.question?.trim()) {
    return NextResponse.json({ error: '问题不能为空' }, { status: 400 });
  }

  const db = getDb();

  if (body.strategy_id && body.page_context.startsWith('strategy')) {
    const row = db.prepare('SELECT * FROM strategies WHERE id = ?')
      .get(body.strategy_id) as Strategy | undefined;

    if (row?.result) {
      try {
        const currentStrategy = JSON.parse(row.result) as StrategyResult;

        let tabCtx = 'audience';
        if (body.page_context.includes(':')) {
          tabCtx = body.page_context.split(':')[1];
        }

        const result = await chatWithStrategy({
          question: buildQuestionWithRefs(body.question, body.references),
          tab_context: tabCtx,
          conversation_history: body.conversation_history.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          current_strategy: currentStrategy,
        });

        if (result.updated_strategy) {
          db.prepare('UPDATE strategies SET result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(JSON.stringify(result.updated_strategy), body.strategy_id);
        }

        return NextResponse.json({
          answer: result.answer,
          action_type: result.action_type,
          modification_intent: result.modification_intent,
          confidence: result.confidence,
          strategy_updated: !!result.updated_strategy,
        });
      } catch (err) {
        console.error('[Assistant] Strategy chat error:', err);
      }
    }
  }

  try {
    const cfg = getCfg();
    const contextParts: string[] = [];

    const pageCtxBlock = buildPageContextBlock(body.page_snapshot);
    if (pageCtxBlock) {
      contextParts.push(truncateContext(pageCtxBlock));
    } else {
      contextParts.push(`当前页面：${body.page_context}`);
    }

    if (body.references.length > 0) {
      contextParts.push('用户引用的数据：');
      for (const ref of body.references) {
        contextParts.push(`[${ref.label}] (${ref.type}):\n${JSON.stringify(ref.data, null, 2)}`);
      }
    }

    if (body.conversation_history.length > 0) {
      contextParts.push('对话历史：');
      for (const m of body.conversation_history.slice(-6)) {
        contextParts.push(`${m.role}: ${m.content}`);
      }
    }

    contextParts.push(`用户问题：${body.question}`);

    const systemPrompt = (() => {
      seedPrompt('assistant', SYSTEM_PROMPT);
      return getPrompt('assistant') || SYSTEM_PROMPT;
    })();

    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        temperature: 0.3,
        max_tokens: 16000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextParts.join('\n\n') },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`LLM error ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM empty response');

    let parsed;
    try {
      const json = extractJSON(content);
      parsed = JSON.parse(json);
    } catch {
      parsed = { answer: content, action_type: 'general', confidence: 'medium' };
    }

    return NextResponse.json({
      answer: parsed.answer || content,
      action_type: parsed.action_type || 'general',
      modification_intent: parsed.modification_intent || null,
      confidence: parsed.confidence || 'medium',
      strategy_updated: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Assistant] General chat error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildQuestionWithRefs(
  question: string,
  refs: Array<{ label: string; type: string; data: unknown }>,
): string {
  if (refs.length === 0) return question;
  const refTexts = refs.map(r => `[引用: ${r.label}]\n${JSON.stringify(r.data)}`).join('\n\n');
  return `${question}\n\n--- 用户引用的上下文 ---\n${refTexts}`;
}
