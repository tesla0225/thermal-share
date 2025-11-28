import { useRef } from "react";

export function isMediaRecorderAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof MediaRecorder !== "undefined"
  );
}

export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (!isMediaRecorderAvailable()) {
      throw new Error("MediaRecorder is not supported in this browser");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start();
  };

  const stopRecording = (): Promise<Blob> =>
    new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) {
        resolve(new Blob());
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        resolve(blob);
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.stop();
    });

  return { startRecording, stopRecording };
}
