import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import HomeTabs from "@/app/components/home-tabs";
import PushNotificationSettings from "@/app/components/push-notification-settings";
import {
  ensureBirthdayProfile,
  getBirthdayProfile,
} from "@/lib/birthday-profile";
import {
  getBirthdayFriends,
  getDaysUntilBirthday,
} from "@/lib/birthday-cards";

export default function Home({ searchParams }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fffaf0] px-6 py-16 text-[#263c36]">
          <p role="status">ホームを読み込んでいます...</p>
        </main>
      }
    >
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }) {
  await connection();
  const session = await auth();
  const user = session?.user;
  const params = searchParams ? await searchParams : {};
  const databaseConfigured = Boolean(process.env.DATABASE_URL);

  if (!user?.id) {
    async function handleLineLogin() {
      "use server";
      await signIn("line", { redirectTo: "/" });
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf0] px-6 py-16 text-[#263c36]">
        <section className="w-full max-w-lg text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#ba694f]">
            Birthday Card
          </p>
          <h1 className="mb-3 text-4xl font-bold">大切な人に、カードを贈ろう</h1>
          <p className="mb-8 text-base leading-7 text-[#56645e]">
            LINEアカウントでログインして、友達へバースデーカードを送りましょう。
          </p>
          <form action={handleLineLogin}>
            <button
              className="min-h-12 w-full rounded-md bg-[#06c755] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#05b34c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
              type="submit"
            >
              LINEでログイン
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (databaseConfigured) {
    await ensureBirthdayProfile(user.id, user.name, user.image);
  }

  const profile = databaseConfigured ? await getBirthdayProfile(user.id) : null;
  const friends = databaseConfigured ? await getBirthdayFriends(user.id) : [];
  const profileBirthdayDays = getDaysUntilBirthday(profile?.birthday);
  const postedTo = typeof params.postedTo === "string" && uuidPattern.test(params.postedTo)
    ? params.postedTo
    : null;
  const initialTab = ["upcoming", "friends"].includes(params.tab)
    ? params.tab
    : "upcoming";
  return (
    <main className="min-h-screen bg-[#fffaf0] px-4 py-5 text-[#263c36] sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-md">
        <header className="border-b border-[#d9dfd8] pb-5">
          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {user.image ? (
                <Image
                  className="size-11 shrink-0 rounded-full object-cover"
                  src={user.image}
                  alt=""
                  width={44}
                  height={44}
                  unoptimized
                />
              ) : (
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#dce8df] font-semibold" aria-hidden="true">
                  {(profile?.displayName || user.name || "L").slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ba694f]">
                  Birthday Card
                </p>
                <h1 className="mt-1 truncate text-2xl font-bold">
                  {profile?.displayName || user.name || "マイページ"}
                </h1>
              </div>
            </div>
            <nav className="grid grid-cols-2 gap-2">
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#b9c8bf] bg-white px-2 text-sm font-semibold hover:bg-[#edf2ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                href="/settings"
              >
                設定
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#087f3a] px-2 text-sm font-semibold text-white hover:bg-[#06682f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                href="/friends"
              >
                フレンドを探す
              </Link>
            </nav>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[#c7d5cb] bg-white px-3 py-2.5">
            <p className="text-sm font-semibold text-[#263c36]">My ID</p>
            {profile?.customId ? (
              <p className="min-w-0 break-all text-right text-sm text-[#56645e]">
                @{profile.customId}
              </p>
            ) : (
              <Link
                className="text-sm font-semibold text-[#087f3a] underline underline-offset-4"
                href="/settings/profile"
              >
                My IDを設定
              </Link>
            )}
          </div>

          {profile?.birthday && profile?.publicId && (
            <div className="mt-3">
              {profileBirthdayDays === 0 ? (
                <Link
                  className="flex min-h-12 items-center justify-center rounded-md bg-[#ba694f] px-4 text-center font-bold text-white shadow-sm transition-colors hover:bg-[#9e543d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                  href={`/timeline/${profile.publicId}`}
                >
                  届いたカードを開く
                </Link>
              ) : (
                <p className="rounded-md border border-[#eadfc9] bg-white px-3 py-3 text-center text-sm font-semibold text-[#85432e]">
                  {Number(profile.birthday.split("-")[0])}月{Number(profile.birthday.split("-")[1])}日（誕生日）に開きます
                </p>
              )}
            </div>
          )}

          {!profile?.birthday && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#8a4b22]" role="status">
              誕生日を登録すると、友達がカードを送れるようになります。
              <Link className="font-semibold underline underline-offset-4" href="/settings/profile">
                誕生日を設定
              </Link>
            </p>
          )}
        </header>

        <HomeTabs
          friends={friends}
          initialTab={initialTab}
          postedTo={postedTo}
        />
        <PushNotificationSettings showSettings={false} />
      </div>
    </main>
  );
}
