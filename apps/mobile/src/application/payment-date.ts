export function localDateInput(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function paymentTimestamp(day: string, now = new Date()): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!match) return null;
  const year = Number(match[1]),
    month = Number(match[2]),
    date = Number(match[3]);
  if (year < 1900) return null;
  const paid = new Date(
    year,
    month - 1,
    date,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  if (
    paid.getFullYear() !== year ||
    paid.getMonth() !== month - 1 ||
    paid.getDate() !== date ||
    paid > now
  )
    return null;
  return paid.toISOString();
}
