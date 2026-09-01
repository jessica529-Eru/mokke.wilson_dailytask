"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const isPushSupported =
  typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" && "PushManager" in window;

export function PushNotificationToggle({ roomId }: { roomId: number }) {
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported) return;

    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setSubscribed(!!sub);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe() {
    setError(null);
    // NEXT_PUBLIC_VAPID_PUBLIC_KEY is inlined at build time — if the
    // deploy's build step didn't have it set, this is empty for every
    // visitor until the app is rebuilt, not something a user can retry
    // their way out of. Say so instead of quietly doing nothing.
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("推播功能尚未設定完成（缺少金鑰），請聯絡管理員");
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(permission === "denied" ? "瀏覽器通知權限被拒絕，請至瀏覽器設定開啟後再試一次" : "尚未允許通知權限");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();

      const res = await fetch(`/api/rooms/${roomId}/push-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) {
        throw new Error("save subscription failed");
      }
      setSubscribed(true);
    } catch {
      setError("啟用推播失敗，請稍後再試一次");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/rooms/${roomId}/push-subscription`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("關閉推播失敗，請稍後再試一次");
    } finally {
      setBusy(false);
    }
  }

  if (!isPushSupported) return null;

  return (
    <div className="relative">
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={busy}
        className="text-xs text-slate-500 hover:text-slate-900 disabled:opacity-50"
      >
        {subscribed ? "🔔 推播已啟用" : "🔕 啟用推播通知"}
      </button>
      {error && (
        <p className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-red-200 bg-white p-2 text-xs text-red-600 shadow-sm">
          {error}
        </p>
      )}
    </div>
  );
}
