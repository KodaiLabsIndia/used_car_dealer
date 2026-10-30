import { randomUUID } from "expo-crypto";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
import { commandFingerprint } from "./command-identity";

// Persist the exact request before sending, so a lost response can be replayed.
// Version changes only enter a fresh request after a definite server rejection.
export async function sendCommand<P extends object, T>(
  owner: string,
  key: string,
  payload: P,
  send: (body: P & { commandId: string }) => Promise<T>,
): Promise<T> {
  const recordKey = `mutation:${key}`;
  const pending = await loadLocal<{ payload: P; commandId: string }>(
    owner,
    recordKey,
  );
  // Finish a pending request before accepting another change on this form.
  const request = pending || { payload, commandId: randomUUID() };
  await saveLocal(owner, recordKey, request);
  try {
    const result = await send({
      ...request.payload,
      commandId: request.commandId,
    });
    await deleteLocal(owner, recordKey);
    if (
      pending &&
      commandFingerprint(pending.payload) !== commandFingerprint(payload)
    ) {
      throw new Error(
        "Your earlier action was saved. Review this changed form before saving it as a new action.",
      );
    }
    return result;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status && status >= 400 && status < 500)
      await deleteLocal(owner, recordKey);
    throw error;
  }
}
