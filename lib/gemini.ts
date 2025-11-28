import { GoogleGenAI, createPartFromUri, createUserContent } from "@google/genai";
import { pcmToWav } from "./audio";
import {
  FeelingAnalysis,
  FeelingAnalysisSchema,
} from "./types";
import { storeGeneratedFile } from "./storage";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY ?? "",
});

function ensureApiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }
}

export async function analyzeFeelingFromAudio(
  audio: Buffer
): Promise<FeelingAnalysis> {
  ensureApiKey();

  const arrayBuffer = Uint8Array.from(audio).buffer;
  const file = new Blob([arrayBuffer], { type: "audio/webm" });

  const uploaded = await ai.files.upload({
    file,
    config: { mimeType: "audio/webm", displayName: "input.webm" },
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: createUserContent([
      createPartFromUri(uploaded.uri!, uploaded.mimeType!),
      `ユーザーの短い一言音声から、体感温度（暑い・寒い）を推定してください。
       - label: "hot"（暑い）, "cold"（寒い）, "neutral"（どちらでもない）
       - degree: -1.0（極寒）〜 1.0（中立）〜 1.0（極暑）の数値
       - 画像生成用プロンプトは英語で、感情を視覚的に表現するものにしてください。
       - TTS用台詞は共感的で優しいトーンにしてください。`,
    ]),
    config: {
      responseMimeType: "application/json",
      responseSchema: FeelingAnalysisSchema,
    },
  });

  const parsed = JSON.parse(response.text ?? "{}");
  return FeelingAnalysisSchema.parse(parsed);
}

export async function generateImageFromFeeling(
  feeling: FeelingAnalysis,
  id: string
): Promise<{ imageUrl: string; imageData?: string }> {
  ensureApiKey();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: feeling.promptForImage,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData?.data) {
    throw new Error("画像生成に失敗しました");
  }

  const buffer = Buffer.from(part.inlineData.data, "base64");
  const imageUrl = await storeGeneratedFile(`${id}.png`, buffer, "image/png");
  return { imageUrl };
}

export async function generateTtsFromFeeling(
  feeling: FeelingAnalysis,
  id: string
): Promise<{ audioUrl: string; audioData?: string }> {
  ensureApiKey();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: `優しく共感的に言ってください: ${feeling.promptForTts}`,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Kore",
          },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error("TTS生成に失敗しました");
  }

  const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
  const wavBuffer = pcmToWav(pcmBuffer);

  const audioUrl = await storeGeneratedFile(
    `${id}.wav`,
    wavBuffer,
    "audio/wav"
  );

  return { audioUrl };
}
