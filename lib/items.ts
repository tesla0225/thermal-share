import { randomUUID } from "crypto";
import {
  analyzeFeelingFromAudio,
  generateImageFromFeeling,
  generateTtsFromFeeling,
} from "./gemini";
import { saveItem, getItems as loadItems } from "./storage";
import { GeneratedItem } from "./types";

export async function createItem(audio: Buffer): Promise<GeneratedItem> {
  const feeling = await analyzeFeelingFromAudio(audio);
  const id = randomUUID();

  const [imageResult, audioResult] = await Promise.all([
    generateImageFromFeeling(feeling, id),
    generateTtsFromFeeling(feeling, id),
  ]);

  const item: GeneratedItem = {
    id,
    createdAt: new Date().toISOString(),
    imageUrl: imageResult.imageUrl,
    audioUrl: audioResult.audioUrl,
    ...feeling,
  };

  await saveItem(item);
  return item;
}

export async function getItems(limit = 20): Promise<GeneratedItem[]> {
  return loadItems(limit);
}
