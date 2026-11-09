import { parseRupees, formatMoney } from "./money";
import { uxText } from "../state/ux-copy";
import type { Language } from "../state/copy";
export type ReviewField = {
  key: string;
  label: string;
  kind?:
    "text" | "money" | "number" | "date" | "datetime" | "choice" | "select";
  options?: { id: string; label: string }[];
};
export type ReviewRow = {
  key: string;
  label: string;
  value: string;
  step: number;
  invalid: boolean;
  unconfirmed: boolean;
};
export function reviewFormValues(
  steps: readonly { fields: readonly ReviewField[] }[],
  values: Record<string, string>,
  language: Language,
): ReviewRow[] {
  const locale =
    language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN";
  return steps.flatMap((step, index) =>
    step.fields.map((field) => {
      const raw = values[field.key] ?? "";
      let value = raw,
        invalid = false;
      if (field.kind === "choice")
        value =
          raw === "yes"
            ? uxText(language, "Confirmed", "पुष्टि की")
            : uxText(language, "Not confirmed", "पुष्टि नहीं की");
      else if (!raw.trim())
        value = uxText(language, "Not provided", "नहीं दिया");
      else if (field.kind === "select") {
        const selected = field.options?.find((option) => option.id === raw);
        invalid = !selected;
        value =
          selected?.label ??
          uxText(language, "Selection needs review", "चुना हुआ विकल्प जाँचें");
      } else if (field.kind === "money") {
        const paise = parseRupees(raw);
        invalid = paise === null;
        value = paise === null ? raw : formatMoney(paise, language === "hi");
      } else if (field.kind === "date" || field.kind === "datetime") {
        const date = new Date(
          field.kind === "date" ? `${raw}T12:00:00+05:30` : raw,
        );
        if (!Number.isNaN(date.getTime()))
          value = new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
            ...(field.kind === "datetime"
              ? { hour: "numeric", minute: "2-digit" }
              : {}),
            timeZone: "Asia/Kolkata",
          }).format(date);
      }
      return {
        key: field.key,
        label: field.label,
        value,
        step: index,
        invalid,
        unconfirmed: field.kind === "choice" && raw !== "yes",
      };
    }),
  );
}
