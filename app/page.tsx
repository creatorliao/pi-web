import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ToastHost } from "@/components/ToastHost";
import { I18nProvider } from "@/hooks/useI18n";
import { ToastProvider } from "@/hooks/useToast";

export default function Home() {
  return (
    <Suspense fallback={<div style={{ width: "100%", height: "100%", background: "var(--bg)" }} />}>
      <I18nProvider>
        <ToastProvider>
          <AppShell />
          <ToastHost />
        </ToastProvider>
      </I18nProvider>
    </Suspense>
  );
}
