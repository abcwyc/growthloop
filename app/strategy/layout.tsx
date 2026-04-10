import Navigation from '@/components/layout/Navigation';

export const metadata = {
  title: 'Growth Loop · 策略',
  description: '营销策略生成与管理',
};

export default function StrategyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="growthbox min-h-screen bg-slate-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
