"use client";

import { useState } from "react";

export default function CopyCustomId({ customId }) {
  const [feedback, setFeedback] = useState("");

  async function copyId() {
    try {
      await navigator.clipboard.writeText(customId);
      setFeedback("コピーしました");
    } catch (error) {
      console.error("My IDをクリップボードにコピーできませんでした。", error);
      setFeedback("コピーできませんでした");
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <p className="min-w-0 break-all text-right text-sm text-[#56645e]">
        @{customId}
      </p>
      <button
        aria-label="My IDをコピー"
        className="min-h-9 shrink-0 rounded-full bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent)]"
        onClick={copyId}
        type="button"
      >
        コピー
      </button>
      <span
        aria-live="polite"
        className={`text-xs ${feedback === "コピーできませんでした" ? "text-red-700" : "text-[var(--accent)]"}`}
        role={feedback === "コピーできませんでした" ? "alert" : "status"}
      >
        {feedback}
      </span>
    </div>
  );
}
