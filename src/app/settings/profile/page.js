import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import CustomIdField from "@/app/settings/custom-id-field";
import {
  ensureBirthdayProfile,
  getBirthdayProfile,
  isCustomIdAvailable,
  saveProfileSettings,
} from "@/lib/birthday-profile";

export default function SettingsPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fffaf0] px-6 py-12 text-[#263c36]">
          <p role="status">プロフィールを読み込んでいます...</p>
        </main>
      }
    >
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const params = searchParams ? await searchParams : {};
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  if (databaseConfigured) {
    await ensureBirthdayProfile(
      session.user.id,
      session.user.name,
      session.user.image,
    );
  }
  const profile = databaseConfigured
    ? await getBirthdayProfile(session.user.id)
    : null;

  async function saveSettings(formData) {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user?.id) redirect("/");

    const displayName = String(formData.get("displayName") || "").trim();
    const birthdayInput = String(formData.get("birthdayMonthDay") || "").trim();
    const customIdInput = String(formData.get("customId") || "")
      .trim()
      .toLowerCase();
    const allowBirthdayNotification =
      formData.get("allowBirthdayNotification") === "on";

    if (!displayName || displayName.length > 80) {
      redirect("/settings/profile?error=invalid-profile");
    }

    const birthdayMatch = birthdayInput.match(
      /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/,
    );
    if (!birthdayMatch) redirect("/settings/profile?error=invalid-birthday");

    const month = Number(birthdayMatch[1]);
    const day = Number(birthdayMatch[2]);
    const date = new Date(Date.UTC(2000, month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      redirect("/settings/profile?error=invalid-birthday");
    }

    if (customIdInput && !/^[a-z0-9_]{3,20}$/.test(customIdInput)) {
      redirect("/settings/profile?error=invalid-custom-id");
    }

    if (
      customIdInput &&
      !(await isCustomIdAvailable(customIdInput, currentSession.user.id))
    ) {
      redirect("/settings/profile?error=id-taken");
    }

    try {
      await saveProfileSettings(currentSession.user.id, {
        displayName,
        birthdayMonthDay: birthdayInput,
        allowBirthdayNotification,
        customId: customIdInput || null,
      });
    } catch (error) {
      if (error?.code === "23505") redirect("/settings/profile?error=id-taken");
      throw error;
    }

    redirect("/settings/profile?saved=1");
  }

  return (
    <main className="min-h-screen bg-[#fffaf0] px-5 py-10 text-[#263c36] sm:px-8">
      <div className="mx-auto w-full max-w-xl">
        <Link
          className="text-sm font-semibold text-[#087f3a] underline underline-offset-4"
          href="/settings"
        >
          設定メニューへ戻る
        </Link>
        <header className="my-8 flex items-center gap-4 border-b border-[#d9dfd8] pb-6">
          {session.user.image ? (
            <Image
              className="size-16 rounded-full object-cover"
              src={session.user.image}
              alt=""
              width={64}
              height={64}
              unoptimized
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-[#dce8df] text-2xl font-semibold">
              {(profile?.displayName || session.user.name || "L").slice(0, 1)}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#ba694f]">
              Profile Settings
            </p>
            <h1 className="mt-1 text-2xl font-bold">プロフィール設定</h1>
          </div>
        </header>

        {!databaseConfigured ? (
          <p className="rounded-md border border-[#e4c9ad] bg-white p-4 text-sm text-[#8a4b22]" role="alert">
            保存するにはNeonデータベースの設定が必要です。
          </p>
        ) : (
          <form action={saveSettings} className="space-y-6 rounded-md border border-[#eadfc9] bg-white p-6">
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="displayName">
                表示名
              </label>
              <input
                className="min-h-11 w-full rounded-md border border-[#b9c8bf] px-3 text-base outline-none focus:border-[#087f3a] focus:ring-2 focus:ring-[#087f3a]/20"
                id="displayName"
                name="displayName"
                type="text"
                autoComplete="nickname"
                maxLength={80}
                required
                defaultValue={profile?.displayName || session.user.name || ""}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="birthdayMonthDay">
                誕生日（月日）
              </label>
              <input
                className="min-h-11 w-full rounded-md border border-[#b9c8bf] px-3 text-base outline-none focus:border-[#087f3a] focus:ring-2 focus:ring-[#087f3a]/20"
                id="birthdayMonthDay"
                name="birthdayMonthDay"
                type="text"
                inputMode="numeric"
                autoComplete="bday-day"
                maxLength={5}
                pattern="(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])"
                placeholder="MM-DD"
                required
                defaultValue={profile?.birthday || ""}
                aria-describedby="birthday-help"
              />
              <p id="birthday-help" className="mt-1 text-xs text-[#56645e]">
                例: 04-15。年は保存しません。
              </p>
            </div>
            <CustomIdField defaultValue={profile?.customId || ""} />
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
              <input
                className="size-4 accent-[#087f3a]"
                type="checkbox"
                name="allowBirthdayNotification"
                defaultChecked={profile?.allowBirthdayNotification ?? false}
              />
              誕生日通知を許可する
            </label>
            {params.error === "id-taken" && (
              <p className="text-sm text-red-700" role="alert">
                このIDは既に使用されています。
              </p>
            )}
            {params.error === "invalid-custom-id" && (
              <p className="text-sm text-red-700" role="alert">
                My IDの形式を確認してください。
              </p>
            )}
            {params.error === "invalid-profile" && (
              <p className="text-sm text-red-700" role="alert">
                表示名を1〜80文字で入力してください。
              </p>
            )}
            {params.error === "invalid-birthday" && (
              <p className="text-sm text-red-700" role="alert">
                実在する月日を MM-DD 形式で入力してください。
              </p>
            )}
            {params.saved === "1" && (
              <p className="text-sm text-[#087f3a]" role="status">
                プロフィールを保存しました。
              </p>
            )}
            <button
              className="min-h-11 w-full rounded-md bg-[#263c36] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#38584e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
              type="submit"
            >
              保存する
            </button>
          </form>
        )}
        <nav className="mt-6 flex gap-5 text-sm font-semibold">
          <Link className="text-[#087f3a] underline underline-offset-4" href="/friends">
            フレンドを探す
          </Link>
          {profile?.publicId && (
            <Link
              className="text-[#087f3a] underline underline-offset-4"
              href={`/timeline/${profile.publicId}`}
            >
              バースデーカード
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
