const options: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};
const formats = {
  en: new Intl.DateTimeFormat("en-IN", options),
  hi: new Intl.DateTimeFormat("hi-IN", options),
};
export function formatDateTime(value: string, language: "en" | "hi"): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? language === "hi"
      ? "तारीख की जाँच करें"
      : "Date needs review"
    : formats[language].format(date);
}
