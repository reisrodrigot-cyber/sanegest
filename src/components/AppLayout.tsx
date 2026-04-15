import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

export const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
