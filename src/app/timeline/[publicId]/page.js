import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import UnlockCountdown from "@/app/components/unlock-countdown";
import TimelineCard from "@/app/components/timeline-card";
import { getCardDesign } from "@/lib/card-designs";
import { getBirthdayTimeline, getDaysUntilBirthday } from "@/lib/birthday-cards";

export default function TimelinePage({ params }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fffaf0] px-6 py-16 text-[#263c36]">
          <p role="status">タイムラインを読み込んでいます...</p>
        </main>
      }
    >
      <Timeline params={params} />
    </Suspense>
  );
}

async function Timeline({ params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { publicId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(publicId)) {
    notFound();
  }

  const timeline = await getBirthdayTimeline(session.user.id, publicId);
  if (!timeline) notFound();

  const { profile, isOwner, cards, pendingCount, nextUnlockAt } = timeline;
  const birthdayParts = profile.birthday?.split("-").map(Number);
  const daysUntilBirthday = getDaysUntilBirthday(profile.birthday);

  return (
    <main className="min-h-screen bg-[#fffaf0] px-5 py-10 text-[#263c36] sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          className="text-sm font-semibold text-[#087f3a] underline underline-offset-4"
          href="/"
        >
          ホームへ戻る
        </Link>
        <header className="my-8 flex items-center gap-4 border-b border-[#d9dfd8] pb-6">
          {profile.profileImage ? (
            <Image
              className="size-16 rounded-full object-cover"
              src={profile.profileImage}
              alt=""
              width={64}
              height={64}
              unoptimized
            />
          ) : (
            <div
              className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#dce8df] text-2xl font-semibold"
              aria-hidden="true"
            >
              {profile.name.slice(0, 1)}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#ba694f]">
              Birthday Card
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {isOwner ? "バースデーカード" : `${profile.name}さんのバースデーカード`}
            </h1>
            {birthdayParts && (
              <p className="mt-1 text-sm text-[#56645e]">
                誕生日: {birthdayParts[0]}月{birthdayParts[1]}日
              </p>
            )}
          </div>
        </header>

        {isOwner && daysUntilBirthday === 0 && (
          <Link
            className="mb-6 flex min-h-12 items-center justify-center rounded-md bg-[#ba694f] px-4 text-center font-bold text-white shadow-sm transition-colors hover:bg-[#9e543d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
            href="#birthday-cards"
          >
            届いたカードを開く
          </Link>
        )}

        {isOwner && daysUntilBirthday > 0 && birthdayParts && (
          <section className="mb-6 rounded-md border border-[#eadfc9] bg-white p-5 text-center">
            <p className="font-semibold text-[#85432e]">
              {birthdayParts[0]}月{birthdayParts[1]}日（誕生日）に開きます
            </p>
            {pendingCount > 0 && nextUnlockAt && (
              <>
                <p className="mt-2 text-sm text-[#56645e]">
                  {pendingCount}件のカードが誕生日当日の0:00（日本時間）に公開されます。
                </p>
                <UnlockCountdown unlockAt={nextUnlockAt} />
              </>
            )}
          </section>
        )}

        {pendingCount > 0 && nextUnlockAt && !isOwner && (
          <section className="mb-6 rounded-md border border-[#d7e2d7] bg-white p-5 text-center">
            <p className="font-semibold">
              {pendingCount}件のカードが誕生日に届きます
            </p>
            <p className="mt-2 text-sm text-[#56645e]">
              誕生日当日の0:00（日本時間）に公開されます。
            </p>
            <UnlockCountdown unlockAt={nextUnlockAt} />
          </section>
        )}

        {cards.length > 0 ? (
          <section
            id="birthday-cards"
            aria-label="バースデーカード一覧"
            className="relative space-y-5 pl-7 before:absolute before:bottom-5 before:left-2 before:top-5 before:w-px before:bg-[#d8c6a8]"
          >
            {cards.map((card) => {
              const design = getCardDesign(card.designId);
              return (
                <div className="relative" key={card.id}>
                  <span
                    className="absolute -left-[1.55rem] top-5 size-3 rounded-full border-2 bg-[#fffaf0]"
                    style={{ borderColor: design.border }}
                    aria-hidden="true"
                  />
                  <TimelineCard card={card} design={design} isOwner={isOwner} />
                </div>
              );
            })}
          </section>
        ) : pendingCount === 0 ? (
          <p id="birthday-cards" className="py-12 text-center text-[#56645e]">
            {isOwner
              ? "まだ届いたカードはありません。"
              : "現在公開中のカードはありません。"}
          </p>
        ) : null}
      </div>
    </main>
  );
}
