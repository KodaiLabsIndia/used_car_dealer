import { z } from "zod";
export const reportAmountsSchema = z.object({
  purchaseCommittedPaise: z.number().int().nonnegative().safe(),
  sellerPaidPaise: z.number().int().nonnegative().safe(),
  sellerBalancePaise: z.number().int().nonnegative().safe(),
  recordedCostsPaise: z.number().int().nonnegative().safe(),
  warrantyCostsPaise: z.number().int().nonnegative().safe(),
  buyerCollectedPaise: z.number().int().nonnegative().safe(),
  buyerRefundedPaise: z.number().int().nonnegative().safe(),
  buyerBalancePaise: z.number().int().nonnegative().safe(),
  refundDuePaise: z.number().int().nonnegative().safe(),
  vendorPaidPaise: z.number().int().nonnegative().safe(),
  vendorBalancePaise: z.number().int().nonnegative().safe(),
  vendorAdvancePaise: z.number().int().nonnegative().safe(),
});
export const operationsReportSchema = z.object({
  cutoff: z.string(),
  items: z.array(
    reportAmountsSchema.extend({
      carId: z.uuid(),
      stockNumber: z.string(),
      carLabel: z.string(),
      registration: z.string(),
      stage: z.string(),
      commercialStatus: z.string(),
      location: z.string(),
      stockAgeDays: z.number().int().nonnegative().nullable(),
      openJobs: z.number().int().nonnegative(),
      waitingJobs: z.number().int().nonnegative(),
      oldestDueAt: z.string().nullable(),
    }),
  ),
  totals: reportAmountsSchema,
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type OperationsReport = z.infer<typeof operationsReportSchema>;
export const stageSchema = z.enum([
  "inspection",
  "purchase",
  "refurbishment",
  "ready",
  "delivered",
]);
export type Stage = z.infer<typeof stageSchema>;
export const mediaProfile = Object.freeze({
  version: "photo-fhd-v1",
  maxBytes: 8 * 1024 * 1024,
  maxLandscapeWidth: 1920,
  maxLandscapeHeight: 1080,
  maxPortraitWidth: 1080,
  maxPortraitHeight: 1920,
  videoLandscape: [1280, 720] as const,
  videoPortrait: [720, 1280] as const,
});
export function normalizedPhotoSize(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error("Invalid photo dimensions");
  const portrait = height > width,
    maxWidth = portrait ? 1080 : 1920,
    maxHeight = portrait ? 1920 : 1080;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}
export function isCompliantPhoto(width: number, height: number) {
  const output = normalizedPhotoSize(width, height);
  return output.width === width && output.height === height;
}
export const workRoleSchema = z.enum([
  "inspector",
  "coordinator",
  "supervisor",
  "manager",
  "sales",
]);
export type WorkRole = z.infer<typeof workRoleSchema>;
export const actorSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  name: z.string(),
  role: z.enum(["owner", "employee"]),
  workRoles: z.array(workRoleSchema).default(["inspector"]),
});
export type Actor = z.infer<typeof actorSchema>;
export const carSchema = z.object({
  id: z.uuid(),
  vehicleId: z.uuid(),
  stockNumber: z.string(),
  make: z.string(),
  model: z.string(),
  registration: z.string(),
  year: z.number(),
  stage: stageSchema,
  commercialStatus: z.enum(["available", "booked", "sold"]),
  serviceStatus: z.enum(["none", "in_service", "waiting_parts", "done"]),
  location: z.string(),
  nextAction: z.string(),
  dueAt: z.string().nullable(),
  version: z.number(),
  updatedAt: z.string(),
  imageKey: z.enum(["sonet", "seltos", "generic"]),
  odometerKm: z.number().nullable(),
});
export type Car = z.infer<typeof carSchema>;
export const evidenceSchema = z.object({
  id: z.uuid(),
  itemId: z.string(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  sha256: z.string(),
  profile: z.literal("photo-fhd-v1"),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export const vehicleConfigurationSchema = z.object({
  bodyType: z
    .enum([
      "unknown",
      "sedan",
      "hatchback",
      "suv",
      "mpv",
      "van",
      "coupe",
      "convertible",
      "wagon",
      "pickup",
    ])
    .default("unknown"),
  fuel: z
    .enum(["unknown", "petrol", "diesel", "cng", "lpg", "hybrid", "electric"])
    .default("unknown"),
  transmission: z
    .enum(["unknown", "manual", "automatic", "amt", "cvt", "dct"])
    .default("unknown"),
  features: z.record(z.string(), z.boolean().nullable()).default({}),
});
export type VehicleConfiguration = z.infer<typeof vehicleConfigurationSchema>;
export const cataloguePageSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      make: z.string(),
      model: z.string(),
      bodyType: z.string(),
      marketStatus: z.string(),
      sourceUrl: z.string(),
    }),
  ),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  sourceScope: z.string(),
});
export type CatalogueModel = z.infer<
  typeof cataloguePageSchema
