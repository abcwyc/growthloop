import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'growthbox.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      industry TEXT DEFAULT '出行',
      is_own INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS data_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'http_api',
      url TEXT NOT NULL,
      method TEXT DEFAULT 'GET',
      headers TEXT DEFAULT '{}',
      query_params TEXT DEFAULT '{}',
      field_mapping TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS raw_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      brand TEXT NOT NULL,
      content TEXT NOT NULL,
      score REAL,
      likes INTEGER DEFAULT 0,
      date TEXT,
      url TEXT,
      sentiment TEXT,
      topics TEXT,
      data_source_id INTEGER,
      analysis_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brands TEXT NOT NULL,
      own_brand TEXT DEFAULT '',
      date_range TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      total_items INTEGER DEFAULT 0,
      sentiment_result TEXT,
      topic_result TEXT,
      top_negative TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      confidence INTEGER DEFAULT 3,
      evidence TEXT DEFAULT '[]',
      brand TEXT,
      topic TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id)
    );

    CREATE TABLE IF NOT EXISTS sandbox_scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id INTEGER NOT NULL,
      radar_analysis_id INTEGER,
      name TEXT DEFAULT '未命名场景',
      params TEXT NOT NULL,
      result TEXT,
      interpretation TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (strategy_id) REFERENCES strategies(id)
    );

    CREATE TABLE IF NOT EXISTS uploaded_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      score REAL,
      author TEXT DEFAULT '',
      date TEXT,
      platform TEXT DEFAULT 'App Store',
      batch_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '未命名策略',
      business_goal TEXT NOT NULL,
      core_metric TEXT NOT NULL DEFAULT 'DAU',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      budget_total REAL NOT NULL DEFAULT 0,
      roi_floor REAL NOT NULL DEFAULT 0,
      opportunity_ids TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      result TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      is_default INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '未命名Campaign',
      strategy_id INTEGER,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      csv_data TEXT,
      retro_result TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (strategy_id) REFERENCES strategies(id)
    );
  `);

  // Migrations
  const brandCols = db.prepare("PRAGMA table_info(brands)").all() as Array<{ name: string }>;
  if (!brandCols.find(c => c.name === 'is_own')) {
    db.exec('ALTER TABLE brands ADD COLUMN is_own INTEGER DEFAULT 0');
  }
  const analysisCols = db.prepare("PRAGMA table_info(analyses)").all() as Array<{ name: string }>;
  if (!analysisCols.find(c => c.name === 'own_brand')) {
    db.exec("ALTER TABLE analyses ADD COLUMN own_brand TEXT DEFAULT ''");
  }
  if (!analysisCols.find(c => c.name === 'research_question')) {
    db.exec("ALTER TABLE analyses ADD COLUMN research_question TEXT DEFAULT ''");
  }

  const sandboxCols = db.prepare("PRAGMA table_info(sandbox_scenarios)").all() as Array<{ name: string }>;
  if (!sandboxCols.find(c => c.name === 'scenario_type')) {
    db.exec("ALTER TABLE sandbox_scenarios ADD COLUMN scenario_type TEXT DEFAULT 'resource'");
  }
  if (!sandboxCols.find(c => c.name === 'input_data')) {
    db.exec("ALTER TABLE sandbox_scenarios ADD COLUMN input_data TEXT");
  }

  // Seed Weibo data source
  const srcCount = db.prepare('SELECT COUNT(*) as count FROM data_sources WHERE name = ?').get('微博实时搜索') as { count: number };
  if (srcCount.count === 0) {
    db.prepare(
      `INSERT INTO data_sources (name, type, url, method, headers, query_params, field_mapping, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      '微博实时搜索',
      'http_api',
      'https://api.tikhub.io/api/v1/weibo/web_v2/fetch_realtime_search',
      'GET',
      JSON.stringify({
        Authorization: 'Bearer 0pBeLJ4/3FqailXMDaiW0kXpOQOGe7xl3QfpjRy4eP631WS9KDiCfWK+Kw==',
      }),
      JSON.stringify({
        query: '{brand}',
        page: '1',
      }),
      JSON.stringify({
        dataPath: 'data.parsed_data.results',
        content: 'content',
        date: 'publish_time',
        url: 'post_url',
        source: 'source',
        likes: 'interaction.like_count',
        urlPrefix: 'https:',
      }),
      1,
    );
  }
}
