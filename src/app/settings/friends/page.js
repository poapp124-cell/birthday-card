import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ConfirmActionForm from "@/app/components/confirm-action-form";
import { ensureBirthdayProfile } from "@/lib/birthday-profile";
import {
  blockFriend,
  getFriendManagementList,
  removeFriend,
  unblockFriend,
} from "@/lib/friend-requests";

const publicIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function birthdayLabel(birthday) {
  if (!birthday) return "誕生日未登録";
  const [month, day] = birthday.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

async function getActionTarget(formData) {
  const currentSession = await auth();
  if (!currentSession?.user?.id) redirect("/");
  if (!process.env.DATABASE_URL) {
    redirect("/settings/friends?result=unavailable");
  }
  const publicId = String(formData.get("publicId") || "");
  if (!publicIdPattern.test(publicId)) {
    redirect("/settings/friends?result=invalid");
  }
  return { userId: currentSession.user.id, publicId };
}

export default function FriendSettingsPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fffaf0] px-4 py-8 text-[#263c36]">
          <p role="status">フレンド設定を読み込んでいます...</p>
        </main>
      }
    >
      <FriendSettingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function FriendSettingsContent({ searchParams }) {
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
  const friends = databaseConfigured
    ? await getFriendManagementList(session.user.id)
    : [];

  async function blockAction(formData) {
    "use server";
    const { userId, publicId } = await getActionTarget(formData);
    const updated = await blockFriend(userId, publicId);
    redirect(`/settings/friends?result=${updated ? "blocked" : "not-friend"}`);
  }

  async function unblockAction(formData) {
    "use server";
    const { userId, publicId } = await getActionTarget(formData);
    const updated = await unblockFriend(userId, publicId);
    redirect(`/settings/friends?result=${updated ? "unblocked" : "not-blocked"}`);
  }

  async function removeAction(formData) {
    "use server";
    const { userId, publicId } = await getActionTarget(formData);
    const removed = await removeFriend(userId, publicId);
    redirect(`/settings/friends?result=${removed ? "removed" : "not-friend"}`);
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
            Friends
          </p>
          <h1 className="mt-1 text-2xl font-bold">フレンド管理・非表示設定</h1>
          <p className="mt-2 text-sm leading-6 text-[#56645e]">
            ブロックすると相手にはあなたのバースデーカードが一部だけ表示されます。フレンド関係とカード送信は維持されます。
          </p>
        </header>

        {params.result && (
          <p className="mb-4 rounded-md bg-white p-3 text-sm text-[#087f3a]" role="status">
            {params.result === "blocked" && "相手をブロックしました。"}
            {params.result === "unblocked" && "ブロックを解除しました。"}
            {params.result === "removed" && "フレンド関係を解除しました。"}
            {params.result === "not-friend" && "対象のフレンド関係が見つかりません。"}
            {params.result === "not-blocked" && "ブロック設定が見つかりません。"}
            {params.result === "invalid" && "操作対象を確認できませんでした。"}
            {params.result === "unavailable" && "フレンド管理のデータベース設定がありません。"}
          </p>
        )}

        {!databaseConfigured ? (
          <p className="rounded-md border border-[#e4c9ad] bg-white p-4 text-sm text-[#8a4b22]" role="alert">
            フレンド管理を使うにはNeonデータベースの設定が必要です。
          </p>
        ) : friends.length === 0 ? (
          <section className="rounded-md border border-[#d9dfd8] bg-white p-5 text-center">
            <p className="text-sm text-[#56645e]">管理できるフレンドはいません。</p>
            <Link
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-[#087f3a] px-4 text-sm font-semibold text-white hover:bg-[#06682f]"
              href="/friends"
            >
              フレンドを探す
            </Link>
          </section>
        ) : (
          <ul className="space-y-3">
            {friends.map((friend) => {
              const hiddenFields = [{ name: "publicId", value: friend.publicId }];
              return (
                <li
                  className="rounded-md border border-[#d9dfd8] bg-white p-4"
                  key={friend.publicId}
                >
                  <p className="font-semibold">{friend.name}</p>
                  <p className="mt-1 text-sm text-[#56645e]">
                    @{friend.customId || "ID未登録"}
                    <span className="mx-2 text-[#b9c8bf]">·</span>
                    {birthdayLabel(friend.birthday)}
                  </p>
                  {friend.blocked && (
                    <p className="mt-3 text-sm font-semibold text-[#9e543d]" role="status">
                      この相手はブロック中です
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {friend.blocked ? (
                      <ConfirmActionForm
                        action={unblockAction}
                        message={`${friend.name}さんのブロックを解除しますか？`}
                        buttonLabel="ブロック解除"
                        hiddenFields={hiddenFields}
                        buttonClassName="min-h-10 rounded-md border border-[#b9c8bf] px-3 text-sm font-semibold hover:bg-[#edf2ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                      />
                    ) : (
                      <ConfirmActionForm
                        action={blockAction}
                        message={`${friend.name}さんをブロックしますか？相手にはあなたのバースデーカードが一部だけ表示されます。`}
                        buttonLabel="バースデーカードを制限"
                        hiddenFields={hiddenFields}
                        buttonClassName="min-h-10 rounded-md border border-[#b9c8bf] px-3 text-sm font-semibold hover:bg-[#edf2ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                      />
                    )}
                    <ConfirmActionForm
                      action={removeAction}
                      message={`${friend.name}さんとのフレンド関係を解除しますか？`}
                      buttonLabel="フレンドを削除"
                      hiddenFields={hiddenFields}
                      buttonClassName="min-h-10 rounded-md border border-[#ba694f] px-3 text-sm font-semibold text-[#9e543d] hover:bg-[#fdf1eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
