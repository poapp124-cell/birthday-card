import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const settingMenus = [
  {
    href: "/settings/profile",
    title: "プロフィール・My ID",
    description: "表示名、誕生日、My IDを設定します。",
  },
  {
    href: "/settings/display",
    title: "表示設定",
    description: "カラーテーマと文字サイズを変更します。",
  },
  {
    href: "/settings/notifications",
    title: "通知設定",
    description: "誕生日のお知らせとホーム画面追加の案内を設定します。",
  },
  {
    href: "/settings/friends",
    title: "フレンド管理・非表示設定",
    description: "フレンドの削除や、バースデーカードの閲覧制限を設定します。",
  },
  {
    href: "/settings/account",
    title: "アカウント",
    description: "アカウントのログアウトを行います。",
  },
];

export default function SettingsMenuPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fffaf0] px-4 py-8 text-[#263c36]">
          <p role="status">設定を読み込んでいます...</p>
        </main>
      }
    >
      <SettingsMenuContent />
    </Suspense>
  );
}

async function SettingsMenuContent() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return (
    <main className="min-h-screen bg-[#fffaf0] px-4 py-8 text-[#263c36] sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <Link
          className="text-sm font-semibold text-[#087f3a] underline underline-offset-4"
          href="/"
        >
          ホームへ戻る
        </Link>
        <header className="my-7 border-b border-[#d9dfd8] pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#ba694f]">
            Settings
          </p>
          <h1 className="mt-1 text-2xl font-bold">設定</h1>
        </header>
        <nav aria-label="設定メニュー" className="space-y-3">
          {settingMenus.map((menu) => (
            <Link
              className="block rounded-md border border-[#d9dfd8] bg-white p-4 transition-colors hover:bg-[#f3f6f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
              href={menu.href}
              key={menu.href}
            >
              <span className="block font-semibold">{menu.title}</span>
              <span className="mt-1 block text-sm leading-6 text-[#56645e]">
                {menu.description}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