>["items"][number];
export const applicabilitySchema = z.object({
  fuels: z.array(z.string()).default([]),
  transmissions: z.array(z.string()).default([]),
  feature: z.string().nullable().default(null),
});
export const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  titleHi: z.string(),
  titleMr: z.string().default(""),
  instruction: z.string(),
  instructionHi: z.string(),
  instructionMr: z.string().default(""),
  order: z.number(),
  required: z.boolean(),
  zone: z
    .enum([
      "general",
      "identity",
      "exterior",
      "visibility",
      "wheels",
      "powertrain",
      "underbody",
      "cabin",
      "electrical",
      "safety",
      "road_test",
    ])
    .default("general"),
  componentId: z.string().default("vehicle"),
  method: z
    .enum([
      "visual",
      "function",
      "measurement",
      "document",
      "diagnostic",
      "road_test",
    ])
    .default("visual"),
  critical: z.boolean().default(false),
  requiresClip: z.boolean().default(false),
  measurementUnit: z.enum(["mm", "psi", "V", "km"]).nullable().default(null),
  applicability: applicabilitySchema.default(() =>
    applicabilitySchema.parse({}),
  ),
  configurationPending: z.boolean().default(false),
  applicabilityReason: z.string().default(""),
});
export type ChecklistItem = z.infer<typeof itemSchema>;
export const answerSchema = z.object({
  itemId: z.string(),
  result: z.enum(["ok", "problem", "unable", "not_applicable"]),
  note: z.string(),
  evidenceId: z.uuid(),
  reading: z.number().nullable().default(null),
  applicabilityConfirmed: z.boolean().default(false),
});
export type Answer = z.infer<typeof answerSchema>;
export const taskSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  carId: z.uuid(),
  title: z.string(),
  assignedTo: z.uuid(),
  assigneeName: z.string(),
  status: z.enum([
    "assigned",
    "in_progress",
    "submitted",
    "completed",
    "recheck",
  ]),
  version: z.number(),
  helpOpen: z.boolean(),
  dueAt: z.string().nullable(),
  car: carSchema,
  items: z.array(itemSchema),
  answers: z.array(answerSchema),
  evidence: z.array(evidenceSchema),
  kind: z.enum([
    "reference",
    "pre_purchase",
    "intake",
    "repair_qc",
    "delivery",
  ]),
  templateName: z.string(),
  templateVersion: z.number(),
  templateApproved: z.boolean(),
  submittedBy: z.uuid().nullable(),
  submittedAt: z.string().nullable(),
  recheckItems: z.array(z.string()),
  recheckNote: z.string().default(""),
  vehicleConfiguration: vehicleConfigurationSchema.default(() =>
    vehicleConfigurationSchema.parse({}),
  ),
  clipItemIds: z.array(z.string()).default([]),
});
export type Task = z.infer<typeof taskSchema>;
export const dashboardSchema = z.object({
  cars: z.number(),
  workshop: z.number(),
  booked: z.number(),
  decisions: z.number(),
  stages: z.record(stageSchema, z.number()),
  tasks: z.array(taskSchema),
  attention: z.array(carSchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
const commandBase = {
  commandId: z.uuid(),
  expectedVersion: z.number().int().positive(),
};
export const commandSchema = z.discriminatedUnion("action", [
  z.object({
    ...commandBase,
    action: z.literal("answer"),
    itemId: z.string().min(1).max(80),
    result: z.enum(["ok", "problem", "unable", "not_applicable"]),
    note: z.string().max(1000).default(""),
    evidenceId: z.uuid(),
    reading: z.number().nonnegative().nullable().default(null),
    applicabilityConfirmed: z.boolean().default(false),
  }),
  z.object({ ...commandBase, action: z.literal("submit") }),
  z.object({ ...commandBase, action: z.literal("takeover") }),
  z.object({
    ...commandBase,
    action: z.literal("assign"),
    assignedTo: z.uuid(),
  }),
  z.object({
    ...commandBase,
    action: z.literal("help"),
    itemId: z.string().max(80).optional(),
    note: z.string().max(1000).default(""),
  }),
  z.object({
    ...commandBase,
    action: z.literal("review"),
    decision: z.enum(["accept", "recheck"]),
    recheckItemIds: z.array(z.string()).max(1000).default([]),
    note: z.string().max(1000).default(""),
  }),
]);
export type TaskCommand = z.infer<typeof commandSchema>;
export const devSessionSchema = z.object({
  accessCode: z.string().min(12).max(200),
  account: z.enum(["owner", "employee"]),
});
export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  actor: actorSchema,
  mustChangeSecret: z.boolean().default(false),
  authentication: z.enum(["training", "password"]).default("training"),
});
export type Session = z.infer<typeof sessionSchema>;
export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});

