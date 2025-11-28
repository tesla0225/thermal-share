# 「寒い／暑い」タイムライン Web アプリ 仕様書 v0.3

## 1. プロジェクト概要

### 1.1 コンセプト

* ユーザーが「寒い」「暑い」など体感温度に関する一言をつぶやく。
* 音声を Gemini の音声理解で解析し、
  * JSON 形式の「感情・状態のラベル」「強さ」「説明文」「画像用プロンプト」「音声用テキスト」などに変換。
* その JSON を元に、
  * Gemini 2.5 Flash Image（Nano Banana）でテキスト入り画像を生成。
  * Gemini 2.5 Flash TTS で短い音声メッセージを生成。
* 生成された「文字画像＋音声」をタイムラインにカード形式で並べていく、シンプルな Web サービス。

### 1.2 ターゲット

* 「なんとなく今の体感温度を可視化したい」個人ユーザー。
* 技術検証用のミニプロダクト（Gemini 音声理解＋画像生成＋TTS の統合サンプル）。

---

## 2. ユーザーフロー

1. ユーザーがブラウザでアプリにアクセス。
2. 初回アクセス時にマイク利用の許可を求める。
3. 「録音開始」ボタンを押す。
4. ユーザーが 1〜3 秒ほど「寒い」「暑い」「めっちゃ暑い」など発話し、「停止」ボタンを押す。
5. ブラウザ側で音声データ（webm/opus 想定）を取得し、バックエンドの `/api/items` にアップロード。
6. バックエンドが音声を Gemini で解析し、JSON を生成。
7. その JSON を元に:
   * Gemini の画像モデル（Nano Banana）で画像を生成。
   * Gemini TTS で音声を生成。
8. 画像と音声ファイルを保存し、メタ情報（ラベル・テキストなど）と共に 1 レコードとして保存。
9. フロントエンドは `/api/items` から最新リストを取得し、タイムラインにカードとして表示。
10. カードの「▶︎」ボタンで生成音声を再生可能。

---

## 3. 全体アーキテクチャ

### 3.1 構成

* **フロントエンド**
  * Next.js 15 (App Router) + React 18 + TypeScript
  * UI: Tailwind CSS
  * 音声録音: ブラウザ `MediaRecorder` API

* **バックエンド**
  * Next.js API Route（Route Handler）
  * Vercel でデプロイ（Serverless Functions）

* **外部サービス**
  * Gemini Developer API のみ
    * 音声理解: `gemini-2.5-flash`
    * 画像生成: `gemini-2.5-flash-image`
    * TTS: `gemini-2.5-flash-preview-tts`

* **データストア（v0 実装方針）**
  * 最初はインメモリ or ローカル JSON ファイルで十分。
  * Vercel では KV / Blob Storage への移行も検討可能。

### 3.2 シーケンス

```
Browser                        Vercel (API Route)                    Gemini API
   |                                  |                                   |
   |-- POST /api/items (audio) ------>|                                   |
   |                                  |-- 音声解析 (2.5-flash) ---------->|
   |                                  |<-- FeelingAnalysis JSON ----------|
   |                                  |                                   |
   |                                  |-- 画像生成 (2.5-flash-image) ---->|
   |                                  |<-- base64 PNG -------------------|
   |                                  |                                   |
   |                                  |-- TTS (2.5-flash-preview-tts) --->|
   |                                  |<-- PCM audio --------------------|
   |                                  |                                   |
   |                                  |-- PCM→WAV変換（サーバー内）       |
   |                                  |-- ファイル保存                    |
   |<-- GeneratedItem JSON -----------|                                   |
```

---

## 4. 使用サービス / SDK / パッケージ

### 4.1 Gemini API（すべての機能で使用）

* **クライアント SDK**: `@google/genai`（最新版 1.30.0+）
* **必要な API キー**: `GEMINI_API_KEY` のみ

| 機能 | モデル ID | 用途 |
|------|-----------|------|
| 音声理解 | `gemini-2.5-flash` | 音声→構造化JSON |
| 画像生成 | `gemini-2.5-flash-image` | プロンプト→PNG |
| TTS | `gemini-2.5-flash-preview-tts` | テキスト→音声 |

> ⚠️ **注意**: TTS モデルはプレビュー版です。

### 4.2 追加ライブラリ

