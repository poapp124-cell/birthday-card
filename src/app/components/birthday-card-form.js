"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cardDesigns } from "@/lib/card-designs";

function BirthdayCardFields({ disabled, idPrefix }) {
  const [designId, setDesignId] = useState(cardDesigns[0].id);
  const [message, setMessage] = useState("");
  const messageInputRef = useRef(null);
  const selectedDesign =
    cardDesigns.find((design) => design.id === designId) || cardDesigns[0];

  useLayoutEffect(() => {
    const textarea = messageInputRef.current;
    if (!textarea) return;

    const mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    Object.assign(mirror.style, {
      position: "fixed",
      top: "0",
      left: "-10000px",
      visibility: "hidden",
      whiteSpace: "pre-wrap",
      overflowWrap: "break-word",
      wordBreak: getComputedStyle(textarea).wordBreak,
      boxSizing: "content-box",
      padding: "0",
      border: "0",
      height: "auto",
    });
    document.body.appendChild(mirror);

    const updateVerticalAlignment = () => {
      const computedStyle = getComputedStyle(textarea);
      const borderWidth =
        parseFloat(computedStyle.borderTopWidth) +
        parseFloat(computedStyle.borderBottomWidth);
      const horizontalPadding =
        parseFloat(computedStyle.paddingLeft) +
        parseFloat(computedStyle.paddingRight);
      const contentWidth = textarea.clientWidth - horizontalPadding;

      Object.assign(mirror.style, {
        width: `${Math.max(0, contentWidth)}px`,
        font: computedStyle.font,
        letterSpacing: computedStyle.letterSpacing,
        lineHeight: computedStyle.lineHeight,
        textIndent: computedStyle.textIndent,
        textTransform: computedStyle.textTransform,
      });
      mirror.textContent = message || textarea.placeholder || "\u00a0";

      const textHeight = mirror.getBoundingClientRect().height;
      const contentHeight = textarea.clientHeight - borderWidth;
      const verticalPadding = Math.max(0, (contentHeight - textHeight) / 2);
      textarea.style.paddingTop = `${verticalPadding}px`;
      textarea.style.paddingBottom = `${verticalPadding}px`;
    };

    updateVerticalAlignment();
    const observer = new ResizeObserver(updateVerticalAlignment);
    observer.observe(textarea);

    return () => {
      observer.disconnect();
      mirror.remove();
    };
  }, [message]);

  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">カードのデザイン</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cardDesigns.map((design) => (
            <label className="cursor-pointer" key={design.id}>
              <input
                className="peer sr-only"
                type="radio"
                name="designId"
                value={design.id}
                checked={designId === design.id}
                onChange={() => setDesignId(design.id)}
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
          className="card-message-editor block aspect-[4/3] w-full resize-none rounded-[1.75rem] border-2 text-center text-base leading-7 break-words outline-none placeholder:text-center placeholder:opacity-60 focus:ring-2 focus:ring-[#087f3a]/20 disabled:opacity-70 sm:text-lg sm:leading-8"
          id={`${idPrefix}-message`}
          name="message"
          maxLength={1000}
          value={message}
          ref={messageInputRef}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="ここにメッセージを入力"
          style={{
            backgroundColor: selectedDesign.background,
            backgroundImage: selectedDesign.pattern,
            borderColor: selectedDesign.border,
            borderStyle: selectedDesign.borderStyle,
            color: selectedDesign.text,
          }}
          required
          disabled={disabled}
        />
        <p className="mt-1 text-right text-xs text-[#766c65]" aria-live="polite">
          {message.length}/1000文字
        </p>
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

export default function BirthdayCardForm({
  friend,
  action,
  databaseConfigured,
  error,
}) {
  return (
    <form
      action={action}
      className="mt-5 space-y-5 rounded-3xl bg-white/90 p-5 shadow-[var(--surface-shadow)] sm:p-7"
    >
      <input type="hidden" name="receiverPublicId" value={friend.publicId} />
      <BirthdayCardFields
        disabled={!databaseConfigured}
        idPrefix={`new-card-${friend.publicId}`}
      />
      {(error === "invalid-input" || error === "invalid-design") && (
        <p className="text-sm text-red-700" role="alert">
          メッセージは1〜1000文字で入力し、カードのデザインと公開範囲を確認してください。
        </p>
      )}
      {error === "friend-unavailable" && (
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
        className="min-h-12 w-full rounded-2xl bg-[#ba694f] px-5 py-2 font-semibold text-white transition-colors hover:bg-[#9e543d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a] disabled:cursor-not-allowed disabled:opacity-50"
        type="submit"
        disabled={!databaseConfigured}
      >
        バースデーカードを送る
      </button>
    </form>
  );
}
