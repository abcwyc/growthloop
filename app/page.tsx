'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

/* ─── Data ─── */

const modules = [
  {
    num: '01',
    name: '研究',
    href: '/radar',
    accent: '#3B82F6',
    desc: '从微博、小红书等公开渠道采集竞品动态，AI 自动识别情感趋势与差异化机会点',
    tags: ['竞品调研', '市场洞察', '舆情监控'],
    time: '15–30 分钟',
  },
  {
    num: '02',
    name: '策略',
    href: '/strategy',
    accent: '#10B981',
    desc: '基于研究洞察一键生成可执行的营销策略方案，支持从机会点直接转化为行动计划',
    tags: ['策略规划', '方案设计', 'Campaign 策划'],
    time: '20–30 分钟',
  },
  {
    num: '03',
    name: '沙盘',
    href: '/sandbox',
    accent: '#6366F1',
    desc: '在已有策略上调整预算、品效比、投放节奏，实时预测渠道转化与 ROI 变化',
    tags: ['大促规划', '预算分配', '方案对比'],
    time: '30–60 分钟',
  },
  {
    num: '04',
    name: '复盘',
    href: '/retro',
    accent: '#F59E0B',
    desc: '导入 Campaign 效果数据，AI 完成漏斗归因、假设验证，自动输出下一轮优化建议',
    tags: ['季度复盘', '效果评估', '经验沉淀'],
    time: '20 分钟',
  },
];

const scenarios = [
  { label: '跟竞品抢用户', path: '/radar', flow: '研究 → 策略' },
  { label: '规划大促方案', path: '/sandbox', flow: '策略 → 沙盘' },
  { label: '复盘上次活动', path: '/retro', flow: '复盘' },
  { label: '监控市场舆情', path: '/radar', flow: '研究' },
  { label: '快速出策略汇报', path: '/strategy', flow: '研究 → 策略' },
  { label: '对比投放方案', path: '/sandbox', flow: '沙盘' },
];

const steps = [
  { n: 1, title: '配置品牌与数据源', desc: '添加你的品牌和竞品，接入微博、小红书等公开渠道', time: '2 分钟' },
  { n: 2, title: '启动竞品研究', desc: '选择品牌和时间范围，AI 自动采集并分析竞品动态', time: '15 分钟' },
  { n: 3, title: '生成策略并推演', desc: '洞察转化为策略方案，在沙盘中调参推演效果', time: '10 分钟' },
];

const ease = [0.16, 1, 0.3, 1] as const;

function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Hero Dashboard Mock ─── */

function HeroDashboard() {
  return (
    <div className="relative w-full max-w-[560px]">
      <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/8 via-indigo-400/6 to-emerald-400/5 rounded-3xl blur-2xl" />
      <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl border border-stone-200/80 shadow-[0_8px_40px_rgb(0,0,0,0.06)] overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-100 bg-stone-50/60">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-stone-200" />
            <div className="w-2.5 h-2.5 rounded-full bg-stone-200" />
            <div className="w-2.5 h-2.5 rounded-full bg-stone-200" />
          </div>
          <span className="text-[11px] text-stone-400 ml-2 font-medium">Growth Loop — 工作台</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Data collection strip */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-stone-600">数据流采集</span>
              <span className="text-[10px] text-stone-400 ml-auto">实时</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: '微博', count: 1247, color: 'bg-red-50 text-red-600 border-red-100' },
                { name: '小红书', count: 892, color: 'bg-pink-50 text-pink-600 border-pink-100' },
                { name: '导入数据', count: 356, color: 'bg-slate-50 text-slate-600 border-slate-100' },
              ].map((s) => (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className={`px-3 py-2 rounded-lg border text-center ${s.color}`}
                >
                  <div className="text-[10px] opacity-70">{s.name}</div>
                  <div className="text-sm font-bold mt-0.5">{s.count.toLocaleString()}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Flow arrows */}
          <div className="flex items-center justify-center gap-1 py-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0.2 }}
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                className="w-1 h-1 rounded-full bg-blue-400"
              />
            ))}
            <span className="text-[10px] text-stone-400 mx-2">→ AI 分析中</span>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0.2 }}
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 + 0.8 }}
                className="w-1 h-1 rounded-full bg-emerald-400"
              />
            ))}
          </div>

          {/* AI Strategy Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700">AI 自动生成策略</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded-full ml-auto font-medium">已生成</span>
            </div>
            <div className="space-y-1.5">
              {['锚定「取还车便利性」差异化心智', '小红书 KOC 真实用车体验种草', '微博热搜事件借势传播策略'].map((t, i) => (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 1.5 + i * 0.15 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-[10px] text-emerald-400 mt-0.5">▸</span>
                  <span className="text-[11px] text-emerald-800 leading-relaxed">{t}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ROI Chart */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.8 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-stone-600">沙盘 ROI 预测</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-blue-500"><span className="w-2 h-[2px] bg-blue-400 rounded" /> 方案 A</span>
                <span className="flex items-center gap-1 text-[10px] text-indigo-400"><span className="w-2 h-[2px] bg-indigo-300 rounded" /> 方案 B</span>
              </div>
            </div>
            <div className="relative h-[80px] bg-stone-50/50 rounded-lg overflow-hidden">
              <svg viewBox="0 0 280 80" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[1, 2, 3].map((i) => (
                  <line key={i} x1="0" y1={i * 20} x2="280" y2={i * 20} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="4,4" />
                ))}
                <motion.path
                  d="M0,65 Q40,60 70,52 T140,38 T210,22 T280,12"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 2, ease: 'easeOut' }}
                />
                <motion.path
                  d="M0,68 Q40,64 70,58 T140,48 T210,40 T280,30"
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 2.3, ease: 'easeOut' }}
                />
                <motion.path
                  d="M0,65 Q40,60 70,52 T140,38 T210,22 T280,12 L280,80 L0,80 Z"
                  fill="url(#chartFill)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 3 }}
                />
              </svg>
              <motion.div
                className="absolute right-3 top-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md shadow-sm border border-stone-100"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 3.2 }}
              >
                <span className="text-[10px] font-bold text-blue-600">ROI 3.2x</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ─── Module Dashboard Mocks (for core capabilities section) ─── */

