import { getBrowser, loadCookies, hasSavedCookies } from './browser';

export interface XhsNoteItem {
  noteId: string;
  title: string;
  content: string;
  likes: number;
  date: string;
  url: string;
  author: string;
  source: string;
}

interface FetchedItem {
  source: string;
  brand: string;
  content: string;
  score: number | null;
  likes: number;
  date: string;
  url: string;
}

export async function searchNotes(keyword: string, _page = 1): Promise<XhsNoteItem[]> {
  if (!hasSavedCookies()) {
    console.log('[XHS] No saved cookies, cannot search');
    return [];
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    );
    await loadCookies(page);

    // Intercept XHS search API responses to capture structured data
    let apiData: XhsNoteItem[] = [];
    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (url.includes('/api/sns/web/v1/search/notes') || url.includes('/api/sns/web/v2/search/notes')) {
          const json = await response.json();
          apiData = parseApiResponse(json);
          console.log(`[XHS] Intercepted API response: ${apiData.length} notes`);
        }
      } catch { /* non-json response, skip */ }
    });

    // Navigate directly to XHS search page — triggers the search API internally
    const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes`;
    console.log(`[XHS] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
    await delay(3000);

    // If API interception captured data, use it
    if (apiData.length > 0) {
      console.log(`[XHS] Using ${apiData.length} items from intercepted API`);
      return apiData;
    }

    // Fallback: scrape the rendered DOM
    console.log('[XHS] No API data intercepted, scraping DOM...');
    await page.evaluate(() => window.scrollBy(0, 600));
    await delay(1500);

    const notes = await page.evaluate(() => {
      const items: Array<{
        noteId: string; title: string; content: string;
        likes: number; date: string; url: string; author: string;
      }> = [];

      // XHS search result cards are typically <section> or <div> with note links
      const cards = document.querySelectorAll(
        'section.note-item, [class*="note-item"], a[href*="/search_result/"], a[href*="/explore/"]',
      );

      const seen = new Set<string>();
      cards.forEach(card => {
        const link = card.tagName === 'A' ? card : (card.querySelector('a[href*="/explore/"]') || card.querySelector('a'));
        const href = link?.getAttribute('href') || '';
        const noteIdMatch = href.match(/(?:explore|discovery\/item)\/([a-f0-9]+)/);
        const noteId = noteIdMatch?.[1] || '';
        if (noteId && seen.has(noteId)) return;
        if (noteId) seen.add(noteId);

        // Title from the card
        const titleEl = card.querySelector('[class*="title"], .note-text, h3, p');
        const title = titleEl?.textContent?.trim() || '';

        // Author
        const authorEl = card.querySelector('[class*="author-wrapper"] .name, [class*="author"] .name, [class*="nickname"]');
        const author = authorEl?.textContent?.trim() || '';

        // Likes count
        const likeEl = card.querySelector('[class*="like-wrapper"] .count, [class*="like"] .count, [class*="engagements"]');
        const likeText = likeEl?.textContent?.trim() || '0';
        let likes = parseInt(likeText.replace(/[^\d.]/g, ''), 10) || 0;
        if (likeText.includes('万')) likes = Math.round(parseFloat(likeText) * 10000);

        if (title && title.length > 2) {
          items.push({
            noteId,
            title,
            content: title,
            likes,
            date: new Date().toISOString().split('T')[0],
            url: noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : '',
            author,
          });
        }
      });
      return items;
    });

    console.log(`[XHS] DOM scraping found ${notes.length} notes`);
    return notes.map(n => ({ ...n, source: '小红书' }));
  } catch (e) {
    console.error('[XHS] Search error:', e);
    return [];
  } finally {
    if (!page.isClosed()) {
      await page.close();
    }
  }
}

function parseApiResponse(data: Record<string, unknown>): XhsNoteItem[] {
  try {
    const inner = (data.data || data) as Record<string, unknown>;
    const notes = (inner.items || inner.notes || []) as Array<Record<string, unknown>>;
    return notes.map(note => {
      const card = (note.note_card || note) as Record<string, unknown>;
      const interact = (card.interact_info || {}) as Record<string, number>;
      const user = (card.user || {}) as Record<string, string>;
      const noteId = (note.id || card.note_id || '') as string;

      return {
        noteId,
        title: (card.display_title || card.title || '') as string,
        content: ((card.display_title || '') as string) + ' ' + ((card.desc || '') as string),
        likes: interact.liked_count || 0,
        date: formatTimestamp(card.last_update_time as number | undefined),
        url: noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : '',
        author: user.nickname || user.nick_name || '',
        source: '小红书',
      };
    }).filter(n => n.content.trim().length > 0);
  } catch {
    return [];
  }
}

export function toFetchedItems(notes: XhsNoteItem[], brand: string): FetchedItem[] {
  return notes
    .filter(n => n.content.trim().length > 0)
    .map(n => ({
      source: '小红书',
      brand,
      content: n.content.trim(),
      score: null,
      likes: n.likes,
      date: n.date,
      url: n.url,
    }));
}

function formatTimestamp(ts?: number): string {
  if (!ts) return new Date().toISOString().split('T')[0];
  const d = new Date(ts < 1e12 ? ts * 1000 : ts);
  return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
