import { z } from "zod";

// 体感温度ラベル
export const FeelingLabelSchema = z.enum(["hot", "cold", "neutral"]);
export type FeelingLabel = z.infer<typeof FeelingLabelSchema>;

// Gemini からの構造化出力スキーマ
export const FeelingAnalysisSchema = z.object({
  label: FeelingLabelSchema.describe(
    '体感温度ラベル: hot=暑い, cold=寒い, neutral=どちらでもない'
  ),
  degree: z
    .number()
    .min(-1)
    .max(1)
    .describe("体感温度の強さ: -1.0(極寒) 〜 0(中立) 〜 1.0(極暑)"),
  userUtteranceJa: z.string().describe("推定されたユーザー発話（日本語）"),
  summaryJa: z.string().describe("状態の自然言語まとめ（日本語）"),
  promptForImage: z.string().describe("画像生成用プロンプト（英語推奨）"),
  promptForTts: z.string().describe("TTS用の短い台詞（日本語）"),
});

export type FeelingAnalysis = z.infer<typeof FeelingAnalysisSchema>;

export interface GeneratedItem extends FeelingAnalysis {
  id: string;
  imageUrl: string; // 生成画像のパス (.png)
  audioUrl: string; // TTS音声のパス (.wav)
  createdAt: string; // ISO 8601
}

export interface GeneratedItemResponse extends GeneratedItem {
  imageData?: string;
  audioData?: string;
}
