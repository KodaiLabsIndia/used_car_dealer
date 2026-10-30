import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import {
  isCompliantPhoto,
  mediaProfile,
  normalizedPhotoSize,
} from "@arihant/contracts";
import type { PhotoDraft } from "./local-store";
export async function preparePhoto(
  source: { uri: string; width: number; height: number },
  ownerId: string,
): Promise<PhotoDraft> {
  const size = normalizedPhotoSize(source.width, source.height),
    context = ImageManipulator.manipulate(source.uri);
  context.resize(size);
  const result = await (async () => {
    try {
      const image = await context.renderAsync();
      try {
        return await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.85,
        });
      } finally {
        image.release();
      }
    } finally {
      context.release();
    }
  })();
  if (!isCompliantPhoto(result.width, result.height))
    throw new Error("Photo preparation failed. Retake the photo.");
  const id = randomUUID(),
    directory = `${FileSystem.documentDirectory}evidence/${ownerId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const uri = `${directory}${id}.jpg`;
  await FileSystem.copyAsync({ from: result.uri, to: uri });
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.size > mediaProfile.maxBytes) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    throw new Error("Photo is too large. Take a closer photo.");
  }
  // Normalized evidence is durable before the caller records it. Camera/import originals are never uploaded.
  await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(
    () => {},
  );
  return {
    id,
    uri,
    width: result.width,
    height: result.height,
    bytes: info.size,
    note: "",
  };
}
