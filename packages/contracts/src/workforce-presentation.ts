import type { SalaryRecord } from "./workforce";
export function salaryStatementText(
  s: SalaryRecord,
  name: string,
  language: "en" | "hi" | "mr" = "en",
) {
  const tr = (en: string, hi: string, mr: string) =>
    language === "hi" ? hi : language === "mr" ? mr : en;
  const money = (n: number) =>
    new Intl.NumberFormat(`${language === "en" ? "en" : language}-IN`, {
      style: "currency",
      currency: "INR",
    }).format(n / 100);
  const p = s.snapshot;
  const status =
    s.status === "paid"
      ? tr("Paid", "भुगतान दर्ज", "दिलेली रक्कम")
      : s.status === "void"
        ? tr("Voided", "रद्द", "रद्द")
        : tr("Confirmed", "पक्का किया", "निश्चित");
  return [
    tr(
      "Arihant Cars · Salary statement",
      "अरिहंत कार्स · वेतन पर्ची",
      "अरिहंत कार्स · पगारपत्रक",
    ),
    name,
    `${s.start} → ${s.end} · v${s.revision}`,
    `${tr("Earned", "कमाई", "कमाई")}: ${money(p.basePaise)}`,
    `${tr("Bonus", "बोनस", "बोनस")}: ${money(p.bonusPaise)}`,
    `${tr("Other deduction", "अन्य कटौती", "इतर कपात")}: ${money(p.deductionPaise)}`,
    `${tr("Advance recovered", "अग्रिम की वसूली", "आगाऊ वसुली")}: ${money(p.advanceRecoveryPaise)}`,
    `${tr("Net salary", "मिलने वाला वेतन", "निव्वळ पगार")}: ${money(p.netPaise)}`,
    `${tr("Paid", "भुगतान दर्ज", "दिलेली रक्कम")}: ${money(s.paidPaise)}`,
    `${tr("Due", "देय", "देय")}: ${p.dueOn}`,
    `${tr("Confirmed by", "पक्का करने वाले", "निश्चित करणारे")}: ${s.confirmedBy}`,
    `${tr("Status", "स्थिति", "स्थिती")}: ${status}`,
  ].join("\n");
}
