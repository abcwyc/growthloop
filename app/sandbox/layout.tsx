import Navigation from '@/components/layout/Navigation';

export const metadata = {
  title: 'Growth Loop · 沙盘',
  description: '策略推演与多维度模拟',
};

export default function SandboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="growthbox min-h-screen bg-slate-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