export const templateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.enum(["pre_purchase", "intake", "repair_qc", "delivery"]),
  version: z.number(),
  approved: z.boolean(),
  items: z.array(itemSchema),
});
export type ChecklistTemplate = z.infer<typeof templateSchema>;
export const personSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.enum(["owner", "employee"]),
});
export type Person = z.infer<typeof personSchema>;
export const createCarSchema = z.object({
  commandId: z.uuid(),
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  registration: z.string().trim().min(3).max(24),
  year: z.number().int().min(1900).max(2200),
  odometerKm: z.number().int().min(0).max(3000000).nullable(),
  location: z.string().trim().min(1).max(120),
  assignedTo: z.uuid(),
  templateId: z.uuid(),
  dueAt: z.string().nullable(),
  configuration: vehicleConfigurationSchema.optional(),
  catalogueModelId: z.uuid().nullable().optional(),
});
export type CreateCar = z.infer<typeof createCarSchema>;
export const carCreatedSchema = z.object({ car: carSchema, task: taskSchema });
export const issueSchema = z.object({
  id: z.uuid(),
  carId: z.uuid(),
  description: z.string(),
  severity: z.enum(["normal", "urgent"]),
  status: z.enum(["open", "in_repair", "resolved"]),
  version: z.number(),
  sourceTaskId: z.uuid().nullable(),
  sourceItemId: z.string().nullable(),
  evidenceId: z.uuid().nullable(),
  jobId: z.uuid().nullable(),
  createdAt: z.string(),
});
export type Issue = z.infer<typeof issueSchema>;
export const workshopSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
});
export type Workshop = z.infer<typeof workshopSchema>;
export const partSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(["requested", "received"]),
  expectedAt: z.string().nullable(),
});
export const jobSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  carId: z.uuid(),
  car: carSchema,
  issueId: z.uuid(),
  title: z.string(),
  assignedTo: z.uuid(),
  assigneeName: z.string(),
  workshopId: z.uuid().nullable(),
  workshopName: z.string().nullable(),
  status: z.enum([
    "assigned",
    "in_progress",
    "waiting_parts",
    "awaiting_qc",
    "completed",
  ]),
  blocker: z.string(),
  dueAt: z.string().nullable(),
  version: z.number(),
  qcTaskId: z.uuid().nullable(),
  parts: z.array(partSchema),
  updatedAt: z.string(),
});
export type RepairJob = z.infer<typeof jobSchema>;
export const jobCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...commandBase, action: z.literal("start") }),
  z.object({
    ...commandBase,
    action: z.literal("wait_parts"),
    partName: z.string().max(160).default(""),
    expectedAt: z.string().nullable().default(null),
  }),
  z.object({
    ...commandBase,
    action: z.literal("receive_part"),
    partId: z.uuid(),
  }),
  z.object({ ...commandBase, action: z.literal("submit_repair") }),
  z.object({ ...commandBase, action: z.literal("reopen") }),
  z.object({
    ...commandBase,
    action: z.literal("assign"),
    assignedTo: z.uuid(),
  }),
]);
export type JobCommand = z.infer<typeof jobCommandSchema>;
export const historySchema = z.object({
  id: z.uuid(),
  actorName: z.string(),
  action: z.string(),
  summary: z.string(),
  createdAt: z.string(),
});
export type HistoryEntry = z.infer<typeof historySchema>;