| パッケージ | 用途 |
|-----------|------|
| `zod` | スキーマ定義・バリデーション |
| `zod-to-json-schema` | Zod → JSON Schema 変換 |
| `uuid` | ユニーク ID 生成 |

> 💡 **PCM→WAV変換は外部ライブラリ不要**（Buffer操作のみで実装）

---

## 5. API 設計

### 5.1 エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| `POST` | `/api/items` | 音声アップロード＋解析＋画像/TTS 生成 |
| `GET` | `/api/items` | 生成済みアイテム一覧取得 |

### 5.2 POST /api/items

* **リクエスト形式**
  * `Content-Type: multipart/form-data`
  * Body フィールド: `audio` (音声ファイル)

* **レスポンス例（成功時）**: `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "label": "cold",
  "degree": -0.7,
  "userUtteranceJa": "さむ〜い",
  "summaryJa": "かなり寒く感じている状態",
  "imageUrl": "/generated/550e8400-e29b-41d4-a716-446655440000.png",
  "audioUrl": "/generated/550e8400-e29b-41d4-a716-446655440000.wav",
  "createdAt": "2025-11-29T12:34:56.789Z"
}
```

* **エラーレスポンス**
  * `400 Bad Request`: audio がない / 不正な形式
  * `500 Internal Server Error`: Gemini API エラー

### 5.3 GET /api/items

* **クエリ**: `?limit=20`（v0 は固定でも OK）
* **レスポンス**: `200 OK` / Body: `GeneratedItem[]`（新しいもの順）

---

## 6. 型定義

### 6.1 Gemini 構造化出力スキーマ（FeelingAnalysis）

```ts
import { z } from "zod";

// 体感温度ラベル（暑い/寒い/中立のみ）
export const FeelingLabelSchema = z.enum(["hot", "cold", "neutral"]);
export type FeelingLabel = z.infer<typeof FeelingLabelSchema>;

// Gemini からの構造化出力スキーマ
export const FeelingAnalysisSchema = z.object({
  label: FeelingLabelSchema.describe("体感温度ラベル: hot=暑い, cold=寒い, neutral=どちらでもない"),
  degree: z.number().min(-1).max(1).describe("体感温度の強さ: -1.0(極寒) 〜 0(中立) 〜 1.0(極暑)"),
  userUtteranceJa: z.string().describe("推定されたユーザー発話（日本語）"),
  summaryJa: z.string().describe("状態の自然言語まとめ（日本語）"),
  promptForImage: z.string().describe("画像生成用プロンプト（英語推奨）"),
  promptForTts: z.string().describe("TTS用の短い台詞（日本語）"),
});

export type FeelingAnalysis = z.infer<typeof FeelingAnalysisSchema>;
```

### 6.2 生成済みアイテム（GeneratedItem）

```ts
export interface GeneratedItem extends FeelingAnalysis {
  id: string;
  imageUrl: string;  // 生成画像のパス (.png)
  audioUrl: string;  // TTS音声のパス (.wav)
  createdAt: string; // ISO 8601
}
```

---

## 7. バックエンド処理フロー詳細

### 7.0 共通: Gemini クライアント初期化

```ts
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
```

### 7.1 analyzeFeelingFromAudio(audio: Buffer): Promise<FeelingAnalysis>

```ts
import { zodToJsonSchema } from "zod-to-json-schema";

export async function analyzeFeelingFromAudio(audio: Buffer): Promise<FeelingAnalysis> {
  // 1. 音声ファイルをアップロード
  const uploaded = await ai.files.upload({
    file: audio,
    config: { mimeType: "audio/webm" },
  });

  // 2. Structured Output で解析
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: createUserContent([
      createPartFromUri(uploaded.uri!, uploaded.mimeType!),
      `ユーザーの短い一言音声から、体感温度（暑い・寒い）を推定してください。
       - label: "hot"（暑い）, "cold"（寒い）, "neutral"（どちらでもない）
       - degree: -1.0（極寒）〜 1.0（極暑）の数値
       - 画像生成用プロンプトは英語で、感情を視覚的に表現するものにしてください。
       - TTS用台詞は共感的で優しいトーンにしてください。`,
    ]),
    config: {
      responseMimeType: "application/json",
      responseSchema: zodToJsonSchema(FeelingAnalysisSchema),
    },
  });

  // 3. パース＆バリデーション
  const parsed = JSON.parse(response.text ?? "{}");
  return FeelingAnalysisSchema.parse(parsed);
}
```

