"use client";

import { GeneratedItem } from "@/lib/types";
import { FeelingCard } from "./feeling-card";

interface Props {
  items: GeneratedItem[];
}

export function Timeline({ items }: Props) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/30 bg-white/30 px-6 py-10 text-center text-slate-600">
        <span className="text-4xl">🌡️</span>
        <p className="text-sm font-semibold text-slate-700">
          まだ投稿がありません
        </p>
        <p className="text-xs text-slate-500">
          「録音をはじめる」から最初のひとことを残してみてください。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <FeelingCard key={item.id} item={item} />
      ))}
    </div>
  );
}
