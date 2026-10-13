"use client";

import { useAppearance } from "./appearance-provider";

const themeOptions = [
  { id: "sakura", name: "サクラ", color: "#d9859b" },
  { id: "mint", name: "ミント", color: "#58a88c" },
  { id: "sky", name: "スカイ", color: "#5b9fca" },
  { id: "yellow", name: "イエロー", color: "#c99a35" },
  { id: "lavender", name: "ラベンダー", color: "#947ac2" },
];

const fontOptions = [
  { id: "system", name: "端末（スマホ）の設定に合わせる" },
  { id: "smallest", name: "かなり小さめ" },
  { id: "small", name: "小さめ" },
  { id: "standard", name: "標準" },
  { id: "large", name: "大きめ" },
  { id: "largest", name: "かなり大きめ" },
];

export default function AppearanceSettings() {
  const { theme, fontSize, setTheme, setFontSize } = useAppearance();

  return (
    <section
      aria-labelledby="appearance-heading"
      className="mt-6 rounded-3xl bg-white/80 p-5 shadow-[var(--surface-shadow)]"
    >
      <h2 className="text-lg font-bold" id="appearance-heading">
        表示設定
      </h2>
      <fieldset className="mt-5">
        <legend className="font-semibold">アプリのカラーテーマ</legend>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {themeOptions.map((option) => (
            <button
              aria-pressed={theme === option.id}
              className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl p-2 text-xs font-semibold transition ${
                theme === option.id
                  ? "ring-2 ring-offset-2 ring-[var(--accent)]"
                  : "hover:-translate-y-0.5"
              }`}
              key={option.id}
              onClick={() => setTheme(option.id)}
              style={{ backgroundColor: `${option.color}20` }}
              type="button"
            >
              <span
                aria-hidden="true"
                className="size-7 rounded-full shadow-sm"
                style={{ backgroundColor: option.color }}
              />
              {option.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="font-semibold">文字サイズ</legend>
        <div className="mt-2 space-y-1">
          {fontOptions.map((option) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 hover:bg-[var(--accent-soft)]"
              key={option.id}
            >
              <input
                checked={fontSize === option.id}
                className="accent-[var(--accent)]"
                name="font-size"
                onChange={() => setFontSize(option.id)}
                type="radio"
                value={option.id}
              />
              <span>{option.name}</span>
              {option.id === "system" && (
                <span className="ml-auto text-xs text-[#766c65]">初期設定</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>
      <p aria-live="polite" className="mt-3 text-sm text-[#766c65]">
        選択内容はこの端末に保存され、すぐに画面へ反映されます。
      </p>
    </section>
  );
}
