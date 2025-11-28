interface Props {
  isRecording: boolean;
  isProcessing: boolean;
  onStart: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
}

export function RecordButton({
  isRecording,
  isProcessing,
  onStart,
  onStop,
}: Props) {
  const baseClass =
    "w-full rounded-xl px-6 py-4 text-lg font-semibold shadow-lg transition-all duration-300 flex items-center justify-center gap-3";

  if (isRecording) {
    return (
      <button
        type="button"
        onClick={onStop}
        className={`${baseClass} bg-gradient-to-r from-rose-500 to-orange-500 text-white animate-pulse`}
      >
        <span className="text-2xl">●</span>
        <span>録音中... 停止する</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onStart}
      disabled={isProcessing}
      className={`${baseClass} bg-gradient-to-r from-sky-500 to-cyan-400 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      <span className="text-2xl">🎤</span>
      <span>{isProcessing ? "処理中..." : "録音をはじめる"}</span>
    </button>
  );
}
