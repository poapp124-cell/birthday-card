"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import ShareTimelineLink from "@/app/components/share-timeline-link";

const tabs = [
  { id: "upcoming", label: "誕生日が近い友達" },
  { id: "friends", label: "友達一覧" },
];

function FriendAvatar({ friend, size = 48 }) {
  const sizeClass = size === 48 ? "size-12" : "size-14";

  if (friend.profileImage) {
    return (
      <Image
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        src={friend.profileImage}
        alt=""
        width={size}
        height={size}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-[#dce8df] font-semibold text-[#263c36]`}
      aria-hidden="true"
    >
      {friend.name.slice(0, 1)}
    </div>
  );
}

function birthdayLabel(birthday) {
  if (!birthday) return "誕生日未登録";
  const [month, day] = birthday.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export default function HomeTabs({
  friends,
  initialTab = "upcoming",
  postedTo,
}) {
  const validInitialTab = tabs.some((tab) => tab.id === initialTab)
    ? initialTab
    : "upcoming";
  const [activeTab, setActiveTab] = useState(validInitialTab);
  const upcomingFriends = useMemo(
    () =>
      friends
        .filter((friend) => friend.daysUntilBirthday !== null && friend.daysUntilBirthday <= 30)
        .sort((left, right) => left.daysUntilBirthday - right.daysUntilBirthday),
    [friends],
  );
  return (
    <section className="mt-8">
      {postedTo && (
        <div className="mb-6">
          <p className="mb-3 text-sm font-semibold text-[#087f3a]" role="status">
            カードを投稿しました。相手のバースデーカードページを確認できます。
          </p>
          <ShareTimelineLink
            publicId={postedTo}
            label="相手のバースデーカードURL"
          />
        </div>
      )}

      <div
        className="flex border-b border-[#c9d4cc]"
        role="tablist"
        aria-label="ホームの表示"
      >
        {tabs.map((tab) => (
          <button
            className={`min-h-12 min-w-0 flex-1 border-b-2 px-1 text-xs font-semibold transition-colors sm:text-sm ${
              activeTab === tab.id
                ? "border-[#087f3a] text-[#087f3a]"
                : "border-transparent text-[#56645e] hover:text-[#263c36]"
            }`}
            id={`tab-${tab.id}`}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="py-6"
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === "upcoming" && (
          <div>
            {upcomingFriends.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#56645e]">
                30日以内に誕生日を迎える友達はいません。
              </p>
            ) : (
              <ul className="divide-y divide-[#e5e9e3]">
                {upcomingFriends.map((friend) => (
                  <li
                    className={`py-3 ${friend.daysUntilBirthday === 0 ? "rounded-md bg-[#fff0e7] p-3 ring-1 ring-[#e9b49a]" : ""}`}
                    key={friend.publicId}
                  >
                    <div className="flex items-center gap-3 rounded-md border border-[#d9dfd8] bg-white p-3">
                      <FriendAvatar friend={friend} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold">{friend.name}</p>
                          {friend.daysUntilBirthday === 0 && (
                            <span className="rounded-full bg-[#ba694f] px-2 py-0.5 text-xs font-bold text-white">
                              今日が誕生日
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-[#56645e]">
                          {birthdayLabel(friend.birthday)}
                          <span className="mx-2 text-[#b9c8bf]">·</span>
                          {friend.daysUntilBirthday === 0
                            ? "今日"
                            : `あと${friend.daysUntilBirthday}日`}
                        </p>
                      </div>
                      {friend.daysUntilBirthday <= 1 && (
                        <Link
                          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] px-3 text-xs font-bold text-[var(--accent)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                          href={`/cards/new?friendId=${encodeURIComponent(friend.publicId)}`}
                        >
                          カードを書く
                        </Link>
                      )}
                    </div>
                    {friend.daysUntilBirthday > 1 && (
                      <Link
                        className="mt-2 flex min-h-10 items-center justify-center rounded-md bg-[#ba694f] px-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#9e543d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                        href={`/timeline/${friend.publicId}`}
                      >
                        バースデーカードを見る / 書く
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "friends" && (
          <div>
            {friends.length === 0 ? (
              <div className="py-10 text-center">
                <p className="mb-4 text-sm text-[#56645e]">フレンドはまだいません。</p>
                <Link
                  className="inline-flex min-h-10 items-center rounded-md border border-[#b9c8bf] px-4 text-sm font-semibold text-[#263c36] hover:bg-[#edf2ed]"
                  href="/friends"
                >
                  フレンドを探す
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-[#e5e9e3]">
                {friends.map((friend) => (
                  <li
                    className="flex flex-wrap items-center gap-4 py-4"
                    key={friend.publicId}
                  >
                    <FriendAvatar friend={friend} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{friend.name}</p>
                      <p className="mt-1 text-sm text-[#56645e]">
                        @{friend.customId || "ID未登録"}
                        <span className="mx-2 text-[#b9c8bf]">·</span>
                        {birthdayLabel(friend.birthday)}
                      </p>
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
          </div>
        )}
      </div>
    </section>
  );
}
