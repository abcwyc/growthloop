import { getDb } from './db';

export interface PromptRecord {
  id: string;
  module: string;
  name: string;
  description: string;
  content: string;
  is_default: number;
  updated_at: string;
}

export interface PromptMeta {
  id: string;
  module: string;
  name: string;
  description: string;
}

export const PROMPT_META: PromptMeta[] = [
  { id: 'sentiment',     module: '研究', name: '情感分析',     description: '对采集到的竞品评论进行正面/中性/负面情感分类' },
  { id: 'topic',         module: '研究', name: '主题聚类',     description: '对竞品评论进行主题聚类，识别核心话题和情感倾向' },
  { id: 'negative',      module: '研究', name: '差评深挖',     description: '从负面评论中识别高频痛点并判断严重性' },
  { id: 'opportunity',   module: '研究', name: '机会点识别',   description: '将竞品洞察转化为可执行的营销机会点' },
  { id: 'brand_suggest', module: '研究', name: '关键词生成',   description: '根据行业描述生成多维度竞品监测关键词' },
  { id: 'strategy',      module: '策略', name: '策略生成',     description: '基于业务目标和竞品机会点生成结构化营销策略卡片' },
  { id: 'strategy_chat', module: '策略', name: '策略对话',     description: '基于当前策略数据回答决策问题并修正策略' },
  { id: 'sandbox',       module: '沙盘', name: '资源调配解读',  description: '将资源调配推演的计算结果翻译为可决策的商业洞察' },
  { id: 'sandbox_competition', module: '沙盘', name: '竞争响应推演', description: '分析竞争变化事件影响并生成三套应对方案' },
  { id: 'sandbox_timing', module: '沙盘', name: '时机节奏推演', description: '根据关键日期和事件优化营销发力节奏' },
  { id: 'sandbox_comparison', module: '沙盘', name: '策略对比分析', description: '多策略方案并排对比评分和推荐' },
  { id: 'retro',         module: '复盘', name: 'Campaign 归因', description: '对 Campaign 效果数据进行漏斗归因和假设验证' },
  { id: 'assistant',     module: '全局', name: 'AI 助手',     description: '跨模块的综合问答助手' },
];

export function getPrompt(id: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT content FROM prompts WHERE id = ?').get(id) as { content: string } | undefined;
  return row?.content || null;
}

export function getAllPrompts(): PromptRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM prompts ORDER BY module, id').all() as PromptRecord[];
}

export function upsertPrompt(id: string, content: string, meta?: PromptMeta): void {
  const db = getDb();
  const m = meta || PROMPT_META.find(p => p.id === id);
  if (!m) return;
  db.prepare(
    `INSERT INTO prompts (id, module, name, description, content, is_default, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET content = ?, is_default = 0, updated_at = CURRENT_TIMESTAMP`
  ).run(m.id, m.module, m.name, m.description, content, content);
}

export function seedPrompt(id: string, defaultContent: string): void {
  const db = getDb();
  const m = PROMPT_META.find(p => p.id === id);
  if (!m) return;
  db.prepare(
    `INSERT OR IGNORE INTO prompts (id, module, name, description, content, is_default) VALUES (?, ?, ?, ?, ?, 1)`
  ).run(m.id, m.module, m.name, m.description, defaultContent);
}

export function resetPrompt(id: string, defaultContent: string): void {
  const db = getDb();
  db.prepare('UPDATE prompts SET content = ?, is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(defaultContent, id);
}
