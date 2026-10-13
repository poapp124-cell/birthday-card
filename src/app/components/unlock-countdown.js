"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UnlockCountdown({ unlockAt }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Date.parse(unlockAt) - Date.now()),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const nextRemaining = Math.max(0, Date.parse(unlockAt) - Date.now());
      setRemaining(nextRemaining);

      if (nextRemaining === 0) {
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [router, unlockAt]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <p className="mt-4 text-lg font-semibold tabular-nums text-[#087f3a]" aria-live="off">
      {days > 0 ? `${days}日 ` : ""}
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}
      :{String(seconds).padStart(2, "0")}
    </p>
  );
}
