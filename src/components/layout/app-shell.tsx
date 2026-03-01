import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <Header />
      <main className="mx-auto max-w-5xl px-4 pt-14 pb-16 md:pl-64 md:pt-4 md:pb-4">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
