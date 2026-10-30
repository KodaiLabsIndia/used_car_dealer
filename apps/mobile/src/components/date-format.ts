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
  mr: new Intl.DateTimeFormat("mr-IN", options),
};
export function formatDateTime(
  value: string,
  language: "en" | "hi" | "mr",
): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? language === "mr"
      ? "तारीख तपासा"
      : language === "hi"
        ? "तारीख की जाँच करें"
        : "Date needs review"
    : formats[language].format(date);
}
