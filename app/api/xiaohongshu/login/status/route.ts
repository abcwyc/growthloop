import { checkLoginStatus } from '@/lib/xiaohongshu/auth';

export async function GET() {
  try {
    const result = await checkLoginStatus();
    return Response.json(result);
  } catch (e) {
    console.error('[XHS Login] Error checking status:', e);
    return Response.json({ status: 'error' }, { status: 500 });
  }
}