export const moneyPaiseSchema = z.number().int().min(0).max(100000000000);
export const purchaseTermsSchema = z.object({
  sellerName: z.string().trim().min(1).max(120),
  sellerPhone: z.string().max(30),
  askingPricePaise: moneyPaiseSchema.nullable(),
  purchasePricePaise: moneyPaiseSchema.positive(),
  expectedResalePaise: moneyPaiseSchema.positive(),
  repairBudgetPaise: moneyPaiseSchema,
  directExpensesPaise: moneyPaiseSchema,
  notes: z.string().max(2000),
});
export type PurchaseTerms = z.infer<typeof purchaseTermsSchema>;
export const purchaseDocumentsSchema = z.object({
  sellerVerified: z.boolean(),
  registrationVerified: z.boolean(),
  ownershipVerified: z.boolean(),
  loanStatus: z.enum(["unknown", "no_loan", "pending", "cleared"]),
});
export type PurchaseDocuments = z.infer<typeof purchaseDocumentsSchema>;
export const purchaseReceiptSchema = z.object({
  location: z.string(),
  odometerKm: z.number().int(),
  fuel: z.enum([
    "unknown",
    "empty",
    "quarter",
    "half",
    "three_quarters",
    "full",
  ]),
  keyCount: z.number().int(),
  accessories: z.string(),
  conditionNote: z.string(),
  hasNewIssue: z.boolean(),
  handoverReference: z.string(),
  templateId: z.uuid(),
  assignedTo: z.uuid(),
});
export type PurchaseReceipt = z.infer<typeof purchaseReceiptSchema>;
export const purchaseSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  carId: z.uuid(),
  car: carSchema,
  status: z.enum(["draft", "submitted", "approved", "rejected", "acquired"]),
  version: z.number(),
  termsVersion: z.number(),
  currency: z.literal("INR"),
  terms: purchaseTermsSchema,
  documents: purchaseDocumentsSchema,
  preparedBy: z.uuid(),
  preparedByName: z.string(),
  submittedBy: z.uuid().nullable(),
  approvedBy: z.uuid().nullable(),
  approvalValid: z.boolean(),
  inspectionReady: z.boolean(),
  draftInspection: z.boolean(),
  inspections: z.array(
    z.object({
      id: z.uuid(),
      version: z.number(),
      status: z.string(),
      templateApproved: z.boolean(),
    }),
  ),
  documentsClear: z.boolean(),
  expectedContributionPaise: z.number().int(),
  paidPaise: moneyPaiseSchema,
  balancePaise: moneyPaiseSchema,
  payments: z.array(
    z.object({
      id: z.uuid(),
      amountPaise: moneyPaiseSchema.positive(),
      method: z.enum(["bank_transfer", "upi", "cash"]),
      reference: z.string(),
      paidAt: z.string(),
      recordedByName: z.string(),
      reversedAt: z.string().nullable(),
      reversalReason: z.string().nullable(),
      reversedByName: z.string().nullable(),
    }),
  ),
  approvals: z.array(
    z.object({
      id: z.uuid(),
      termsVersion: z.number(),
      decision: z.enum(["approve", "reject"]),
      reason: z.string(),
      actorName: z.string(),
      selfReview: z.boolean(),
      terms: purchaseTermsSchema,
      createdAt: z.string(),
    }),
  ),
  revisions: z.array(
    z.object({
      termsVersion: z.number(),
      terms: purchaseTermsSchema,
      preparedByName: z.string(),
      createdAt: z.string(),
    }),
  ),
  agreementReference: z.string().nullable(),
  acquiredAt: z.string().nullable(),
  receipt: purchaseReceiptSchema.nullable(),
  receivedAt: z.string().nullable(),
  intakeTaskId: z.uuid().nullable(),
  updatedAt: z.string(),
});
export type Purchase = z.infer<typeof purchaseSchema>;
import type { components as ApiComponents } from "./generated";
type PurchaseApi = ApiComponents["schemas"];
export type PurchaseCommand =
  | PurchaseApi["RevisePurchase"]
  | PurchaseApi["SubmitPurchase"]
  | PurchaseApi["ReviewPurchase"]
  | PurchaseApi["CheckPurchaseDocuments"]
  | PurchaseApi["RecordPurchasePayment"]
  | PurchaseApi["ReversePurchasePayment"]
  | PurchaseApi["AcquirePurchase"]
  | PurchaseApi["ReceivePurchase"];

