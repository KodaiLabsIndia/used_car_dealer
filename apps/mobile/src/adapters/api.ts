import { ApiClient as SharedApiClient } from "@arihant/api-client";
import { ApiError } from "@arihant/api-client";
import * as FileSystem from "expo-file-system/legacy";
export { ApiError } from "@arihant/api-client";
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:4100"
).replace(/\/$/, "");
export class ApiClient extends SharedApiClient {
  constructor(
    token: string | null,
    url = API_URL,
    onUnauthorized?: () => void,
  ) {
    super(token, url, onUnauthorized);
  }
  protected override async uploadPreparedFile(
    path: string,
    uri: string,
    mime: string,
    parameters?: Record<string, string>,
  ): Promise<unknown> {
    const task = FileSystem.createUploadTask(`${this.url}/v1${path}`, uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: mime,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      ...(parameters ? { parameters } : {}),
    });
    const timer = setTimeout(() => {
      void task.cancelAsync().catch(() => {});
    }, 90000);
    try {
      const response = await task.uploadAsync();
      if (!response)
        throw new ApiError(
          "Upload interrupted. Your prepared file stays on this phone.",
          "OFFLINE",
          0,
        );
      if (response.status === 401 && this.token) this.onUnauthorized?.();
      let body: {
        error?: { message?: string; code?: string };
      } | null = null;
      try {
        body = JSON.parse(response.body);
      } catch {}
      if (response.status < 200 || response.status >= 300)
        throw new ApiError(
          body?.error?.message ??
            "Upload could not be confirmed. Retry the saved file.",
          body?.error?.code ?? "REQUEST_FAILED",
          response.status,
        );
      if (!body)
        throw new ApiError(
          "The server response was unreadable. Retry the same saved file.",
          "INVALID_RESPONSE",
          response.status,
        );
      return body;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        "Upload could not be confirmed. Your prepared file stays on this phone. Retry when connected.",
        "OFFLINE",
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
