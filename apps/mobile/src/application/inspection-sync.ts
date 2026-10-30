import { randomUUID } from "expo-crypto";
import type { Task, TaskCommand } from "@arihant/contracts";
import type { ApiClient } from "../adapters/api";
import {
  saveLocal,
  loadLocal,
  deleteLocal,
  type PhotoDraft,
} from "../adapters/local-store";
export const draftKey = (taskId: string, itemId: string) =>
  `photo:${taskId}:${itemId}`;
export async function syncAnswer(
  api: ApiClient,
  owner: string,
  task: Task,
  itemId: string,
  draft: PhotoDraft,
) {
  if (!draft.result) throw new Error("Choose the observed result first.");
  const sending = {
    ...draft,
    commandId: draft.commandId || randomUUID(),
    expectedVersion: draft.expectedVersion ?? task.version,
  };
  await saveLocal(owner, draftKey(task.id, itemId), sending);
  const evidence = sending.evidenceId
    ? { id: sending.evidenceId }
    : await api.upload(task.id, itemId, sending.id, sending.uri);
  await saveLocal(owner, draftKey(task.id, itemId), {
    ...sending,
    evidenceId: evidence.id,
    reading: draft.reading ?? null,
    applicabilityConfirmed: draft.applicabilityConfirmed ?? false,
  });
  const command: TaskCommand = {
    action: "answer",
    commandId: sending.commandId,
    expectedVersion: sending.expectedVersion,
    itemId,
    result: draft.result,
    note: draft.note,
    evidenceId: evidence.id,
    reading: draft.reading ?? null,
    applicabilityConfirmed: draft.applicabilityConfirmed ?? false,
  };
  const updated = await api.command(task.id, command);
  const saved = { ...sending, evidenceId: evidence.id, synced: true };
  await saveLocal(owner, draftKey(task.id, itemId), saved);
  await saveLocal(owner, `task:${task.id}`, updated);
  return { task: updated, draft: saved };
}
type SimpleCommand =
  | { action: "submit" | "takeover" }
  | { action: "help"; itemId?: string; note: string }
  | {
      action: "review";
      decision: "accept" | "recheck";
      recheckItemIds?: string[];
      note?: string;
    };
export async function sendTaskCommand(
  api: ApiClient,
  owner: string,
  task: Task,
  payload: SimpleCommand,
) {
  const key = `command:${task.id}:${payload.action}`,
    previous = await loadLocal<{ payload: string; command: TaskCommand }>(
      owner,
      key,
    ),
    fingerprint = JSON.stringify(payload);
  const command =
    previous?.payload === fingerprint
      ? previous.command
      : ({
          ...payload,
          commandId: randomUUID(),
          expectedVersion: task.version,
        } as TaskCommand);
  await saveLocal(owner, key, { payload: fingerprint, command });
  try {
    const result = await api.command(task.id, command);
    await deleteLocal(owner, key);
    await saveLocal(owner, `task:${task.id}`, result);
    return result;
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      ["VERSION_CONFLICT", "NOT_FOUND", "FORBIDDEN"].includes(String(e.code))
    )
      await deleteLocal(owner, key);
    throw e;
  }
}
