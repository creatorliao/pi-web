import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ToastHost } from "@/components/ToastHost";
import { I18nProvider } from "@/hooks/useI18n";
import { ToastProvider } from "@/hooks/useToast";

export default function Home() {
  return (
    <Suspense>
      <I18nProvider>
        <ToastProvider>
          <AppShell />
          <ToastHost />
        </ToastProvider>
      </I18nProvider>
    </Suspense>
  );
}
