import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import ConfirmActionForm from "@/app/components/confirm-action-form";

export default function AccountSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fffaf0] px-4 py-8 text-[#263c36]">
          <p role="status">アカウント情報を読み込んでいます...</p>
        </main>
      }
    >
      <AccountSettingsContent />
    </Suspense>
  );
}

async function AccountSettingsContent() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  async function logout() {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user?.id) redirect("/");
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="min-h-screen bg-[#fffaf0] px-4 py-8 text-[#263c36] sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <Link
          className="text-sm font-semibold text-[#087f3a] underline underline-offset-4"
          href="/settings"
        >
          設定メニューへ戻る
        </Link>
        <header className="my-7 border-b border-[#d9dfd8] pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#ba694f]">
            Account
          </p>
          <h1 className="mt-1 text-2xl font-bold">アカウント</h1>
        </header>
        <section className="rounded-md border border-[#d9dfd8] bg-white p-5">
          <h2 className="font-semibold">ログアウト</h2>
          <p className="mt-2 text-sm leading-6 text-[#56645e]">
            ログアウトすると、次回利用時に再度ログインが必要です。
          </p>
          <ConfirmActionForm
            action={logout}
            message="ログアウトしますか？"
            buttonLabel="ログアウトする"
            className="mt-5"
            buttonClassName="min-h-11 w-full rounded-md border border-[#ba694f] px-4 font-semibold text-[#9e543d] hover:bg-[#fdf1eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
          />
        </section>
      </div>
    </main>
  );
}
