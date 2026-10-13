"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import ShareTimelineLink from "@/app/components/share-timeline-link";
import { cardDesigns } from "@/lib/card-designs";

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

function BirthdayCardFields({ disabled, idPrefix }) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">カードのデザイン</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cardDesigns.map((design, index) => (
            <label className="cursor-pointer" key={design.id}>
              <input
                className="peer sr-only"
                type="radio"
                name="designId"
                value={design.id}
                defaultChecked={index === 0}
                disabled={disabled}
              />
              <span
                className="block rounded-md border-2 p-1 transition peer-checked:ring-2 peer-checked:ring-[#087f3a] peer-checked:ring-offset-1 peer-focus-visible:outline-2 peer-focus-visible:outline-[#087f3a]"
                style={{
                  backgroundColor: design.background,
                  backgroundImage: design.pattern,
                  borderColor: design.border,
                  borderStyle: design.borderStyle,
                  color: design.text,
                }}
              >
                <span className="block min-h-12 rounded-sm border border-current/30 p-2 text-center text-xs font-semibold">
                  {design.name}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label
          className="mb-2 block text-sm font-semibold"
          htmlFor={`${idPrefix}-message`}
        >
          メッセージ
        </label>
        <textarea
          className="min-h-32 w-full resize-y rounded-md border border-[#b9c8bf] bg-white px-3 py-2 text-base leading-7 outline-none focus:border-[#087f3a] focus:ring-2 focus:ring-[#087f3a]/20 disabled:bg-[#edf2ed]"
          id={`${idPrefix}-message`}
          name="message"
          maxLength={2000}
          required
          disabled={disabled}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">公開範囲</legend>
        <label className="flex min-h-10 items-center gap-3 text-sm">
          <input
            className="size-4 accent-[#087f3a]"
            type="radio"
            name="visibility"
            value="public"
            defaultChecked
            disabled={disabled}
          />
          全体公開（友達のバースデーカードに表示）
        </label>
        <label className="flex min-h-10 items-center gap-3 text-sm">
          <input
            className="size-4 accent-[#087f3a]"
            type="radio"
            name="visibility"
            value="private"
            disabled={disabled}
          />
          本人限定（誕生日の本人のみ閲覧）
        </label>
      </fieldset>
    </>
  );
}

function InlineBirthdayCardForm({
  friend,
  createCardAction,
  databaseConfigured,
  cardError,
}) {
  return (
    <form
      action={createCardAction}
      className="mt-3 space-y-4 rounded-md border border-[#eadfc9] bg-[#fffdf8] p-4"
    >
      <input type="hidden" name="receiverPublicId" value={friend.publicId} />
      <input type="hidden" name="inlineCompose" value={friend.publicId} />
      <p className="text-sm font-semibold">{friend.name}さんへ贈るカード</p>
      <BirthdayCardFields
        disabled={!databaseConfigured}
        idPrefix={`inline-card-${friend.publicId}`}
      />
      {(cardError === "invalid-input" || cardError === "invalid-design") && (
        <p className="text-sm text-red-700" role="alert">
          メッセージまたはカードのデザインを確認してください。
        </p>
      )}
      {cardError === "friend-unavailable" && (
        <p className="text-sm text-red-700" role="alert">
          選択した友達との関係を確認できませんでした。
        </p>
      )}
      {!databaseConfigured && (
        <p className="text-sm text-[#8a4b22]" role="status">
          カードを保存するにはNeonデータベースの設定が必要です。
        </p>
      )}
      <button
        className="min-h-11 w-full rounded-md bg-[#ba694f] px-5 py-2 font-semibold text-white transition-colors hover:bg-[#9e543d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a] disabled:cursor-not-allowed disabled:opacity-50"
        type="submit"
        disabled={!databaseConfigured}
      >
        バースデーカードを送る
      </button>
    </form>
  );
}

export default function HomeTabs({
  friends,
  createCardAction,
  initialTab = "upcoming",
  postedTo,
  cardError,
  databaseConfigured,
  inlineComposeFriendId,
}) {
  const validInitialTab = tabs.some((tab) => tab.id === initialTab)
    ? initialTab
    : "upcoming";
  const [activeTab, setActiveTab] = useState(validInitialTab);
  const [inlineFriendId, setInlineFriendId] = useState(inlineComposeFriendId);
  const upcomingFriends = useMemo(
    () =>
      friends
        .filter((friend) => friend.daysUntilBirthday !== null && friend.daysUntilBirthday <= 30)
        .sort((left, right) => left.daysUntilBirthday - right.daysUntilBirthday),
    [friends],
  );
  function toggleInlineComposer(friend) {
    setInlineFriendId((currentId) =>
      currentId === friend.publicId ? null : friend.publicId,
    );
  }

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
                    </div>
                    {friend.daysUntilBirthday <= 1 ? (
                      <>
                        <button
                          className="mt-2 flex min-h-10 w-full items-center justify-center rounded-md bg-[#087f3a] px-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#06682f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
                          type="button"
                          aria-expanded={inlineFriendId === friend.publicId}
                          aria-controls={`inline-compose-${friend.publicId}`}
                          onClick={() => toggleInlineComposer(friend)}
                        >
                          {friend.daysUntilBirthday === 1
                            ? "バースデーカードを作成"
                            : "今日のカードを書く"}
                        </button>
                        {inlineFriendId === friend.publicId && (
                          <div id={`inline-compose-${friend.publicId}`}>
                            <InlineBirthdayCardForm
                              friend={friend}
                              createCardAction={createCardAction}
                              databaseConfigured={databaseConfigured}
                              cardError={cardError}
                            />
                          </div>
                        )}
                      </>
                    ) : (
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
