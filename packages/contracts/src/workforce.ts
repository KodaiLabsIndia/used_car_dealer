import { z } from "zod";
import type { components } from "./generated";
type Api = components["schemas"];
const money = z.number().int().nonnegative();
const nullableId = z.uuid().nullable();
export const scheduleSchema = z.object({
  timezone: z.literal("Asia/Kolkata"),
  start: z.string(),
  end: z.string(),
  weekdays: z.array(z.number().int()),
  graceMinutes: z.number().int(),
});
export const workforcePolicySchema = z.object({
  version: z.number().int(),
  effectiveFrom: z.string(),
  schedule: scheduleSchema,
  paidLeaveHalfDays: z.number().int(),
  holidays: z.array(
    z.object({ day: z.string(), name: z.string(), paid: z.boolean() }),
  ),
  collectLocation: z.boolean(),
  selfieRequired: z.boolean(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  radiusM: z.number().int(),
});
export const payTermsSchema = z.object({
  effectiveFrom: z.string(),
  basis: z.enum(["daily", "weekly", "monthly", "hourly"]),
  cycle: z.enum(["daily", "weekly", "monthly"]),
  ratePaise: money,
  payoutDelayDays: z.number().int(),
  schedule: scheduleSchema.nullable(),
});
const attendanceSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  workDate: z.string(),
  punchedInAt: z.string(),
  punchedOutAt: z.string().nullable(),
  status: z.enum(["open", "closed", "missed_out"]),
  minutes: z.number().int().nullable(),
  version: z.number().int(),
  schedule: scheduleSchema,
  policyVersion: z.number().int(),
  selfieRequired: z.boolean(),
  sourceSignature: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  cutoffAt: z.string(),
  flags: z.array(z.string()),
  proofId: nullableId,
  outProofId: nullableId,
});
const dayReviewSchema = z.object({
  id: z.uuid(),
  workDate: z.string(),
  halfDays: z.number().int(),
  minutes: z.number().int().nullable(),
  reason: z.string(),
  reviewedBy: z.string(),
  sourceSignature: z.string(),
});
const leaveSchema = z.object({
  id: z.uuid(),
  start: z.string(),
  end: z.string(),
  halfDaysPerDay: z.number().int(),
  paid: z.boolean(),
  reason: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  version: z.number().int(),
  reviewReason: z.string().nullable(),
});
const advanceSchema = z.object({
  id: z.uuid(),
  amountPaise: money,
  reason: z.string(),
  status: z.enum(["pending", "approved", "rejected", "paid"]),
  version: z.number().int(),
  reference: z.string().nullable(),
});
const advancePlanSchema = z.object({
  id: z.uuid(),
  mode: z.enum(["full", "skip", "partial", "split"]),
  portionPaise: money,
  startsOn: z.string(),
  paymentIds: z.array(z.string()),
  reason: z.string(),
});
export const salaryPreviewSchema = z.object({
  userId: z.uuid(),
  start: z.string(),
  end: z.string(),
  dueOn: z.string(),
  terms: payTermsSchema,
  sourceDays: z.array(
    z.object({
      day: z.string(),
      source: z.string(),
      halfDays: z.number().int(),
      minutes: z.number().int().nullable(),
      earningsPaise: money,
      warnings: z.array(z.string()),
    }),
  ),
  basePaise: money,
  bonusPaise: money,
  deductionPaise: money,
  advanceBalancePaise: money,
  advanceRecoveryPaise: money,
  netPaise: money,
  blockers: z.array(z.string()),
  fingerprint: z.string(),
});
export const salaryRecordSchema = z.object({
  id: z.uuid(),
  start: z.string(),
  end: z.string(),
  revision: z.number().int(),
  snapshot: salaryPreviewSchema,
  confirmedBy: z.string(),
  confirmedAt: z.string(),
  paidPaise: money,
  status: z.enum(["confirmed", "paid", "void"]),
});
export const workforceSchema = z.object({
  serverNow: z.string(),
  today: z.string(),
  emptyDaySignature: z.string(),
  people: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      active: z.boolean(),
      attendanceStatus: z.string(),
    }),
  ),
  selectedUserId: z.uuid(),
  policy: workforcePolicySchema,
  profileVersion: z.number().int(),
  payTerms: payTermsSchema.nullable(),
  attendance: z.array(attendanceSchema),
  reviews: z.array(dayReviewSchema),
  leaves: z.array(leaveSchema),
  leaveUsedHalfDays: z.number().int(),
  advances: z.array(advanceSchema),
  advancePlan: advancePlanSchema.nullable(),
  advanceBalancePaise: money,
  salaries: z.array(salaryRecordSchema),
  payments: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(["advance_payment", "salary_payment", "reversal", "void"]),
      amountPaise: money,
      targetId: z.uuid(),
      reversesId: nullableId,
      reference: z.string(),
      reason: z.string(),
      occurredAt: z.string(),
      recordedBy: z.string(),
      reversed: z.boolean(),
    }),
  ),
});
export type WorkforceView = z.infer<typeof workforceSchema>;
export type WorkforcePolicy = z.infer<typeof workforcePolicySchema>;
export type AttendanceRecord = z.infer<typeof attendanceSchema>;
export type SalaryPreview = z.infer<typeof salaryPreviewSchema>;
export type SalaryRecord = z.infer<typeof salaryRecordSchema>;
export type WorkforceCommand = Pick<
  Api["WorkforceCommand"],
  "commandId" | "action"
> &
  Partial<Omit<Api["WorkforceCommand"], "commandId" | "action">>;
export type PublishWorkforcePolicy = Api["PublishWorkforcePolicy"];
