import './globals.css';
import { AssistantProvider } from '@/lib/assistant-context';
import FloatingAssistant from '@/components/layout/FloatingAssistant';

export const metadata = {
  title: 'Growth Loop',
  description: '营销增长决策平台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AssistantProvider>
          {children}
          <FloatingAssistant />
        </AssistantProvider>
      </body>
    </html>
  );
}
