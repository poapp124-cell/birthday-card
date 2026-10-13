"use client";

import { useState } from "react";

export default function ShareTimelineLink({ publicId, label = "バースデーカードURL" }) {
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/timeline/${publicId}`;
    setShareUrl(url);
    setCopyFailed(false);

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-[#c7d5cb] bg-white p-4 text-left">
      <p className="font-semibold text-[#263c36]">{label}</p>
      <input
        className="min-h-10 w-full rounded-md border border-[#d9dfd8] bg-[#fffdf8] px-3 text-sm text-[#263c36]"
        aria-label={label}
        readOnly
        value={shareUrl || `/timeline/${publicId}`}
        onFocus={(event) => event.currentTarget.select()}
      />
      <button
        className="min-h-10 rounded-md bg-[#263c36] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#38584e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f3a]"
        type="button"
        onClick={copyLink}
      >
        {copied ? "コピーしました" : "URLをコピー"}
      </button>
      {copyFailed && (
        <p className="text-sm text-red-700" role="alert">
          コピーできませんでした。URLを選択してコピーしてください。
        </p>
      )}
    </div>
  );
}
