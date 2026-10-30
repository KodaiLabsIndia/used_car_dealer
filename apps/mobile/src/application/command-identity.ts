export function commandFingerprint(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(commandFingerprint).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${commandFingerprint(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
