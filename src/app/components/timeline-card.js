"use client";

import { useEffect, useRef, useState } from "react";

export default function TimelineCard({ card, design, isOwner }) {
  const messageRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showFullMessage, setShowFullMessage] = useState(false);
  const [likeCount, setLikeCount] = useState(card.likeCount || 0);
  const [liked, setLiked] = useState(Boolean(card.viewerLiked));
  const [reactionError, setReactionError] = useState("");
  const [reactionPending, setReactionPending] = useState(false);

  useEffect(() => {
    const messageElement = messageRef.current;
    if (!messageElement) return;

    const updateTruncation = () => {
      setIsTruncated(
        messageElement.scrollHeight > messageElement.clientHeight + 1,
      );
    };
    updateTruncation();

    const observer = new ResizeObserver(updateTruncation);
    observer.observe(messageElement);
    return () => observer.disconnect();
  }, [card.message]);

  async function toggleLike() {
    if (reactionPending) return;
    setReactionPending(true);
    setReactionError("");

    try {
      const response = await fetch("/api/cards/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, liked: !liked }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error === "card_not_available"
            ? "このカードにはリアクションできません。"
            : "いいねを保存できませんでした。時間をおいて再度お試しください。",
        );
      }
      setLikeCount(result.likeCount);
      setLiked(result.liked);
    } catch (error) {
      setReactionError(error.message);
    } finally {
      setReactionPending(false);
    }
  }

  return (
    <>
      <article
        className="relative flex aspect-[4/3] w-full flex-col overflow-hidden rounded-[1.75rem] border-2 p-5 shadow-[var(--surface-shadow)] sm:p-7"
        style={{
          backgroundColor: design.background,
          backgroundImage: design.pattern,
          borderColor: design.border,
          borderStyle: design.borderStyle,
          color: design.text,
        }}
      >
        <p className="shrink-0 truncate text-sm font-semibold">
          {card.senderName || "LINEユーザー"}
        </p>
        <div className="flex min-h-0 flex-1 items-center justify-center py-3 text-center">
          <p
            className="line-clamp-8 w-full whitespace-pre-wrap break-words text-center text-base leading-7 sm:text-lg sm:leading-8"
            ref={messageRef}
          >
            {card.message}
          </p>
        </div>
        <div className="flex min-h-10 shrink-0 items-end justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {isOwner && card.isPrivate && (
              <span className="rounded-full bg-white/60 px-2 py-1 text-xs font-semibold">
                本人限定
              </span>
            )}
            {isOwner && card.archived && (
              <span className="rounded-full bg-white/60 px-2 py-1 text-xs">
                アーカイブ
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isTruncated && (
              <button
                className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold underline underline-offset-2"
                onClick={() => setShowFullMessage(true)}
                type="button"
              >
                もっと見る
              </button>
            )}
            <button
              aria-label={liked ? `いいねを取り消す。${likeCount}件` : `いいね。${likeCount}件`}
              aria-pressed={liked}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/75 px-3 text-sm font-semibold transition hover:scale-105 disabled:cursor-wait disabled:opacity-60"
              disabled={reactionPending}
              onClick={toggleLike}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="size-4"
                fill={liked ? "currentColor" : "none"}
                viewBox="0 0 24 24"
              >
                <path
                  d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
              <span>{likeCount}</span>
            </button>
          </div>
        </div>
      </article>
      {reactionError && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {reactionError}
        </p>
      )}
      {showFullMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowFullMessage(false);
          }}
        >
          <section
            aria-labelledby={`full-message-${card.id}`}
            aria-modal="true"
            className="w-full max-w-lg rounded-3xl border-2 p-6 shadow-2xl"
            role="dialog"
            style={{
              backgroundColor: design.background,
              backgroundImage: design.pattern,
              borderColor: design.border,
              borderStyle: design.borderStyle,
              color: design.text,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  className="truncate text-sm font-semibold"
                  id={`full-message-${card.id}`}
                >
                  {card.senderName || "LINEユーザー"}
                </h2>
              </div>
              <button
                aria-label="メッセージを閉じる"
                className="shrink-0 rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold"
                onClick={() => setShowFullMessage(false)}
                type="button"
              >
                閉じる
              </button>
            </div>
            <p className="mt-5 max-h-[65vh] overflow-y-auto whitespace-pre-wrap break-words text-center leading-8">
              {card.message}
            </p>
          </section>
        </div>
      )}
    </>
  );
}
