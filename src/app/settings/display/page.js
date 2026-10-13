import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppearanceSettings from "@/app/components/appearance-settings";

export default function DisplaySettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4 py-8">
          <p role="status">表示設定を読み込んでいます...</p>
        </main>
      }
    >
      <DisplaySettingsContent />
    </Suspense>
  );
}

async function DisplaySettingsContent() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return (
    <main className="min-h-screen px-4 py-8 text-[#263c36] sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <Link
          className="text-sm font-semibold text-[var(--accent)] underline underline-offset-4"
          href="/settings"
        >
          設定メニューへ戻る
        </Link>
        <header className="my-7 border-b border-[#d9dfd8] pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Display
          </p>
          <h1 className="mt-1 text-2xl font-bold">表示設定</h1>
        </header>
        <AppearanceSettings />
      </div>
    </main>
  );
}
