'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StrategyChatResponse } from '@/lib/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  action_type?: string;
  modified?: boolean;
  confidence?: string;
}

interface Props {
  strategyId: number;
  activeTab: string;
  onStrategyUpdated: () => void;
}

const TAB_LABELS: Record<string, string> = {
  audience: '目标人群',
  channel: '渠道组合',
  pacing: '时间节奏',
  assumption: '关键假设',
};

const QUICK_QUESTIONS: Record<string, string[]> = {
  audience: ['当前人群定位合理吗？', '能否增加一个学生群体？', '截流和顺向哪个更优先？'],
  channel: ['哪个渠道性价比最高？', '预算砍到100万怎么分配？', '把小红书预算提高到25%'],
  pacing: ['测试期时间够吗？', '能否改为前重后轻节奏？', '放量期的决策关卡合理吗？'],
  assumption: ['哪个假设风险最大？', '如何降低高风险假设的影响？', '能否增加一个关于转化率的假设？'],
};

export default function ChatPanel({ strategyId, activeTab, onStrategyUpdated }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`/api/strategy/${strategyId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          tab_context: activeTab,
          conversation_history: history,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        setMessages(prev => [...prev, { role: 'assistant', content: err.error || '请求失败' }]);
        return;
      }

      const data = await res.json() as StrategyChatResponse;
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.answer,
        action_type: data.action_type,
        modified: data.modification_intent?.triggered ?? false,
        confidence: data.confidence,
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (data.updated_strategy) {
        onStrategyUpdated();
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '网络错误，请重试' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const quickQs = QUICK_QUESTIONS[activeTab] || QUICK_QUESTIONS.audience;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div className="w-full max-w-4xl px-4 pointer-events-auto">
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-white border border-slate-200 border-b-0 rounded-t-xl shadow-xl overflow-hidden"
            >
              {/* Messages area */}
              <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-slate-400">
                      当前查看：<span className="font-medium text-slate-600">{TAB_LABELS[activeTab]}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">可以针对当前模块提问，AI 会基于策略数据作答</p>
                    <div className="flex flex-wrap gap-2 justify-center mt-3">
                      {quickQs.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(q)}
                          className="px-3 py-1.5 text-xs bg-slate-50 text-slate-600 rounded-full border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}>
                      {msg.content}
                      {msg.modified && (
                        <span className="block mt-1.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                          策略已更新
                        </span>
                      )}
                      {msg.role === 'assistant' && msg.confidence && (
                        <span className={`block mt-1 text-[10px] ${
                          msg.confidence === 'high' ? 'text-slate-400' :
                          msg.confidence === 'medium' ? 'text-amber-500' : 'text-red-400'
                        }`}>
                          {msg.confidence === 'high' ? '置信度高' : msg.confidence === 'medium' ? '置信度中' : '置信度低'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="bg-white border border-slate-200 rounded-t-xl shadow-xl p-3 flex items-center gap-2"
          style={expanded ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : {}}
        >
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            title={expanded ? '收起' : '展开'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>

          <span className="shrink-0 text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
            {TAB_LABELS[activeTab]}
          </span>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => !expanded && setExpanded(true)}
            placeholder="针对当前策略提问，或输入调整指令..."
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 border-none outline-none bg-transparent"
            disabled={loading}
          />

          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
