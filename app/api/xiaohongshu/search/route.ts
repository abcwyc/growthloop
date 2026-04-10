import { searchNotes, toFetchedItems } from '@/lib/xiaohongshu/search';
import { hasSavedCookies } from '@/lib/xiaohongshu/browser';

export async function POST(request: Request) {
  try {
    const { keyword, page = 1, brand } = await request.json();

    if (!keyword) {
      return Response.json({ error: '关键词不能为空' }, { status: 400 });
    }

    if (!hasSavedCookies()) {
      return Response.json({ error: '未登录小红书，请先扫码登录' }, { status: 401 });
    }

    const notes = await searchNotes(keyword, page);
    const items = toFetchedItems(notes, brand || keyword);

    return Response.json({
      notes,
      items,
      total: notes.length,
    });
  } catch (e) {
    console.error('[XHS Search] Error:', e);
    return Response.json({ error: '搜索失败' }, { status: 500 });
  }
}
