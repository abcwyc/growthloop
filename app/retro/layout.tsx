import Navigation from '@/components/layout/Navigation';

export const metadata = {
  title: 'Growth Loop · 复盘',
  description: 'Campaign 效果数据导入与归因分析',
};

export default function RetroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="growthbox min-h-screen bg-slate-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
