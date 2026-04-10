import Navigation from '@/components/layout/Navigation';

export const metadata = {
  title: 'Growth Loop · 研究',
  description: '竞品动态监控与机会点识别',
};

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="growthbox min-h-screen bg-slate-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
