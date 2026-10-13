import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import BirthdayCardForm from "@/app/components/birthday-card-form";
import {
  birthdayCardDesigns,
  createBirthdayCard,
  getBirthdayFriends,
} from "@/lib/birthday-cards";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function NewBirthdayCardPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4 py-8">
          <p role="status">カード作成画面を読み込んでいます...</p>
        </main>
      }
    >
      <NewBirthdayCardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewBirthdayCardContent({ searchParams }) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const params = searchParams ? await searchParams : {};
  const friendId =
    typeof params.friendId === "string" && uuidPattern.test(params.friendId)
      ? params.friendId
      : null;
  if (!friendId) redirect("/?tab=upcoming");

  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const friends = databaseConfigured
    ? await getBirthdayFriends(session.user.id)
    : [];
  const friend = friends.find(
    (candidate) =>
      candidate.publicId === friendId && candidate.daysUntilBirthday <= 1,
  );
  if (!friend) redirect("/?tab=upcoming&cardError=friend-unavailable");

  async function createCardAction(formData) {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user?.id) redirect("/");

    const receiverPublicId = String(
      formData.get("receiverPublicId") || "",
    ).trim();
    const message = String(formData.get("message") || "").trim();
    const designId = String(formData.get("designId") || "");
    const visibility = formData.get("visibility");
    if (
      receiverPublicId !== friend.publicId ||
      (visibility !== "public" && visibility !== "private") ||
      !birthdayCardDesigns.includes(designId) ||
      !message ||
      message.length > 1000
    ) {
      redirect(
        `/cards/new?friendId=${encodeURIComponent(friend.publicId)}&error=invalid-input`,
      );
    }

    const currentFriends = await getBirthdayFriends(currentSession.user.id);
    const eligibleFriend = currentFriends.some(
      (candidate) =>
        candidate.publicId === receiverPublicId &&
        candidate.daysUntilBirthday <= 1,
    );
    if (!eligibleFriend) redirect("/?tab=upcoming&cardError=friend-unavailable");

    const recipientPublicId = await createBirthdayCard({
      senderId: currentSession.user.id,
      senderName: currentSession.user.name || "LINEユーザー",
      receiverPublicId,
      message,
      isPrivate: visibility === "private",
      designId,
    });
    if (!recipientPublicId) redirect("/?tab=upcoming&cardError=friend-unavailable");

    redirect(`/?tab=upcoming&postedTo=${recipientPublicId}`);
  }

  return (
    <main className="min-h-screen px-4 py-6 text-[#263c36] sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          className="inline-flex min-h-10 items-center rounded-full bg-white/80 px-4 text-sm font-semibold text-[var(--accent)] shadow-[var(--soft-shadow)] transition hover:-translate-x-0.5"
          href="/?tab=upcoming"
        >
          ＜ 戻る
        </Link>
        <header className="my-7">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Birthday Card
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            {friend.name}さんへ贈るカード
          </h1>
          <p className="mt-2 text-sm text-[#56645e]">
            デザインを選んで、気持ちをメッセージに込めましょう。
          </p>
        </header>
        <BirthdayCardForm
          action={createCardAction}
          friend={friend}
          databaseConfigured={databaseConfigured}
          error={typeof params.error === "string" ? params.error : null}
        />
      </div>
    </main>
  );
}
