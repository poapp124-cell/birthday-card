"use client";

import { useEffect, useRef, useState } from "react";

export default function TimelineCard({ card, design, isOwner }) {
  const messageRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showFullMessage, setShowFullMessage] = useState(false);

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

  return (
    <>
      <article
        className="relative flex aspect-[3/4] w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] border-2 p-5 shadow-[var(--surface-shadow)] sm:p-7"
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
        <div className="flex min-h-8 shrink-0 items-end justify-between gap-2">
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
          {isTruncated && (
            <button
              className="shrink-0 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold underline underline-offset-2"
              onClick={() => setShowFullMessage(true)}
              type="button"
            >
              もっと見る
            </button>
          )}
        </div>
      </article>
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
