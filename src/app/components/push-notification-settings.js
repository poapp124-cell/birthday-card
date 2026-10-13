"use client";

import { useEffect, useState } from "react";

const GUIDE_DISMISSED_KEY = "birthday-card-home-screen-guide-dismissed";

function isIPhoneSafari() {
  const userAgent = navigator.userAgent;
  const iOS =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari =
    /Safari/.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  return iOS && safari;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

async function readApiResponse(response) {
  const result = await response.json();
  if (!response.ok) {
    const messages = {
      database_not_configured: "通知設定にはNeonデータベースの設定が必要です。",
      push_not_configured: "サーバーのWeb Push設定が完了していません。",
      unauthorized: "ログイン状態を確認して、再度お試しください。",
      subscription_conflict: "この通知先は別のアカウントに登録されています。",
    };
    throw new Error(messages[result.error] || "通知設定を保存できませんでした。");
  }
  return result;
}

export default function PushNotificationSettings({ showSettings = true }) {
  const [status, setStatus] = useState(null);
  const [permission, setPermission] = useState("unsupported");
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (
      isIPhoneSafari() &&
      !isStandalone()
    ) {
      try {
        if (!localStorage.getItem(GUIDE_DISMISSED_KEY)) {
          const frame = window.requestAnimationFrame(() => setGuideOpen(true));
          return () => window.cancelAnimationFrame(frame);
        }
      } catch (storageError) {
        console.error("ホーム画面ガイドの状態を読み込めませんでした。", storageError);
        const frame = window.requestAnimationFrame(() => setGuideOpen(true));
        return () => window.cancelAnimationFrame(frame);
      }
    }

    if (showSettings) {
      fetch("/api/push/subscription")
        .then(readApiResponse)
        .then((pushStatus) => {
          setStatus(pushStatus);
          if ("Notification" in window) setPermission(Notification.permission);
        })
        .catch((loadError) => setError(loadError.message));
    }
  }, [showSettings]);

  function dismissGuide() {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_DISMISSED_KEY, "1");
    } catch (storageError) {
      console.error("ホーム画面ガイドの状態を保存できませんでした。", storageError);
    }
  }

  async function enableNotifications() {
    setBusy(true);
    setError("");
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("このブラウザはWeb Push通知に対応していません。");
      }
      if (!status?.ready || !status.publicKey) {
        throw new Error("サーバーのWeb Push設定が完了していません。");
      }
      if (isIPhoneSafari() && !isStandalone()) {
        throw new Error("iPhoneでは、先にホーム画面へ追加してから通知を設定してください。");
      }

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        throw new Error(
          nextPermission === "denied"
            ? "通知がブロックされています。ブラウザまたは端末の設定から許可してください。"
            : "通知を許可すると、誕生日のお知らせを受け取れます。",
        );
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const readyRegistration = await navigator.serviceWorker.ready;
      const pushManager = registration.pushManager || readyRegistration.pushManager;
      if (!pushManager) {
        throw new Error("このブラウザではPush通知を利用できません。");
      }

      const subscription =
        (await pushManager.getSubscription()) ||
        (await pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.publicKey),
        }));
      await readApiResponse(
        await fetch("/api/push/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        }),
      );
      setStatus((current) => ({ ...current, subscribed: true }));
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setError("");
    try {
      await readApiResponse(
        await fetch("/api/push/subscription", { method: "DELETE" }),
      );
      const registration = await navigator.serviceWorker?.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      setStatus((current) => ({ ...current, subscribed: false }));
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setBusy(false);
    }
  }

  const permissionLabel = {
    granted: "許可済み",
    denied: "ブロック中",
    default: "未設定",
    unsupported: "非対応",
  }[permission];
  const unsupported = permission === "unsupported";

  return (
    <>
      {showSettings && <section
        aria-labelledby="push-settings-heading"
        className="mt-6 rounded-3xl bg-white/80 p-5 shadow-[var(--surface-shadow)]"
      >
        <h2 className="text-lg font-bold" id="push-settings-heading">
          通知設定
        </h2>
        <p className="mt-2 text-sm text-[#56645e]">
          誕生日が近いフレンドのお知らせを受け取ります。
        </p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">ブラウザ通知</p>
            <p className="mt-1 text-sm text-[#766c65]">
              通知の許可状態: {permissionLabel}
              {status?.subscribed ? "（通知オン）" : ""}
            </p>
          </div>
          <button
            aria-checked={Boolean(status?.subscribed)}
            aria-label="誕生日のお知らせ"
            className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors ${
              status?.subscribed ? "bg-[var(--accent)]" : "bg-[#c9c2bc]"
            }`}
            disabled={busy || !status || unsupported}
            onClick={
              status?.subscribed ? disableNotifications : enableNotifications
            }
            role="switch"
            type="button"
          >
            <span
              className={`block size-6 rounded-full bg-white shadow transition-transform ${
                status?.subscribed ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {!status?.ready && status && (
          <p className="mt-3 text-sm text-[#8a4b22]" role="status">
            サーバー側のWeb Push設定が未完了のため、通知を有効にできません。
          </p>
        )}
        {isIPhoneSafariSafe() && !isStandaloneSafe() && (
          <p className="mt-3 text-sm text-[#8a4b22]">
            iPhoneではホーム画面に追加したアプリから通知を設定できます。
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button
          className="mt-4 text-left text-sm font-semibold text-[var(--accent)] underline underline-offset-4"
          onClick={() => setGuideOpen(true)}
          type="button"
        >
          ホーム画面にアプリを追加するには？
        </button>
      </section>}

      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) dismissGuide();
          }}
        >
          <section
            aria-labelledby="home-screen-guide-title"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--accent)]">
                  iPhoneでの設定
                </p>
                <h2
                  className="mt-1 text-xl font-bold"
                  id="home-screen-guide-title"
                >
                  ホーム画面にアプリを追加
                </h2>
              </div>
              <button
                aria-label="ガイドを閉じる"
                className="min-h-10 min-w-10 rounded-full bg-[var(--accent-soft)]"
                onClick={dismissGuide}
                type="button"
              >
                閉じる
              </button>
            </div>
            <ol className="mt-5 space-y-4">
              <li className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)]">
                  1
                </span>
                <p className="pt-1 leading-6">
                  Safari画面下部（または上部）の共有ボタンをタップします。
                  <span className="ml-2 inline-flex size-8 items-center justify-center rounded-lg bg-[#f2f2f2] text-lg font-bold text-[#3478c8]">
                    ↑
                  </span>
                </p>
              </li>
              <li className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)]">
                  2
                </span>
                <p className="pt-1 leading-6">
                  メニューをスクロールし、「ホーム画面に追加」を選びます。
                </p>
              </li>
              <li className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)]">
                  3
                </span>
                <p className="pt-1 leading-6">
                  右上の「追加」をタップします。追加したアプリをホーム画面から開くと通知を設定できます。
                </p>
              </li>
            </ol>
            <button
              className="mt-6 min-h-12 w-full rounded-2xl bg-[var(--accent)] px-4 font-semibold text-white"
              onClick={dismissGuide}
              type="button"
            >
              あとで
            </button>
          </section>
        </div>
      )}
    </>
  );
}

function isIPhoneSafariSafe() {
  return typeof navigator !== "undefined" && isIPhoneSafari();
}

function isStandaloneSafe() {
  return typeof window !== "undefined" && isStandalone();
}
