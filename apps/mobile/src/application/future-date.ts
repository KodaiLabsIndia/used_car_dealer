// Operator-selected dates use the end of the local calendar day, including DST.
export function futureDayTimestamp(
  value: string,
  now = new Date(),
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (
    year < 2000 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date <= now
  )
    return null;
  return date.toISOString();
}

export function futureLocalDateTimeTimestamp(input: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(input.trim());
  if (!match) throw Error("Choose the appointment date, hour and minute.");
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute ||
    value.getTime() <= Date.now()
  )
    throw Error("Choose a valid future appointment time.");
  return value.toISOString();
}

export function requireFutureDayTimestamp(input: string): string {
  const value = futureDayTimestamp(input);
  if (!value) throw Error("Choose a valid follow-up date from today onwards.");
  return value;
}
