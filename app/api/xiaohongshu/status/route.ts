import { checkSession } from '@/lib/xiaohongshu/auth';
import { hasSavedCookies, clearCookies } from '@/lib/xiaohongshu/browser';

export async function GET() {
  try {
    if (!hasSavedCookies()) {
      return Response.json({ loggedIn: false });
    }
    const result = await checkSession();
    return Response.json(result);
  } catch (e) {
    console.error('[XHS Status] Error:', e);
    return Response.json({ loggedIn: false });
  }
}

export async function DELETE() {
  try {
    clearCookies();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '断开失败' }, { status: 500 });
  }
}