export const saleDocumentsSchema = z.object({
  buyerVerified: z.boolean(),
  registrationReady: z.boolean(),
  saleAgreementReference: z.string(),
});
export const warrantyConfigurationSchema = z.object({
  durationMonths: z.union([z.literal(3), z.literal(6), z.literal(12)]),
  coveredComponents: z.array(z.string()),
  exclusions: z.string(),
  terms: z.string(),
  provider: z.string(),
  policyReference: z.string(),
  odometerLimitKm: z.number().int().nullable(),
});
export const warrantyTermsSchema = z.object({
  durationMonths: z
    .union([z.literal(3), z.literal(6), z.literal(12)])
    .nullable()
    .default(null),
  coveredComponents: z.array(z.string()).default([]),
  provider: z.string(),
  policyReference: z.string(),
  exclusions: z.string(),
  until: z.string().nullable(),
  odometerLimitKm: z.number().int().nullable(),
  terms: z.string(),
  noWarrantyAcknowledged: z.boolean(),
});
export const ledgerEntrySchema = z.object({
  id: z.uuid(),
  kind: z.enum(["cost", "receipt", "refund"]),
  category: z.enum([
    "repair",
    "parts",
    "transport",
    "documents",
    "other",
    "warranty",
    "customer",
  ]),
  amountPaise: moneyPaiseSchema,
  reference: z.string(),
  note: z.string(),
  bookingId: z.uuid().nullable(),
  claimId: z.uuid().nullable(),
  recordedByName: z.string(),
  occurredAt: z.string(),
  reversedAt: z.string().nullable(),
  reversalReason: z.string().nullable(),
});
export const saleBookingSchema = z.object({
  warrantyConfiguration: warrantyConfigurationSchema.nullable().default(null),
  id: z.uuid(),
  customerName: z.string(),
  customerPhone: z.string(),
  salePricePaise: moneyPaiseSchema,
  status: z.enum(["booked", "cancelled", "delivered"]),
  expiresAt: z.string(),
  expired: z.boolean(),
  documents: saleDocumentsSchema,
  cancellationReason: z.string().nullable(),
  collectedPaise: moneyPaiseSchema,
  refundedPaise: moneyPaiseSchema,
  balancePaise: moneyPaiseSchema,
  refundDuePaise: moneyPaiseSchema,
  delivery: z
    .object({
      deliveredAt: z.string(),
      keyCount: z.number().int().nullable(),
      accessories: z.string(),
      customerPromises: z.string(),
      customerAcknowledged: z.boolean(),
      odometerKm: z.number().int(),
      receiptReference: z.string(),
      warranty: warrantyTermsSchema,
      recordedByName: z.string(),
    })
    .nullable(),
  transfer: z
    .object({
      status: z.enum(["pending", "completed"]),
      dueAt: z.string(),
      reference: z.string(),
      completedAt: z.string().nullable(),
    })
    .nullable(),
  createdAt: z.string(),
});
export const warrantyClaimSchema = z.object({
  id: z.uuid(),
  bookingId: z.uuid(),
  description: z.string(),
  odometerKm: z.number().int().nullable(),
  status: z.enum(["open", "approved", "rejected", "closed"]),
  coverageObservation: z.enum([
    "within_recorded_limits",
    "outside_recorded_limits",
    "no_warranty",
    "needs_review",
  ]),
  approvedLimitPaise: moneyPaiseSchema,
  actualCostPaise: moneyPaiseSchema,
  decisionReason: z.string(),
  issueId: z.uuid().nullable(),
  issueResolved: z.boolean(),
  recordedByName: z.string(),
  reportedAt: z.string(),
});
export const vehicleBusinessSchema = z.object({
  car: carSchema,
  readiness: z.array(
    z.object({ id: z.string(), label: z.string(), clear: z.boolean() }),
  ),
  draftChecklists: z.boolean(),
  deliveryPdiClear: z.boolean(),
  draftDeliveryPdi: z.boolean(),
  purchasePricePaise: moneyPaiseSchema,
  sellerBalancePaise: moneyPaiseSchema,
  runningCostPaise: moneyPaiseSchema,
  warrantyCostPaise: moneyPaiseSchema,
  investedPaise: moneyPaiseSchema,
  ledger: z.array(ledgerEntrySchema),
  bookings: z.array(saleBookingSchema),
  claims: z.array(warrantyClaimSchema),
});
export type VehicleBusiness = z.infer<typeof vehicleBusinessSchema>;
export type SaleBooking = z.infer<typeof saleBookingSchema>;
export type WarrantyClaim = z.infer<typeof warrantyClaimSchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export const businessQueueItemSchema = z.object({
  car: carSchema,
  customerName: z.string().nullable(),
  refundDuePaise: moneyPaiseSchema,
  openClaims: z.number().int(),
  transferDueAt: z.string().nullable(),
  expiredBooking: z.boolean(),
});
export const businessQueueSchema = z.object({
  items: z.array(businessQueueItemSchema),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type BusinessQueue = z.infer<typeof businessQueueSchema>;
export const memberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.enum(["owner", "employee"]),
  workRoles: z.array(workRoleSchema).default(["inspector"]),
  active: z.boolean(),
  version: z.number().int(),
  username: z.string().nullable(),
  mustChangeSecret: z.boolean(),
});
export const teamSchema = z.object({
  dealerCode: z.string(),
  items: z.array(memberSchema),
});
export type Member = z.infer<typeof memberSchema>;
export type BusinessCommand =
  | PurchaseApi["MarkStockReady"]
  | PurchaseApi["RecordVehicleCost"]
  | PurchaseApi["ReverseLedgerEntry"]
  | PurchaseApi["BookVehicle"]
  | PurchaseApi["CancelBooking"]
  | PurchaseApi["ExtendBooking"]
  | PurchaseApi["SaleMoney"]
  | PurchaseApi["CheckSaleDocuments"]
  | PurchaseApi["ConfigureWarranty"]
  | PurchaseApi["DeliverVehicle"]
  | PurchaseApi["CompleteOwnershipTransfer"]
  | PurchaseApi["OpenWarrantyClaim"]
  | PurchaseApi["ReviewWarrantyClaim"]
  | PurchaseApi["CloseWarrantyClaim"];

