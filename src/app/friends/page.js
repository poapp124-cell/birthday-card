import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureBirthdayProfile } from "@/lib/birthday-profile";
import {
  acceptFriendRequest,
  findUserByCustomId,
  getFriendRequestLists,
  rejectFriendRequest,
  sendFriendRequest,
} from "@/lib/friend-requests";

const customIdPattern = /^[a-z0-9_]{3,20}$/;
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function FriendsPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fffaf0] px-6 py-12 text-[#263c36]">
          <p role="status">フレンド情報を読み込んでいます...</p>
        </main>
      }
    >
      <Friends searchParams={searchParams} />
    </Suspense>
  );
}

async function Friends({ searchParams }) {
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

  const query = String(params.myId || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  const searchResult =
    databaseConfigured && customIdPattern.test(query)
      ? await findUserByCustomId(query, session.user.id)
      : null;
  const lists = databaseConfigured
    ? await getFriendRequestLists(session.user.id)
    : { incoming: [], outgoing: [], friends: [] };

  async function requestFriend(formData) {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user?.id) redirect("/");

    const customId = String(formData.get("customId") || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    if (!customIdPattern.test(customId)) redirect("/friends?error=invalid-id");

    const result = await sendFriendRequest(currentSession.user.id, customId);
    redirect(`/friends?result=${result}`);
  }

  async function acceptRequest(formData) {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user?.id) redirect("/");

    const requestId = String(formData.get("requestId") || "");
    if (!requestIdPattern.test(requestId)) redirect("/friends?error=invalid-request");

    const accepted = await acceptFriendRequest(requestId, currentSession.user.id);
    redirect(`/friends?result=${accepted ? "accepted" : "request-expired"}`);
  }

  async function rejectRequest(formData) {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user?.id) redirect("/");

    const requestId = String(formData.get("requestId") || "");
    if (!requestIdPattern.test(requestId)) redirect("/friends?error=invalid-request");

    const rejected = await rejectFriendRequest(requestId, currentSession.user.id);
    redirect(`/friends?result=${rejected ? "rejected" : "request-expired"}`);
  }

  return (
    <main className="min-h-screen bg-[#fffaf0] px-5 py-10 text-[#263c36] sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          className="text-sm font-semibold text-[#087f3a] underline underline-offset-4"
          href="/"
        >
          ホームへ戻る
        </Link>
        <header className="my-8 border-b border-[#d9dfd8] pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#ba694f]">
            Friends
          </p>
          <h1 className="mt-1 text-2xl font-bold">フレンド</h1>
          <p className="mt-2 text-sm text-[#56645e]">
            My IDで検索して申請し、承認後にカードを送り合えます。
          </p>
        </header>

        {!databaseConfigured ? (
          <p className="rounded-md border border-[#e4c9ad] bg-white p-4 text-sm text-[#8a4b22]" role="alert">
            フレンド機能を使うにはNeonデータベースの設定が必要です。
          </p>
        ) : (
          <>
            <section className="border-b border-[#d9dfd8] pb-7">
              <h2 className="mb-4 text-lg font-semibold">My IDで検索</h2>
              <form action="/friends" method="get" className="flex gap-3">
                <label className="flex min-h-11 min-w-0 flex-1 items-center rounded-md border border-[#b9c8bf] bg-white px-3 focus-within:border-[#087f3a] focus-within:ring-2 focus-within:ring-[#087f3a]/20">
                  <span className="mr-1 text-[#56645e]">@</span>
                  <input
                    className="min-w-0 flex-1 bg-transparent text-base outline-none"
                    name="myId"
                    type="search"
                    minLength={3}
                    maxLength={20}
                    pattern="[a-zA-Z0-9_]{3,20}"
                    placeholder="my_id"
                    defaultValue={query}
                    aria-label="検索するMy ID"
                    required
                  />
                </label>
                <button
                  className="min-h-11 rounded-md bg-[#263c36] px-5 font-semibold text-white hover:bg-[#38584e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                  type="submit"
                >
                  検索
                </button>
              </form>
              {params.error === "invalid-id" && (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  My IDは3〜20文字の英数字または _ で入力してください。
                </p>
              )}
              {query && !customIdPattern.test(query) && (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  My IDは3〜20文字の英数字または _ で入力してください。
                </p>
              )}
              {customIdPattern.test(query) && (
                searchResult ? (
                  <div className="mt-4 flex flex-wrap items-center gap-4 rounded-md border border-[#d9dfd8] bg-white p-4">
                    {searchResult.profileImage ? (
                      <Image
                        className="size-12 rounded-full object-cover"
                        src={searchResult.profileImage}
                        alt=""
                        width={48}
                        height={48}
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-12 items-center justify-center rounded-full bg-[#dce8df] font-semibold" aria-hidden="true">
                        {searchResult.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{searchResult.name}</p>
                      <p className="text-sm text-[#56645e]">@{searchResult.customId}</p>
                    </div>
                    <form action={requestFriend}>
                      <input type="hidden" name="customId" value={searchResult.customId} />
                      <button
                        className="min-h-10 rounded-md bg-[#ba694f] px-4 font-semibold text-white hover:bg-[#9e543d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                        type="submit"
                      >
                        フレンド申請
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[#56645e]" role="status">
                    該当するユーザーが見つかりません。
                  </p>
                )
              )}
            </section>

            {params.result && (
              <p className="mt-5 rounded-md bg-white p-3 text-sm text-[#087f3a]" role="status">
                {params.result === "sent" && "フレンド申請を送りました。"}
                {params.result === "pending" && "この相手には申請済みです。"}
                {params.result === "incoming-request" && "この相手から届いた申請を受信一覧で確認してください。"}
                {params.result === "already-friends" && "この相手とはすでにフレンドです。"}
                {params.result === "not-found" && "該当するMy IDが見つかりません。"}
                {params.result === "accepted" && "フレンド申請を承認しました。"}
                {params.result === "rejected" && "フレンド申請を拒否しました。"}
                {params.result === "request-expired" && "申請はすでに処理されています。"}
              </p>
            )}

            <section className="mt-8 border-b border-[#d9dfd8] pb-7">
              <h2 className="mb-4 text-lg font-semibold">
                届いた申請 <span className="text-sm text-[#56645e]">{lists.incoming.length}</span>
              </h2>
              {lists.incoming.length === 0 ? (
                <p className="text-sm text-[#56645e]">新しい申請はありません。</p>
              ) : (
                <ul className="divide-y divide-[#e5e9e3] rounded-md border border-[#d9dfd8] bg-white">
                  {lists.incoming.map((request) => (
                    <li className="flex flex-wrap items-center gap-3 p-4" key={request.id}>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{request.name}</p>
                        <p className="text-sm text-[#56645e]">@{request.customId}</p>
                      </div>
                      <form action={acceptRequest}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <button className="min-h-10 rounded-md bg-[#087f3a] px-4 text-sm font-semibold text-white hover:bg-[#06682f]" type="submit">
                          承認
                        </button>
                      </form>
                      <form action={rejectRequest}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <button className="min-h-10 rounded-md border border-[#b9c8bf] px-4 text-sm font-semibold hover:bg-[#edf2ed]" type="submit">
                          拒否
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8 border-b border-[#d9dfd8] pb-7">
              <h2 className="mb-4 text-lg font-semibold">
                送った申請 <span className="text-sm text-[#56645e]">{lists.outgoing.length}</span>
              </h2>
              {lists.outgoing.length === 0 ? (
                <p className="text-sm text-[#56645e]">送信した申請はありません。</p>
              ) : (
                <ul className="divide-y divide-[#e5e9e3] rounded-md border border-[#d9dfd8] bg-white">
                  {lists.outgoing.map((request) => (
                    <li className="flex items-center justify-between gap-3 p-4" key={request.id}>
                      <div>
                        <p className="font-semibold">{request.name}</p>
                        <p className="text-sm text-[#56645e]">@{request.customId}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {request.status === "pending" && "承認待ち"}
                        {request.status === "accepted" && "承認済み"}
                        {request.status === "rejected" && "拒否"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">
                フレンド <span className="text-sm text-[#56645e]">{lists.friends.length}</span>
              </h2>
              {lists.friends.length === 0 ? (
                <p className="text-sm text-[#56645e]">承認済みのフレンドはいません。</p>
              ) : (
                <ul className="divide-y divide-[#e5e9e3] rounded-md border border-[#d9dfd8] bg-white">
                  {lists.friends.map((friend) => (
                    <li className="flex items-center justify-between gap-3 p-4" key={friend.publicId}>
                      <div>
                        <p className="font-semibold">{friend.name}</p>
                        <p className="text-sm text-[#56645e]">@{friend.customId}</p>
                      </div>
                      <Link
                        className="text-sm font-semibold text-[#087f3a] underline underline-offset-4"
                        href={`/timeline/${friend.publicId}`}
                      >
                        バースデーカード
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
