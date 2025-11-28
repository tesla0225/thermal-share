"use client";

import { useEffect, useMemo, useState } from "react";
import { RecordButton } from "@/components/record-button";
import { Timeline } from "@/components/timeline";
import { GeneratedItem } from "@/lib/types";
import { isMediaRecorderAvailable, useAudioRecorder } from "@/lib/use-audio-recorder";

export default function Home() {
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMediaSupported, setIsMediaSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const { startRecording, stopRecording } = useAudioRecorder();

  useEffect(() => {
    fetch("/api/items")
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch((error) => {
        console.error("Failed to fetch items", error);
      });

    setIsMediaSupported(isMediaRecorderAvailable());
  }, []);

  const handleStartRecording = async () => {
    setStatus(null);
    setIsRecording(true);
    try {
      await startRecording();
    } catch (error) {
      setIsRecording(false);
      console.error(error);
      setStatus("マイクの利用に失敗しました。権限を確認してください。");
    }
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);
    setStatus("音声を解析しています...");

    try {
      const blob = await stopRecording();
      if (!blob || blob.size === 0) {
        setStatus("録音データが取得できませんでした。");
        return;
      }

      const formData = new FormData();
      formData.append("audio", blob, "input.webm");

      const res = await fetch("/api/items", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "アップロードに失敗しました");
      }

      const newItem = (await res.json()) as GeneratedItem;
      setItems((prev) => [newItem, ...prev]);
      setStatus("カードが追加されました！");
    } catch (error) {
      console.error("Failed to upload audio", error);
      setStatus(
        error instanceof Error
          ? error.message
          : "音声の処理に失敗しました。もう一度お試しください。"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const recordingHint = useMemo(() => {
    if (isMediaSupported === false) {
      return "このブラウザは録音に対応していません";
    }
    if (isRecording) {
      return "1〜3秒で「寒い」「暑い」など一言お願いします";
    }
    if (isProcessing) {
      return "Gemini が解析・生成しています...";
    }
    return "録音許可を有効にして、今の体感温度を話しかけてください";
  }, [isRecording, isProcessing, isMediaSupported]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16 pt-12 md:px-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Feeling Timeline
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              今の「暑い / 寒い」を、カードにする。
            </h1>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              Gemini 2.5 Flash + Image + TTS
            </span>
          </div>
          <p className="text-sm text-slate-400">
            マイクで一言しゃべると、体感温度を解析して画像と音声付きカードを生成します。
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_25px_120px_-80px_rgba(59,130,246,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold text-white">音声を送信</p>
              <p className="text-sm text-slate-300">{recordingHint}</p>
              {status && <p className="text-xs text-amber-200">{status}</p>}
            </div>
            <div className="w-full md:w-72">
              <RecordButton
                isProcessing={isProcessing}
                isRecording={isRecording}
                onStart={handleStartRecording}
                onStop={handleStopRecording}
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-white">タイムライン</p>
            <span className="text-xs text-slate-400">
              最新 {items.length} 件を表示
            </span>
          </div>
          <Timeline items={items} />
        </section>
      </div>
    </div>
  );
}