export const quoteLineSchema = z.object({
  description: z.string(),
  quantity: z.number().int(),
  unitPaise: moneyPaiseSchema,
});
export const repairQuoteSchema = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  lines: z.array(quoteLineSchema),
  chargesPaise: moneyPaiseSchema,
  totalPaise: moneyPaiseSchema,
  note: z.string(),
  decision: z.enum(["pending", "approved", "rejected"]),
  reason: z.string(),
  recordedByName: z.string(),
  approvedByName: z.string().nullable(),
  createdAt: z.string(),
});
export const serviceInvoiceSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  amountPaise: moneyPaiseSchema,
  occurredAt: z.string(),
  recordedByName: z.string(),
  quoteId: z.uuid(),
  reversed: z.boolean(),
});
export const vendorPaymentSchema = z.object({
  id: z.uuid(),
  reversed: z.boolean(),
  reference: z.string(),
  amountPaise: moneyPaiseSchema,
  note: z.string(),
  occurredAt: z.string(),
  recordedByName: z.string(),
});
export const serviceFinanceSchema = z.object({
  job: jobSchema,
  quotes: z.array(repairQuoteSchema),
  invoices: z.array(serviceInvoiceSchema),
  payments: z.array(vendorPaymentSchema),
  invoiceTotalPaise: moneyPaiseSchema,
  paidPaise: moneyPaiseSchema,
  balancePaise: moneyPaiseSchema,
  advancePaise: moneyPaiseSchema,
});
export type ServiceFinance = z.infer<typeof serviceFinanceSchema>;
export type ServiceFinanceCommand =
  | PurchaseApi["ProposeRepairQuote"]
  | PurchaseApi["DecideRepairQuote"]
  | PurchaseApi["RecordRepairInvoice"]
  | PurchaseApi["RecordVendorPayment"]
  | PurchaseApi["CorrectVendorPayment"];

export const enquirySchema = z.object({
  id: z.uuid(),
  kind: z.enum(["seller", "buyer"]),
  name: z.string(),
  phone: z.string(),
  source: z.string(),
  interest: z.string(),
  carId: z.uuid().nullable(),
  status: z.enum(["open", "appointment", "negotiation", "won", "lost"]),
  assignedTo: z.uuid(),
  assigneeName: z.string(),
  nextFollowUpAt: z.string().nullable(),
  lastContactAt: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const enquiryDetailSchema = z.object({
  enquiry: enquirySchema,
  events: z.array(
    z.object({
      id: z.uuid(),
      kind: z.string(),
      note: z.string(),
      recordedByName: z.string(),
      createdAt: z.string(),
    }),
  ),
  appointments: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(["viewing", "inspection", "test_drive"]),
      scheduledAt: z.string(),
      status: z.enum(["scheduled", "completed", "cancelled"]),
      driverName: z.string(),
      licenseChecked: z.boolean(),
      outcome: z.string(),
      completedAt: z.string().nullable(),
    }),
  ),
});
export const enquiriesSchema = z.object({
  items: z.array(enquirySchema),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type Enquiry = z.infer<typeof enquirySchema>;
export type EnquiryDetail = z.infer<typeof enquiryDetailSchema>;
export type EnquiryCommand =
  | PurchaseApi["RecordContact"]
  | PurchaseApi["EnquiryStatus"]
  | PurchaseApi["AssignEnquiry"]
  | PurchaseApi["LinkEnquiryCar"]
  | PurchaseApi["ScheduleAppointment"]
  | PurchaseApi["FinishAppointment"];
export type CreateEnquiry = PurchaseApi["CreateEnquiry"];

export const stockRecordSchema = z.object({
  car: carSchema,
  custodyKind: z.enum(["yard", "workshop", "test_drive", "customer"]),
  custodianName: z.string().nullable(),
  movements: z.array(
    z.object({
      id: z.uuid(),
      fromKind: z.string(),
      fromLocation: z.string(),
      toKind: z.enum(["yard", "workshop", "test_drive", "customer"]),
      toLocation: z.string(),
      custodianName: z.string(),
      receiverName: z.string(),
      odometerKm: z.number().int(),
      keysCount: z.number().int(),
      fuelPercent: z.number().int(),
      note: z.string(),
      recordedByName: z.string(),
      createdAt: z.string(),
    }),
  ),
  holds: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(["safety", "documents", "other"]),
      reason: z.string(),
      recordedByName: z.string(),
      createdAt: z.string(),
      resolvedByName: z.string().nullable(),
      resolvedAt: z.string().nullable(),
      resolution: z.string(),
    }),
  ),
  testDrives: z.array(
    z.object({ id: z.uuid(), driverName: z.string(), scheduledAt: z.string() }),
  ),
});
export type StockRecord = z.infer<typeof stockRecordSchema>;
export type StockCommand =
  | PurchaseApi["MoveStock"]
  | PurchaseApi["HoldStock"]
  | PurchaseApi["ReleaseStockHold"];

