export interface Brand {
  id: number;
  name: string;
  industry: string;
  is_own: number;
  created_at: string;
}

export interface DataSource {
  id: number;
  name: string;
  type: string;
  url: string;
  method: string;
  headers: string;
  query_params: string;
  field_mapping: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface RawDataItem {
  id: number;
  source: string;
  brand: string;
  content: string;
  score: number | null;
  likes: number;
  date: string;
  url: string;
  sentiment: string | null;
  topics: string | null;
  data_source_id: number | null;
  created_at: string;
}

export interface Analysis {
  id: number;
  brands: string;
  own_brand: string;
  date_range: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  total_items: number;
  sentiment_result: string | null;
  topic_result: string | null;
  top_negative: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Opportunity {
  id: number;
  analysis_id: number;
  title: string;
  description: string;
  confidence: number;
  evidence: string;
  brand: string;
  topic: string;
  created_at: string;
}

export interface SentimentResult {
  positive: number;
  neutral: number;
  negative: number;
  details: Array<{ content: string; sentiment: 'positive' | 'neutral' | 'negative' }>;
}

export interface TopicResult {
  topics: Array<{
    name: string;
    count: number;
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    keywords: string[];
  }>;
}

export interface TopNegative {
  items: Array<{
    summary: string;
    count: number;
    topic: string;
    severity: '系统性缺陷' | '偶发抱怨';
    examples: string[];
  }>;
}

export interface OpportunityData {
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
  brand: string;
  topic: string;
  risk_note?: string;
}

export interface RawItemBrief {
  source: string;
  brand: string;
  content: string;
  likes: number;
  date: string;
  url: string;
  sentiment: string | null;
}

export interface AnalysisResult {
  id: number;
  status: string;
  progress: number;
  brands: string[];
  ownBrand?: string;
  dateRange: { start: string; end: string };
  totalItems: number;
  sentiment: SentimentResult | null;
  topics: TopicResult | null;
  topNegative: TopNegative | null;
  opportunities: OpportunityData[];
  sources: string[];
  rawItems?: RawItemBrief[];
}

// ─── Strategy Types ───────────────────────────────────────────

export interface StrategyInput {
  business_goal: string;
  core_metric: 'DAU' | '新增订单' | 'GMV' | '品牌曝光' | '自定义';
  period: { start: string; end: string };
  budget_total: number;
  roi_floor: number;
  opportunity_ids?: number[];
  industry_context?: string;
  competitors?: string[];
  own_brand?: string;
  market_background?: string;
}

export interface StrategyMeta {
  title: string;
  goal_summary: string;
  period: string;
  budget_total: number;
  roi_floor: number;
  market_stage: string;
  market_stage_rationale: string;
  competition_type: string;
  main_strategy: string;
}

export interface TargetAudience {
  priority: number;
  name: string;
  demographics: string;
  scenario: string;
  core_motivation: string;
  relation_to_competitor: string;
  strategy_type: '截流' | '顺向';
  key_message: string;
}

export interface ChannelMixItem {
  channel: string;
  channel_type: string;
  role: string;
  budget_pct: number;
  budget_amount: number;
  target_kpi: string;
  audience_match: string[];
  creative_direction: string;
  risk: string;
}

export interface TimePacing {
  phase: string;
  weeks: string;
  budget_pct: number;
  budget_amount: number;
  objective: string;
  decision_gate: string | null;
}

export interface KeyAssumption {
  id: string;
  statement: string;
  basis: string;
  risk_level: '高' | '中' | '低';
  risk_note: string;
  validation_method: string;
}

// ─── SCRAP Model: S — Market Situation ────────────────────────

export interface UserSegment {
  layer: '增量新用户' | '竞品活跃用户' | '竞品不满用户' | '本品沉睡用户' | '本品高价值用户';
  description: string;
  scale_estimate: string;
  priority: number;
  strategic_value: string;
}

export interface MarketSituation {
  user_segments: UserSegment[];
  market_assessment: {
    growth_phase: string;
    incremental_vs_stock: string;
    rationale: string;
  };
  timing_opportunities: Array<{
    opportunity: string;
    window: string;
    impact: '高' | '中' | '低';
  }>;
}

// ─── SCRAP Model: C — Competition Analysis ────────────────────

export interface CompetitorDimension {
  dimension: string;
  competitor_score: number;
  own_score: number;
  gap_analysis: string;
}

export interface CompetitorProfile {
  name: string;
  dimensions: CompetitorDimension[];
}

export interface TargetableUser {
  source_competitor: string;
  user_profile: string;
  core_pain_point: string;
  migration_driver: string;
  migration_barrier: string;
  counter_strategy: string;
}

export interface DifferentiationPoint {
  point: string;
  zone: '重点进攻' | '快速补齐' | '强化防守' | '暂缓投入';
  narrative: string;
}

export interface CompetitionAnalysis {
  competitor_matrix: CompetitorProfile[];
  targetable_users: TargetableUser[];
  differentiation_points: DifferentiationPoint[];
}

// ─── SCRAP Model: A — Execution Plan ──────────────────────────

export interface ProductDesign {
  user_group: string;
  first_experience: string;
  differentiation: string;
  success_metric: string;
}

export interface CampaignIdea {
  theme: string;
  target_user: string;
  mechanism: string;
  expected_conversion_path: string;
}

export interface ExecutionPlan {
  product_designs: ProductDesign[];
  campaign_ideas: CampaignIdea[];
  content_strategy: {
    competitor_users_narrative: string;
    new_users_narrative: string;
    existing_users_narrative: string;
  };
}

// ─── Strategy Result (SCRAP full model) ───────────────────────

export interface StrategyResult {
  strategy_meta: StrategyMeta;
  market_situation?: MarketSituation;
  competition_analysis?: CompetitionAnalysis;
  target_audiences: TargetAudience[];
  channel_mix: ChannelMixItem[];
  channel_total_check: string;
  execution_plan?: ExecutionPlan;
  time_pacing: TimePacing[];
  key_assumptions: KeyAssumption[];
}

export interface Strategy {
  id: number;
  title: string;
  business_goal: string;
  core_metric: string;
  period_start: string;
  period_end: string;
  budget_total: number;
  roi_floor: number;
  opportunity_ids: string;
  status: 'draft' | 'generating' | 'completed' | 'error';
  result: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Strategy Chat Types ─────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  tab_context?: string;
}

export interface StrategyChatResponse {
  answer: string;
  action_type: 'query' | 'analysis' | 'decision' | 'modification';
  modification_intent: {
    triggered: boolean;
    description?: string;
  } | null;
  confidence: 'high' | 'medium' | 'low';
  updated_strategy?: StrategyResult;
}

export interface FieldMapping {
  dataPath?: string;
  content: string;
  score?: string;
  date: string;
  url: string;
  brand?: string;
  source?: string;
  likes?: string;
  urlPrefix?: string;
}

export interface DataSourceConfig {
  name: string;
  type: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  fieldMapping: FieldMapping;
  enabled: boolean;
}

// ─── Uploaded Reviews Types ───────────────────────────────────

export interface UploadedReview {
  id: number;
  app_name: string;
  brand: string;
  content: string;
  score: number | null;
  author: string;
  date: string;
  platform: string;
  batch_id: string;
  created_at: string;
}

// ─── Sandbox Types ────────────────────────────────────────────

export type PacingMode = 'uniform' | 'burst' | 'front_heavy' | 'back_heavy';
export type ScenarioType = 'resource' | 'competition' | 'timing' | 'comparison';

export interface SandboxParams {
  budget_delta_pct: number;
  brand_ratio: number;
  performance_ratio: number;
  pacing: PacingMode;
}

export interface ChannelPrediction {
  channel: string;
  channel_type: string;
  budget_pct: number;
  budget_amount: number;
  predicted_roi: number;
  marginal_status: 'normal' | 'diminishing' | 'saturated';
}

export interface WeeklyPoint {
  week: string;
  conversions: number;
  spend: number;
}

export interface SandboxResult {
  budget_total: number;
  predicted_conversions: number;
  conversion_delta_pct: number;
  predicted_cpa: number;
  cpa_delta_pct: number;
  predicted_roi: number;
  roi_delta_pct: number;
  channel_breakdown: ChannelPrediction[];
  weekly_trend: WeeklyPoint[];
  baseline: {
    conversions: number;
    cpa: number;
    roi: number;
  };
}

export interface SandboxInterpretation {
  insight_primary: string;
  insight_secondary: string;
  risk_flag: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface SandboxScenario {
  id: number;
  strategy_id: number;
  radar_analysis_id: number | null;
  name: string;
  scenario_type: ScenarioType;
  params: string;
  result: string | null;
  interpretation: string | null;
  input_data: string | null;
  created_at: string;
}

// ─── Sandbox: Competition Scenario ────────────────────────────

export interface CompetitionScenarioInput {
  strategy_id: number;
  event_type: '竞品降价' | '竞品新品发布' | '竞品服务事故' | '竞品加大投放';
  event_description: string;
  severity: '轻微' | '中等' | '严重';
}

export interface CompetitionResponseOption {
  approach: '保守' | '中性' | '激进';
  description: string;
  actions: string[];
  expected_outcome: string;
  risk: string;
  resource_impact: string;
}

export interface CompetitionScenarioResult {
  impact_assessment: {
    user_risk: string;
    opportunity: string;
    urgency: '立即响应' | '密切关注' | '暂不行动';
  };
  response_options: CompetitionResponseOption[];
  recommendation: {
    preferred: '保守' | '中性' | '激进';
    rationale: string;
    trigger_conditions: string;
  };
}

// ─── Sandbox: Timing Scenario ─────────────────────────────────

export interface TimingKeyDate {
  date: string;
  event: string;
  importance: '高' | '中' | '低';
}

export interface TimingScenarioInput {
  strategy_id: number;
  key_dates: TimingKeyDate[];
  focus_mode: '集中爆发' | '持续推进' | 'AI建议';
}

export interface TimingPhase {
  phase: string;
  period: string;
  objective: string;
  budget_pct: number;
  key_actions: string[];
  milestone: string;
}

export interface TimingScenarioResult {
  optimal_windows: Array<{
    window: string;
    rationale: string;
    recommended_action: string;
    impact: '高' | '中' | '低';
  }>;
  phase_plan: TimingPhase[];
  recommendation: string;
}

// ─── Sandbox: Comparison Scenario ─────────────────────────────

export interface StrategyScorecard {
  strategy_id: number;
  title: string;
  scores: {
    growth_potential: number;
    execution_difficulty: number;
    risk_level: number;
    resource_efficiency: number;
  };
  strengths: string[];
  weaknesses: string[];
  core_assumption: string;
}

export interface ComparisonScenarioResult {
  strategies: StrategyScorecard[];
  trade_offs: string[];
  recommendation: {
    preferred_id: number;
    rationale: string;
    hybrid_suggestion: string;
  };
}

// ─── Retro Lab Types ─────────────────────────────────────────

export interface Campaign {
  id: number;
  title: string;
  strategy_id: number | null;
  period_start: string;
  period_end: string;
  status: 'draft' | 'data_uploaded' | 'analyzing' | 'completed' | 'error';
  csv_data: string | null;
  retro_result: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CsvRow {
  channel: string;
  date: string;
  impressions: number;
  clicks: number;
  activations: number;
  orders: number;
  spend: number;
  revenue: number;
}

export interface FunnelBreakdown {
  stage: string;
  actual_rate: number;
  target_rate: number;
  delta_pct: number;
  status: 'green' | 'yellow' | 'red';
  hypothesis: string;
}

export interface ChannelPerformance {
  channel: string;
  actual_roi: number;
  target_roi: number;
  delta_pct: number;
  status: '超预期' | '达标' | '低于预期';
  insight: string;
  next_round_action: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  orders: number;
}

export interface Attribution {
  category: '素材问题' | '执行不足' | '产品承接' | '外部竞争' | '策略偏差';
  weight: number;
  evidence: string;
  detail: string | null;
}

export interface AssumptionValidation {
  assumption_id: string;
  statement: string;
  actual_value: string;
  status: 'verified' | 'partial' | 'failed';
  conclusion: string;
  updated_assumption: string;
}

export interface NextRoundRecommendations {
  budget_reallocation: Array<{
    channel: string;
    current_pct: number;
    recommended_pct: number;
    reason: string;
  }>;
  creative_strategy: string[];
  audience_strategy: string[];
  updated_assumptions: Array<{
    id: string;
    old: string;
    new: string;
    basis: string;
  }>;
}

export interface RetroResult {
  overall_summary: {
    goal_achievement: string;
    roi_achievement: string;
    total_spend: number;
    total_revenue: number;
    total_orders: number;
    status: '达成' | '部分达成' | '未达成';
  };
  funnel_breakdown: FunnelBreakdown[];
  channel_performance: ChannelPerformance[];
  attribution: Attribution[];
  assumption_validation: AssumptionValidation[];
  next_round_recommendations: NextRoundRecommendations;
}
