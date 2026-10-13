"use client";

import { useEffect, useState } from "react";

const customIdPattern = /^[a-z0-9_]{3,20}$/;

export default function CustomIdField({ defaultValue = "" }) {
  const [value, setValue] = useState(defaultValue);
  const [availability, setAvailability] = useState("idle");

  useEffect(() => {
    const customId = value.trim().toLowerCase();
    if (!customId || !customIdPattern.test(customId)) return;
    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      setAvailability("checking");
      try {
        const response = await fetch(
          `/api/profile/custom-id?customId=${encodeURIComponent(customId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) {
          setAvailability("error");
          return;
        }

        const result = await response.json();
        setAvailability(result.available ? "available" : "taken");
      } catch {
        if (controller.signal.aborted) return;
        setAvailability("error");
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [value]);

  function handleChange(event) {
    setValue(event.target.value.toLowerCase());
    setAvailability("idle");
  }

  const invalid = value !== "" && !customIdPattern.test(value);

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold" htmlFor="customId">
        My ID
      </label>
      <div className="flex min-h-11 items-center rounded-md border border-[#b9c8bf] bg-white px-3 focus-within:border-[#087f3a] focus-within:ring-2 focus-within:ring-[#087f3a]/20">
        <span className="mr-1 text-[#56645e]">@</span>
        <input
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
          id="customId"
          name="customId"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          minLength={3}
          maxLength={20}
          pattern="[a-z0-9_]{3,20}"
          value={value}
          onChange={handleChange}
          aria-describedby="custom-id-help custom-id-status"
          aria-invalid={invalid || availability === "taken"}
        />
      </div>
      <p id="custom-id-help" className="mt-1 text-xs text-[#56645e]">
        小文字英数字と _ を使って3〜20文字で設定します。
      </p>
      <p id="custom-id-status" className="mt-1 min-h-5 text-sm" role="status">
        {invalid && "3〜20文字の小文字英数字または _ を入力してください。"}
        {!invalid && availability === "checking" && "使用できるか確認中..."}
        {!invalid && availability === "available" && "このIDは使用できます。"}
        {!invalid && availability === "taken" && "このIDは既に使用されています。"}
        {!invalid && availability === "error" && "IDを確認できません。保存時にもう一度確認します。"}
      </p>
    </div>
  );
}