### 7.2 generateImageFromFeeling(feeling: FeelingAnalysis, id: string): Promise<string>

```ts
import * as fs from "fs/promises";

export async function generateImageFromFeeling(
  feeling: FeelingAnalysis,
  id: string
): Promise<string> {
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

  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part?.inlineData?.data) {
    throw new Error("画像生成に失敗しました");
  }

  const buffer = Buffer.from(part.inlineData.data, "base64");
  const imagePath = `/generated/${id}.png`;
  await fs.writeFile(`public${imagePath}`, buffer);
  
  return imagePath;
}
```

### 7.3 generateTtsFromFeeling(feeling: FeelingAnalysis, id: string): Promise<string>

```ts
import * as fs from "fs/promises";

// PCM → WAV 変換（外部ライブラリ不要）
function pcmToWav(
  pcmData: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitDepth = 16
): Buffer {
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const dataSize = pcmData.length;

  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);           // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

export async function generateTtsFromFeeling(
  feeling: FeelingAnalysis,
  id: string
): Promise<string> {
  // Gemini TTS で音声生成
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: `優しく共感的に言ってください: ${feeling.promptForTts}`,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Kore", // 日本語で自然な声
          },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error("TTS生成に失敗しました");
  }

  // PCM データを WAV に変換
  const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
  const wavBuffer = pcmToWav(pcmBuffer);

  const audioPath = `/generated/${id}.wav`;
  await fs.writeFile(`public${audioPath}`, wavBuffer);

  return audioPath;
}
```

### 7.4 createItem(audio: Buffer): Promise<GeneratedItem>

```ts
import { randomUUID } from "crypto";

// インメモリストレージ（v0用）
const items: GeneratedItem[] = [];

export async function createItem(audio: Buffer): Promise<GeneratedItem> {
  // 1. 音声解析
  const feeling = await analyzeFeelingFromAudio(audio);
  
  // 2. ID 生成
  const id = randomUUID();
  
  // 3. 画像とTTSを並列生成（高速化）
  const [imageUrl, audioUrl] = await Promise.all([
    generateImageFromFeeling(feeling, id),
    generateTtsFromFeeling(feeling, id),
  ]);
  
  // 4. アイテム作成
  const item: GeneratedItem = {
    id,
    createdAt: new Date().toISOString(),
    imageUrl,
    audioUrl,
    ...feeling,
  };
  
  // 5. 保存（先頭に追加）
  items.unshift(item);
  
  return item;
}

export function getItems(limit = 20): GeneratedItem[] {
  return items.slice(0, limit);
}
```

---

## 8. フロントエンド仕様

### 8.1 画面構成

1. **ヘッダー**
   * サービス名: 「Feeling Timeline」または「体感温度タイムライン」

2. **録音エリア**
   * マイクアイコン＋「録音開始」ボタン
   * 録音中は「録音中... 停止」ボタンに切り替え
   * 録音時間の簡易表示（数秒）
   * 処理中はローディング表示

3. **タイムラインエリア**
   * 新しい順で縦にカード表示
   * カード内容:
     * 生成画像（正方形）
     * ラベル（🔥 HOT / ❄️ COLD / 😐 NEUTRAL）
     * summaryJa（状態の説明）
     * userUtteranceJa（発話テキスト）
     * 再生ボタン（生成音声）
     * 投稿日時

### 8.2 状態管理

```tsx
const [items, setItems] = useState<GeneratedItem[]>([]);
const [isRecording, setIsRecording] = useState(false);
const [isProcessing, setIsProcessing] = useState(false);

// 初回マウント時に既存アイテムをロード
useEffect(() => {
  fetch("/api/items")
    .then(res => res.json())
    .then(data => setItems(data));
}, []);

// 録音完了後の処理
const handleRecordingComplete = async (blob: Blob) => {
  setIsProcessing(true);
  try {
    const formData = new FormData();
    formData.append("audio", blob, "input.webm");
    
    const res = await fetch("/api/items", { method: "POST", body: formData });
    const newItem = await res.json();
    
    setItems(prev => [newItem, ...prev]);
  } finally {
    setIsProcessing(false);
  }
};
```

### 8.3 音声再生（HTML5 Audio）