function ModuleMock({ index }: { index: number }) {
  const shell = (accent: string, title: string, badge: string, children: React.ReactNode) => (
    <div className="bg-white rounded-2xl border border-stone-200/70 overflow-hidden shadow-[0_4px_24px_rgb(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-stone-100/80 bg-stone-50/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-stone-200/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-stone-200/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-stone-200/80" />
        </div>
        <span className="text-xs font-semibold text-stone-600 ml-1">{title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium ml-auto" style={{ backgroundColor: accent + '14', color: accent }}>{badge}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  if (index === 0) {
    return shell('#3B82F6', '竞品舆情分析报告', '已完成',
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '正面', val: '64%', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
            { label: '中性', val: '24%', color: 'text-stone-600', bg: 'bg-stone-50 border-stone-100' },
            { label: '负面', val: '12%', color: 'text-red-500', bg: 'bg-red-50 border-red-100' },
          ].map((d) => (
            <div key={d.label} className={`rounded-xl py-3.5 px-3 text-center border ${d.bg}`}>
              <div className={`text-xl font-bold ${d.color}`}>{d.val}</div>
              <div className="text-[11px] text-stone-400 mt-0.5">{d.label}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[11px] font-semibold text-stone-500 mb-3">高频话题</div>
          <div className="space-y-2.5">
            {[
              { topic: '取还车流程', pct: 85, count: 342 },
              { topic: '价格透明度', pct: 65, count: 261 },
              { topic: '车辆清洁度', pct: 45, count: 178 },
              { topic: '客服响应速度', pct: 32, count: 126 },
            ].map((t) => (
              <div key={t.topic} className="flex items-center gap-3">
                <span className="text-[11px] text-stone-600 w-20 shrink-0">{t.topic}</span>
                <div className="flex-1 bg-stone-100/80 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-blue-300 rounded-full transition-all" style={{ width: `${t.pct}%` }} />
                </div>
                <span className="text-[10px] text-stone-400 w-8 text-right tabular-nums">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-[11px] text-stone-400">共分析 <span className="font-semibold text-stone-600">2,495</span> 条舆情数据</span>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return shell('#10B981', 'AI Campaign 行动计划', '3 个阶段',
      <div className="space-y-4">
        {[
          { phase: 'P1 蓄水期', time: '4.1 – 4.15', status: '执行中', statusColor: 'bg-blue-500 text-white', items: ['小红书 KOC 种草 × 50 篇', '微博话题预热 #春日出行#'] },
          { phase: 'P2 引爆期', time: '4.16 – 4.22', status: '待启动', statusColor: 'bg-stone-100 text-stone-500', items: ['达人测评视频 × 8', '信息流广告投放'] },
          { phase: 'P3 转化期', time: '4.23 – 4.30', status: '待启动', statusColor: 'bg-stone-100 text-stone-500', items: ['限时优惠券发放', '私域社群裂变活动'] },
        ].map((p) => (
          <div key={p.phase} className="rounded-xl border border-stone-100 p-4 hover:border-stone-200/80 transition-colors">
            <div className="flex items-center gap-3 mb-2.5">
              <span className="text-[12px] font-bold text-stone-800">{p.phase}</span>
              <span className="text-[10px] text-stone-400">{p.time}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ml-auto ${p.statusColor}`}>{p.status}</span>
            </div>
            <div className="space-y-1.5">
              {p.items.map((item) => (
                <div key={item} className="flex items-center gap-2 text-[11px] text-stone-500">
                  <span className="text-emerald-400">▸</span>{item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (index === 2) {
    return shell('#6366F1', '沙盘调参推演', '方案对比',
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '总预算', val: '¥180K', sub: '较上期 +12%' },
            { label: '小红书占比', val: '45%', sub: '推荐提升' },
            { label: '预估 ROI', val: '3.2x', sub: '高于行业均值' },
          ].map((r) => (
            <div key={r.label} className="bg-stone-50/80 rounded-xl p-3.5 text-center">
              <div className="text-[10px] text-stone-400">{r.label}</div>
              <div className="text-lg font-bold text-stone-800 mt-1">{r.val}</div>
              <div className="text-[9px] text-indigo-400 mt-0.5">{r.sub}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-stone-500">ROI 趋势预测</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] text-indigo-500"><span className="w-3 h-[2px] bg-indigo-500 rounded" /> 方案 A</span>
              <span className="flex items-center gap-1.5 text-[10px] text-stone-400"><span className="w-3 h-[2px] bg-stone-300 rounded border-dashed" /> 方案 B</span>
            </div>
          </div>
          <div className="relative h-[90px] bg-stone-50/50 rounded-xl overflow-hidden border border-stone-100/60">
            <svg viewBox="0 0 300 90" className="w-full h-full" preserveAspectRatio="none">
              {[1, 2, 3].map((i) => (
                <line key={i} x1="0" y1={i * 22} x2="300" y2={i * 22} stroke="#f0f0f0" strokeWidth="0.8" />
              ))}
              <path d="M0,72 Q45,66 90,55 T180,38 T270,18 T300,10" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M0,75 Q45,70 90,62 T180,50 T270,38 T300,30" fill="none" stroke="#d4d4d4" strokeWidth="1.5" strokeDasharray="6,4" />
              <path d="M0,72 Q45,66 90,55 T180,38 T270,18 T300,10 L300,90 L0,90 Z" fill="#6366F1" fillOpacity="0.05" />
            </svg>
            <div className="absolute right-3 top-2 bg-white/95 backdrop-blur px-2.5 py-1 rounded-lg shadow-sm border border-indigo-100">
              <span className="text-[11px] font-bold text-indigo-600">ROI 3.2x ↑</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return shell('#F59E0B', '漏斗归因复盘', 'Q1 复盘',
    <div className="space-y-5">
      <div className="space-y-3">
        {[
          { stage: '曝光', val: '245K', pct: 100, color: 'from-amber-400 to-amber-300' },
          { stage: '点击', val: '18.2K', pct: 74, color: 'from-amber-400 to-orange-300' },
          { stage: '转化', val: '2.4K', pct: 42, color: 'from-orange-400 to-orange-300' },
          { stage: '留存', val: '1.1K', pct: 28, color: 'from-orange-500 to-red-300' },
        ].map((f) => (
          <div key={f.stage} className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-stone-600 w-8 shrink-0">{f.stage}</span>
            <div className="flex-1 h-6 bg-stone-50 rounded-lg overflow-hidden border border-stone-100/60">
              <div className={`h-full bg-gradient-to-r ${f.color} rounded-lg flex items-center justify-end pr-2`} style={{ width: `${f.pct}%` }}>
                {f.pct > 35 && <span className="text-[9px] font-bold text-white/90">{f.val}</span>}
              </div>
            </div>
            {f.pct <= 35 && <span className="text-[11px] font-semibold text-stone-600 w-12 text-right">{f.val}</span>}
            {f.pct > 35 && <span className="text-[10px] text-stone-400 w-12 text-right">{f.pct}%</span>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '整体转化率', val: '0.98%', change: '+0.12%', positive: true },
          { label: '获客成本', val: '¥42.6', change: '-¥8.3', positive: true },
        ].map((m) => (
          <div key={m.label} className="bg-stone-50/80 rounded-xl p-3.5 text-center">
            <div className="text-[10px] text-stone-400">{m.label}</div>
            <div className="text-base font-bold text-stone-800 mt-1">{m.val}</div>
            <div className={`text-[10px] mt-0.5 font-medium ${m.positive ? 'text-emerald-500' : 'text-red-500'}`}>{m.change}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step Mockups ─── */

function StepMockup({ step }: { step: number }) {
  if (step === 1) {
    return (
      <div className="mt-4 bg-stone-50 rounded-lg border border-stone-200/60 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-100 flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="2.5" stroke="#6366F1" strokeWidth="1.2" fill="none"/></svg>
          </div>
          <span className="text-[10px] text-stone-500">数据源配置</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['微博', '小红书', '导入数据'].map((s) => (
            <span key={s} className="text-[9px] px-2 py-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">{s}</span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="text-[9px] text-emerald-500">3 个渠道已接入</span>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="mt-4 bg-stone-50 rounded-lg border border-stone-200/60 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-100 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-sm bg-blue-500" />
          </div>
          <span className="text-[10px] text-stone-500">品牌选择</span>
        </div>
        <div className="flex gap-1.5">
          {['哈啰租车', '神州租车'].map((b) => (
            <span key={b} className="text-[9px] px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100">{b}</span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] text-stone-400">AI 分析进行中...</span>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="mt-4 bg-stone-50 rounded-lg border border-stone-200/60 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded bg-emerald-100 flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="text-[10px] text-stone-500">策略方案已生成</span>
        </div>
        <div className="space-y-1">
          {['差异化定位策略', 'KOC 种草方案'].map((s) => (
            <div key={s} className="text-[9px] text-stone-600 flex items-center gap-1.5">
              <span className="text-emerald-400">▸</span>{s}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

/* ─── Main Page ─── */

export default function HomePage() {
  const [activeModule, setActiveModule] = useState(0);

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#FAFAFA]/80 backdrop-blur-xl border-b border-stone-200/40">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Growth Loop" width={28} height={28} className="rounded-lg" />
            <span className="text-[15px] font-semibold text-stone-800 tracking-tight">Growth Loop</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              营效增长决策平台
            </span>
            <Link href="/radar" className="inline-flex items-center px-4 py-1.5 rounded-lg border border-stone-300 text-[13px] text-stone-600 font-medium hover:border-blue-300 hover:text-blue-600 transition-all">
              进入工作台 <span className="ml-1">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-5%] w-[600px] h-[600px] rounded-full bg-blue-400/[0.04] blur-[140px] pointer-events-none" />
          <div className="absolute bottom-[-30%] left-[-10%] w-[400px] h-[400px] rounded-full bg-indigo-300/[0.04] blur-[120px] pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              {/* Left: Copy */}
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
                <h1 className="text-[2.25rem] sm:text-[3rem] font-extrabold text-stone-900 tracking-tight leading-[1.15]">
                  告别盲盒营销，<br />让增长有迹可循
                </h1>
                <p className="mt-5 text-base sm:text-lg text-stone-400 max-w-md leading-relaxed">
                  从竞品情报采集、策略方案生成到效果推演复盘，让每一个营销决策都有据可依。
                </p>

                <div className="mt-8">
                  <Link href="/radar" className="inline-flex items-center px-7 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all hover:shadow-md hover:shadow-blue-500/25">
                    开始 →
                  </Link>
                </div>
              </motion.div>

              {/* Right: Dashboard */}
              <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.9, ease, delay: 0.2 }}
                className="flex justify-center lg:justify-end"
              >
                <HeroDashboard />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Core Capabilities ── */}
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-20">
          <FadeIn>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-[0.15em]">核心能力</p>
            <h2 className="mt-2 text-2xl font-bold text-stone-800 tracking-tight">
              四个模块，一个闭环
            </h2>
            <p className="mt-1 text-sm text-stone-400">上一步产出自动流转为下一步输入</p>
          </FadeIn>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
            {/* Left: Module list */}
            <div className="lg:col-span-2 space-y-1">
              {modules.map((m, i) => (
                <FadeIn key={m.num} delay={i * 0.06}>
                  <button
                    onClick={() => setActiveModule(i)}
                    onMouseEnter={() => setActiveModule(i)}
                    className={`w-full text-left group flex items-start gap-4 p-4 rounded-xl transition-all duration-200 ${
                      activeModule === i
                        ? 'bg-white shadow-sm border border-stone-200/80'
                        : 'hover:bg-white/50 border border-transparent'
                    }`}
                  >
                    <span className={`text-lg font-bold tabular-nums shrink-0 leading-none pt-0.5 transition-colors ${
                      activeModule === i ? 'text-blue-400' : 'text-stone-200 group-hover:text-stone-300'
                    }`}>
                      {m.num}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.accent }} />
                        <h3 className={`text-sm font-bold transition-colors ${
                          activeModule === i ? 'text-stone-800' : 'text-stone-600 group-hover:text-stone-700'
                        }`}>{m.name}</h3>
                        <span className="text-[10px] text-stone-400 ml-auto shrink-0">⏱ {m.time}</span>
                      </div>
                      <p className="mt-1 text-[12px] text-stone-400 leading-relaxed">{m.desc}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.tags.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{t}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                </FadeIn>
              ))}

              {/* Closed-loop flow */}
              <FadeIn delay={0.3}>
                <div className="mt-4 flex items-center gap-2 px-4">
                  {modules.map((m, i) => (
                    <div key={m.num} className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{
                        backgroundColor: activeModule === i ? m.accent + '18' : '#f5f5f4',
                        color: activeModule === i ? m.accent : '#a8a29e',
                      }}>{m.name}</span>
                      {i < modules.length - 1 && <span className="text-stone-300 text-[10px]">→</span>}
                    </div>
                  ))}
                </div>
              </FadeIn>
            </div>

            {/* Right: Dynamic module mock */}
            <div className="lg:col-span-3 flex items-start justify-center">
              <FadeIn>
                <div className="w-full max-w-lg relative">
                  <div className="absolute -inset-3 bg-gradient-to-br from-stone-100/50 to-stone-50/30 rounded-2xl -z-10" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeModule}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, ease }}
                    >
                      <ModuleMock index={activeModule} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── Scenarios ── */}
        <section className="border-y border-stone-200/50 bg-stone-50/30">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <FadeIn>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-[0.15em]">场景导航</p>
                  <h2 className="mt-1.5 text-xl font-bold text-stone-800 tracking-tight">你现在想做什么？</h2>
                </div>
                <p className="text-sm text-stone-400">从问题出发，系统推荐最短路径</p>
              </div>
            </FadeIn>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
              {scenarios.map((s, i) => (
                <FadeIn key={s.label} delay={i * 0.04}>
                  <Link
                    href={s.path}
                    className="group flex items-center justify-between py-4 border-b border-stone-200/50 last:border-0 hover:border-blue-200/60 transition-colors"
                  >
                    <span className="text-sm font-medium text-stone-600 group-hover:text-blue-500 transition-colors">{s.label}</span>
                    <span className="text-xs text-stone-400 group-hover:text-blue-400 transition-colors shrink-0 ml-3">{s.flow}</span>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Getting Started ── */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <FadeIn>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-[0.15em]">快速上手</p>
            <h2 className="mt-1.5 text-xl font-bold text-stone-800 tracking-tight">
              10 分钟获得第一份 AI 分析报告
            </h2>
          </FadeIn>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            {steps.map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.1}>
                <div className="relative">
                  <span className="text-[3.5rem] font-extrabold text-stone-100 leading-none select-none">{s.n}</span>
                  <h3 className="mt-1 text-sm font-bold text-stone-800">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-stone-400 leading-relaxed">{s.desc}</p>
                  <p className="mt-2 text-xs text-stone-300">约 {s.time}</p>
                  <StepMockup step={s.n} />
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3}>
            <div className="mt-14">
              <Link href="/settings" className="inline-flex items-center px-5 py-2.5 rounded-lg bg-stone-900 text-stone-100 text-sm font-medium hover:bg-stone-800 transition-colors">
                开始配置 →
              </Link>
            </div>
          </FadeIn>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-stone-200/50 bg-stone-50/30">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <Image src="/logo.png" alt="Growth Loop" width={22} height={22} className="rounded opacity-70" />
                  <span className="text-sm font-semibold text-stone-600">Growth Loop</span>
                </div>
                <p className="mt-1.5 text-[12px] text-stone-400">从洞察到行动的闭环引擎</p>
              </div>
              <div className="flex items-center gap-6 text-[12px] text-stone-400">
                <Link href="/radar" className="hover:text-stone-600 transition-colors">研究</Link>
                <Link href="/strategy" className="hover:text-stone-600 transition-colors">策略</Link>
                <Link href="/sandbox" className="hover:text-stone-600 transition-colors">沙盘</Link>
                <Link href="/retro" className="hover:text-stone-600 transition-colors">复盘</Link>
                <Link href="/settings" className="hover:text-stone-600 transition-colors">设置</Link>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-stone-200/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-stone-300">
              <span>© {new Date().getFullYear()} Growth Loop. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <span className="hover:text-stone-400 cursor-pointer transition-colors">隐私政策</span>
                <span className="hover:text-stone-400 cursor-pointer transition-colors">使用条款</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
