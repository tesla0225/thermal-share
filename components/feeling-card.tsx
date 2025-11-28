"use client";

import Image from "next/image";
import { useState } from "react";
import { GeneratedItem } from "@/lib/types";

const LABEL_INFO: Record<
  GeneratedItem["label"],
  { badge: string; labelJa: string; tone: string }
> = {
  hot: { badge: "🔥 HOT", labelJa: "暑い", tone: "text-red-500" },
  cold: { badge: "❄️ COLD", labelJa: "寒い", tone: "text-sky-500" },
  neutral: { badge: "😐 NEUTRAL", labelJa: "どちらでもない", tone: "text-slate-500" },
};

interface Props {
  item: GeneratedItem;
}

export function FeelingCard({ item }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = async () => {
    setIsPlaying(true);
    try {
      const audio = new Audio(item.audioUrl);
      await audio.play();
      audio.onended = () => setIsPlaying(false);
    } catch (error) {
      console.error("Failed to play audio", error);
      setIsPlaying(false);
    }
  };

  const labelInfo = LABEL_INFO[item.label];

  return (
    <article className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-4 rounded-2xl border border-white/10 bg-white/60 p-4 shadow-[0_20px_70px_-40px_rgba(6,24,44,0.45)] backdrop-blur-sm">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
        <Image
          src={item.imageUrl}
          alt={item.summaryJa}
          fill
          className="object-cover"
          sizes="220px"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white">
            {labelInfo.badge}
          </span>
          <span className={`text-sm font-semibold ${labelInfo.tone}`}>
            {item.summaryJa}
          </span>
          <span className="text-xs text-slate-500">
            {new Date(item.createdAt).toLocaleString("ja-JP", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <p className="text-base text-slate-800">{item.userUtteranceJa}</p>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-600">強さ</span>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-500 transition-all"
              style={{ width: `${((item.degree + 1) / 2) * 100}%` }}
            />
          </div>
          <span className="w-12 text-right font-mono text-xs text-slate-600">
            {item.degree.toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={playAudio}
          disabled={isPlaying}
          className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {isPlaying ? "再生中..." : "▶︎ 再生"}
        </button>
      </div>
    </article>
  );
}