```tsx
// WAV ファイルはブラウザで直接再生可能
const playAudio = (audioUrl: string) => {
  const audio = new Audio(audioUrl);
  audio.play();
};

// カード内での使用例
<button onClick={() => playAudio(item.audioUrl)}>
  ▶️ 再生
</button>
```

### 8.4 音声録音ロジック（ブラウザ）

```tsx
const useAudioRecorder = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.start();
  };

  const stopRecording = (): Promise<Blob> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) return;

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        resolve(blob);
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.stop();
    });
  };

  return { startRecording, stopRecording };
};
```

---

## 9. 環境変数

| 変数名 | 説明 |
|--------|------|
| `GEMINI_API_KEY` | Google AI Studio で発行した API キー |

**.env.local 例**:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

> 💡 **Gemini API キー1つですべての機能が動作します！**

---

## 10. Vercel デプロイ設定

### 10.1 制約と対応

| 項目 | Hobby（無料） | Pro |
|------|--------------|-----|
| タイムアウト | 10秒 | 60秒 |
| メモリ | 1024MB | 3008MB |

短い音声（1〜3秒）の処理なら無料プランでも問題なし。

### 10.2 ファイル保存の注意

Vercel Serverless Functions では `public/` への書き込みが永続化されません。

**v0 での対応策**:
- 生成ファイルは Base64 でレスポンスに含めてフロントで表示
- または Vercel Blob Storage を使用

**簡易実装（Base64埋め込み）**:
```ts
// レスポンスに直接含める
return {
  ...item,
  imageData: `data:image/png;base64,${imageBase64}`,
  audioData: `data:audio/wav;base64,${audioBase64}`,
};
```

---

## 11. 制約・注意点

### Gemini API
* TTS モデル (`gemini-2.5-flash-preview-tts`) はプレビュー版
* 音声によって日本語の発音にクセが出る場合あり（`Kore` は比較的自然）

### コスト（Gemini Developer API）
* 音声解析: 入力トークン課金
* 画像生成: $0.039/画像（1290 output tokens）
* TTS: 100万トークン/$10

### レイテンシ
* 音声解析 → 画像生成 + TTS（並列）で 3〜8 秒程度
* Vercel 無料プランの 10 秒制限内に収まる想定

---

## 12. v0 実装スコープ

### 対応範囲
- [x] フロント 1 画面（録音＋タイムライン）
- [x] `POST /api/items` 実装
- [x] `GET /api/items` 実装（インメモリ）
- [x] Gemini 2.5 Flash による音声解析＋構造化 JSON
- [x] Gemini 2.5 Flash Image による画像生成
- [x] Gemini 2.5 Flash TTS による音声生成
- [x] PCM→WAV 変換（サーバーサイド）
- [x] 画像・音声の並列生成による高速化

### 後回し
- [ ] 永続ストレージ（Vercel Blob / KV）
- [ ] 認証、マルチユーザー対応
- [ ] レスポンシブ最適化やデザインの作り込み
- [ ] 共有機能（X/Twitter 投稿など）

---

## 13. 今後の拡張案

* 時間帯・季節ごとの体感温度トレンド可視化
* 1 日のログをまとめた「日報」画像を自動生成
* Gemini Live API を使ったリアルタイム対話
* Vercel Blob Storage での永続化
* PWA 対応でモバイルアプリライクな体験

---

## 付録: ディレクトリ構成案

```
feeling-timeline/
├── app/
│   ├── api/
│   │   └── items/
│   │       └── route.ts      # POST/GET ハンドラー
│   ├── page.tsx              # メイン画面
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── RecordButton.tsx      # 録音ボタン
│   ├── Timeline.tsx          # タイムライン表示
│   └── FeelingCard.tsx       # 個別カード
├── lib/
│   ├── gemini.ts             # Gemini API ラッパー（音声解析・画像・TTS）
│   ├── audio.ts              # PCM→WAV変換
│   ├── storage.ts            # インメモリストレージ
│   └── types.ts              # 型定義
├── public/
│   └── generated/            # 生成ファイル保存先（ローカル開発用）
├── .env.local
├── package.json
└── tsconfig.json
```

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| v0.1 | 2025-11-29 | 初版作成 |
| v0.2 | 2025-11-29 | API検証に基づく修正、体感温度特化に変更 |
| v0.3 | 2025-11-29 | ElevenLabs → Gemini TTS に変更、PCM→WAV変換追加、環境変数簡素化 |