export const inboxSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      kind: z.string(),
      targetType: z.enum([
        "task",
        "job",
        "car",
        "enquiry",
        "purchase",
        "business",
      ]),
      targetId: z.uuid(),
      createdAt: z.string(),
      readAt: z.string().nullable(),
    }),
  ),
  unread: z.number().int(),
  cutoff: z.string(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type Inbox = z.infer<typeof inboxSchema>;

export const documentSchema = z.object({
  id: z.uuid(),
  recordedById: z.uuid(),
  carId: z.uuid(),
  category: z.enum([
    "registration",
    "purchase",
    "invoice",
    "payment",
    "sale",
    "warranty",
    "transfer",
    "other",
  ]),
  title: z.string(),
  reference: z.string(),
  jobId: z.uuid().nullable(),
  bookingId: z.uuid().nullable(),
  supersedesId: z.uuid().nullable(),
  width: z.number().int(),
  height: z.number().int(),
  bytes: z.number().int(),
  sha256: z.string(),
  profile: z.literal("photo-fhd-v1"),
  recordedByName: z.string(),
  createdAt: z.string(),
  status: z.enum(["uploaded", "accepted", "rejected"]),
  version: z.number().int(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewReason: z.string(),
  selfReview: z.boolean(),
});
export const documentsSchema = z.object({
  car: carSchema,
  items: z.array(documentSchema),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type CarDocument = z.infer<typeof documentSchema>;
export type ReviewDocument = PurchaseApi["ReviewDocument"];

export type AssistantInput = PurchaseApi["AssistantInput"];
export type AICapability = AssistantInput["capability"];
export const aiContentSchema = z.object({
  summary: z.string(),
  fields: z.array(
    z.object({
      name: z.string(),
      value: z.string().nullable(),
      basis: z.enum(["reported", "observed", "uncertain"]),
      sourceIds: z.array(z.string()),
    }),
  ),
  unknowns: z.array(z.string()),
  checks: z.array(z.string()),
  sourceIds: z.array(z.string()),
});
export const assistantDraftSchema = z.object({
  id: z.uuid(),
  capability: z.enum([
    "voice_log",
    "scan_fields",
    "evidence_guide",
    "owner_brief",
    "quote_review",
    "voice_task",
    "repair_compare",
    "handover_brief",
  ]),
  status: z.enum(["queued", "running", "completed", "failed", "stale"]),
  content: aiContentSchema.nullable(),
  sources: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      targetType: z.enum([
        "car",
        "task",
        "business",
        "document",
        "input",
        "dashboard",
      ]),
      targetId: z.uuid().nullable(),
      version: z.number().nullable(),
    }),
  ),
  cutoff: z.string(),
  sourceHash: z.string(),
  stale: z.boolean(),
  review: z.enum(["accepted", "rejected"]).nullable(),
  errorCode: z.string().nullable(),
  model: z.string(),
  promptVersion: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
});
export type AssistantDraft = z.infer<typeof assistantDraftSchema>;
export const assistantOptionsSchema = z.object({
  enabled: z.boolean(),
  model: z.string(),
  capabilities: z.array(assistantDraftSchema.shape.capability),
  maxImages: z.number(),
  requestsPerDay: z.number(),
});

export const videoClipSchema = z.object({
  id: z.uuid(),
  taskId: z.uuid(),
  itemId: z.string(),
  width: z.number(),
  height: z.number(),
  durationMs: z.number(),
  bytes: z.number(),
  sha256: z.string(),
  profile: z.literal("video-720-v1"),
  recordedByName: z.string(),
  createdAt: z.string(),
});
export const videoClipsSchema = z.object({ items: z.array(videoClipSchema) });
export type VideoClip = z.infer<typeof videoClipSchema>;

export const decisionItemSchema = z.object({
  id: z.uuid(),
  kind: z.enum([
    "inspection",
    "help",
    "purchase",
    "quote",
    "document",
    "claim",
    "hold",
  ]),
  carId: z.uuid(),
  carLabel: z.string(),
  title: z.string(),
  targetType: z.enum([
    "task",
    "purchase",
    "service_finance",
    "documents",
    "business",
    "stock",
  ]),
  targetId: z.uuid(),
  createdAt: z.string(),
});
export const decisionsSchema = z.object({
  items: z.array(decisionItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});
export type DecisionItem = z.infer<typeof decisionItemSchema>;

export const checklistItemInputSchema = itemSchema.extend({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  title: z.string().trim().min(1).max(160),
  titleHi: z.string().trim().min(1).max(160),
  instruction: z.string().trim().min(1).max(1000),
  instructionHi: z.string().trim().min(1).max(1000),
  order: z.number().int().min(1).max(1000),
});
export const createChecklistRevisionSchema = z.object({
  commandId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  kind: templateSchema.shape.kind,
  basedOnId: z.uuid().nullable(),
  reason: z.string().trim().min(1).max(1000),
  items: z.array(checklistItemInputSchema).min(1).max(1000),
});
export type CreateChecklistRevision = z.infer<
  typeof createChecklistRevisionSchema
>;
export const approveChecklistSchema = z.object({
  commandId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000),
  instructionsReviewed: z.boolean(),
});
export type ApproveChecklist = z.infer<typeof approveChecklistSchema>;
export const managedChecklistSchema = z.object({
  template: templateSchema,
  basedOnId: z.uuid().nullable(),
  createdBy: z.uuid().nullable(),
  creatorName: z.string().nullable(),
  createdAt: z.string(),
  revisionReason: z.string(),
  approval: z
    .object({
      approvedBy: z.uuid(),
      reviewerName: z.string(),
      reason: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
});
export type ManagedChecklist = z.infer<typeof managedChecklistSchema>;
export const managedChecklistsSchema = z.object({
  items: z.array(managedChecklistSchema),
});

export { checkState, inspectionProgress } from "./inspection";

export { can, workingLevel } from "./access";

export const documentRuleSchema = z.object({
  id: z.string(),
  stage: z.enum(["purchase", "intake", "sale", "delivery"]),
  title: z.string(),
  titleHi: z.string(),
  titleMr: z.string(),
  required: z.boolean(),
  applicability: z.string(),
});
export const documentPolicySchema = z.object({
  version: z.number().int(),
  rules: z.array(documentRuleSchema),
  publishedByName: z.string().nullable(),
  publishedAt: z.string().nullable(),
  reason: z.string(),
});
export const carRequirementsSchema = z.object({
  sets: z.array(
    z.object({
      id: z.uuid(),
      stage: z.enum(["purchase", "intake", "sale", "delivery"]),
      bookingId: z.uuid().nullable(),
      bookingLabel: z.string().nullable().default(null),
      locked: z.boolean().default(false),
      policyVersion: z.number().int(),
      enforced: z.boolean(),
      clear: z.boolean(),
      items: z.array(
        z.object({
          rule: documentRuleSchema,
          status: z.enum(["missing", "pending", "accepted", "rejected"]),
          documentId: z.uuid().nullable(),
          documentTitle: z.string().nullable(),
          reviewedByName: z.string().nullable(),
        }),
      ),
    }),
  ),
});
export type DocumentRule = z.infer<typeof documentRuleSchema>;
export type DocumentPolicy = z.infer<typeof documentPolicySchema>;
export type CarRequirements = z.infer<typeof carRequirementsSchema>;
export type PublishDocumentPolicy = PurchaseApi["PublishDocumentPolicy"];
export type AssignRequirements = PurchaseApi["AssignRequirements"];
export type LinkRequirement = PurchaseApi["LinkRequirement"];
