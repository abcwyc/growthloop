import Navigation from '@/components/layout/Navigation';

export const metadata = {
  title: 'Growth Loop · 设置',
  description: '数据源配置与专家经验 Prompt 管理',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="growthbox min-h-screen bg-slate-50">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
