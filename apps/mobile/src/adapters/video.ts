import { requireOptionalNativeModule } from "expo";
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
export type PreparedVideo = {
  uri: string;
  width: number;
  height: number;
  durationMs: number;
  bytes: number;
  profile: "video-720-v1";
  fps: number;
  hdr: boolean;
  videoMime: string;
};
type NativeVideo = {
  normalize(uri: string): Promise<PreparedVideo>;
  inspect(uri: string): Promise<PreparedVideo>;
  cancel(): Promise<void>;
};
const native = requireOptionalNativeModule<NativeVideo>("ArihantMedia");
export const canPrepareVideo = !!native;
export const cancelVideoPreparation = async () => {
  await native?.cancel();
};
export async function preserveVideoSource(uri: string, user: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.size > 512 * 1024 * 1024)
    throw Error("Choose a shorter clip, at most 30 seconds.");
  const available = await FileSystem.getFreeDiskStorageAsync();
  if (available < info.size + 64 * 1024 * 1024)
    throw Error("Not enough phone storage. Make space and try again.");
  const directory = `${FileSystem.documentDirectory}evidence/${user}/video/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const target = `${directory}${Crypto.randomUUID()}.source.mov`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}
export async function prepareVideo(
  source: string,
  user: string,
): Promise<PreparedVideo> {
  if (!native)
    throw Error(
      "This build cannot prepare video. Use the Arihant development build; no original clip was uploaded.",
    );
  const output = await native.normalize(source);
  const verified = await native.inspect(output.uri);
  const size = await FileSystem.getInfoAsync(output.uri);
  if (
    !size.exists ||
    !size.size ||
    size.size > 32 * 1024 * 1024 ||
    !(
      (verified.width === 1280 && verified.height === 720) ||
      (verified.width === 720 && verified.height === 1280)
    ) ||
    verified.durationMs > 30100 ||
    verified.durationMs <= 0 ||
    verified.videoMime !== "video/avc" ||
    verified.hdr ||
    !Number.isFinite(verified.fps) ||
    verified.fps <= 0 ||
    verified.fps > 30.5 ||
    output.uri === source
  )
    throw Error(
      "The clip could not be verified. Keep it on the phone and retry.",
    );
  const directory = `${FileSystem.documentDirectory}evidence/${user}/video/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const target = `${directory}${Crypto.randomUUID()}.mp4`;
  await FileSystem.copyAsync({ from: output.uri, to: target });
  await FileSystem.deleteAsync(output.uri, { idempotent: true });
  return { ...output, uri: target, bytes: size.size };
}
