"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Prefs = {
  pushEnabled: boolean;
  emailEnabled: boolean;
  ritualReminders: boolean;
  eventReminders: boolean;
  rewardAlerts: boolean;
};

export function NotifyPrefsForm({ initial }: { initial: Prefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const res = await fetch("/api/notifications/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });
    if (!res.ok) {
      setMsg("Save failed");
      return;
    }
    setMsg("Saved");
    router.refresh();
  }

  const rows: { key: keyof Prefs; label: string }[] = [
    { key: "pushEnabled", label: "Push (mock)" },
    { key: "emailEnabled", label: "Email (mock)" },
    { key: "ritualReminders", label: "Ritual reminders" },
    { key: "eventReminders", label: "Event reminders" },
    { key: "rewardAlerts", label: "Reward alerts" },
  ];

  return (
    <div className="mt-8">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => toggle(r.key)}
          className="flex w-full items-center justify-between border-t border-[var(--cult-line)] py-4 text-left transition hover:bg-[rgba(245,245,242,0.03)]"
        >
          <span className="font-light text-white">{r.label}</span>
          <span
            className={`text-[0.62rem] uppercase tracking-[0.18em] ${
              prefs[r.key] ? "text-white" : "text-warm-grey"
            }`}
          >
            {prefs[r.key] ? "On" : "Off"}
          </span>
        </button>
      ))}
      {msg && (
        <p className="mt-3 text-[0.55rem] uppercase tracking-[0.16em] text-warm-grey">
          {msg}
        </p>
      )}
    </div>
  );
}
