import { startLogin, resetLoginStatus } from '@/lib/xiaohongshu/auth';

export async function POST() {
  try {
    resetLoginStatus();
    const { qrCode } = await startLogin();
    return Response.json({ qrCode });
  } catch (e) {
    console.error('[XHS Login] Error starting login:', e);
    return Response.json(
      { error: '启动登录失败，请稍后重试' },
      { status: 500 },
    );
  }
}
