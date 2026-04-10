import type { DataSourceConfig, FieldMapping } from './types';
import { searchNotes, toFetchedItems } from './xiaohongshu/search';
import { getDb } from './db';

export interface FetchedItem {
  source: string;
  brand: string;
  content: string;
  score: number | null;
  likes: number;
  date: string;
  url: string;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce(
    (cur, key) => (cur != null && typeof cur === 'object' ? (cur as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

function resolveTemplate(value: string, vars: Record<string, string>): string {
  return value.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

export async function fetchFromDataSource(
  config: DataSourceConfig,
  brand: string,
): Promise<FetchedItem[]> {
  if (config.type === 'xiaohongshu') {
    return fetchFromXiaohongshu(brand);
  }

  if (config.type === 'import') {
    return [];
  }

  try {
    const url = new URL(config.url);

    for (const [k, v] of Object.entries(config.queryParams)) {
      url.searchParams.append(k, resolveTemplate(v, { brand }));
    }

    const headers: Record<string, string> = { ...config.headers };
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['accept'] = headers['accept'] || 'application/json';
    }

    const res = await fetch(url.toString(), {
      method: config.method,
      headers,
    });

    if (!res.ok) throw new Error(`${config.name} returned ${res.status}`);

    const body = await res.json();

    const mapping = config.fieldMapping;
    let items: unknown[];
    if (mapping.dataPath) {
      const extracted = getNestedValue(body, mapping.dataPath);
      items = Array.isArray(extracted) ? extracted : [];
    } else if (Array.isArray(body)) {
      items = body;
    } else {
      items = (body.data || body.items || body.results || []) as unknown[];
    }

    return items
      .map(item => mapFields(item as Record<string, unknown>, mapping, config.name, brand))
      .filter(it => it.content.length > 0);
  } catch (error) {
    console.error(`Failed to fetch from ${config.name}:`, error);
    return [];
  }
}

function mapFields(
  item: Record<string, unknown>,
  mapping: FieldMapping,
  sourceName: string,
  defaultBrand: string,
): FetchedItem {
  const urlRaw = mapping.url ? String(getNestedValue(item, mapping.url) ?? '') : '';
  const urlPrefix = mapping.urlPrefix || '';

  return {
    source: sourceName,
    brand: mapping.brand ? String(getNestedValue(item, mapping.brand) ?? defaultBrand) : defaultBrand,
    content: mapping.content ? String(getNestedValue(item, mapping.content) ?? '') : '',
    score: mapping.score ? Number(getNestedValue(item, mapping.score)) || null : null,
    likes: mapping.likes ? Number(getNestedValue(item, mapping.likes)) || 0 : 0,
    date: mapping.date ? String(getNestedValue(item, mapping.date) ?? '') : new Date().toISOString().split('T')[0],
    url: urlRaw.startsWith('http') ? urlRaw : urlPrefix + urlRaw,
  };
}

async function fetchFromXiaohongshu(brand: string): Promise<FetchedItem[]> {
  try {
    const notes = await searchNotes(brand);
    const items = toFetchedItems(notes, brand);
    console.log(`[Adapter] XHS: fetched ${items.length} items for "${brand}"`);
    return items;
  } catch (e) {
    console.error(`[Adapter] XHS fetch failed for "${brand}":`, e);
    return [];
  }
}

export async function fetchFromUploadedReviewsByBatch(
  batchIds: string[],
): Promise<FetchedItem[]> {
  if (batchIds.length === 0) return [];
  try {
    const db = getDb();
    const placeholders = batchIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT content, score, author, date, platform, app_name, brand
       FROM uploaded_reviews
       WHERE batch_id IN (${placeholders})
       ORDER BY created_at DESC`,
    ).all(...batchIds) as Array<{
      content: string; score: number | null; author: string;
      date: string; platform: string; app_name: string; brand: string;
    }>;

    const items: FetchedItem[] = rows.map(r => ({
      source: '导入数据',
      brand: r.brand || r.app_name || '未知',
      content: r.content,
      score: r.score,
      likes: 0,
      date: r.date || '',
      url: '',
    }));

    console.log(`[Adapter] Import: fetched ${items.length} reviews from ${batchIds.length} batch(es)`);
    return items;
  } catch (e) {
    console.error(`[Adapter] Import data fetch failed:`, e);
    return [];
  }
}

