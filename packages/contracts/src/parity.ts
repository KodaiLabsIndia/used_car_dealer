// Compile-time guard: Python's generated API output and the mobile validators agree.
import type { components } from "./generated";
import type {
  Actor,
  Car,
  Dashboard,
  Evidence,
  Session,
  Task,
  TaskCommand,
} from "./index";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Schema = components["schemas"];
export type OperationsReportParity = Assert<
  Equal<import("./index").OperationsReport, Schema["OperationsReport"]>
>;
export type ActorParity = Assert<Equal<Actor, Schema["Actor"]>>;
export type CarParity = Assert<Equal<Car, Schema["Car"]>>;
export type DashboardParity = Assert<Equal<Dashboard, Schema["Dashboard"]>>;
export type EvidenceParity = Assert<Equal<Evidence, Schema["Evidence"]>>;
export type SessionParity = Assert<Equal<Session, Schema["Session"]>>;
export type TaskParity = Assert<Equal<Task, Schema["Task"]>>;
type ApiCommand =
  | Schema["AnswerCommand"]
  | Schema["SubmitCommand"]
  | Schema["TakeoverCommand"]
  | Schema["ReassignCommand"]
  | Schema["HelpCommand"]
  | Schema["ReviewCommand"];
// JSON serialization omits undefined optional properties before transmission.
type WireCommand<T> = { [K in keyof T]: Exclude<T[K], undefined> };
export type CommandParity = Assert<
  WireCommand<TaskCommand> extends ApiCommand ? true : false
>;

import type {
  ChecklistTemplate,
  Person,
  Issue,
  RepairJob,
  Workshop,
  HistoryEntry,
} from "./index";
export type TemplateParity = Assert<
  Equal<ChecklistTemplate, Schema["ChecklistTemplate"]>
>;
export type PersonParity = Assert<Equal<Person, Schema["Person"]>>;
export type IssueParity = Assert<Equal<Issue, Schema["Issue"]>>;
export type JobParity = Assert<Equal<RepairJob, Schema["RepairJob"]>>;
export type WorkshopParity = Assert<Equal<Workshop, Schema["Workshop"]>>;
export type HistoryParity = Assert<Equal<HistoryEntry, Schema["HistoryEntry"]>>;

import type {
  Purchase,
  PurchaseTerms,
  PurchaseDocuments,
  PurchaseReceipt,
} from "./index";
export type PurchaseParity = Assert<Equal<Purchase, Schema["Purchase"]>>;
export type PurchaseTermsParity = Assert<
  Equal<PurchaseTerms, Schema["PurchaseTerms-Output"]>
>;
export type PurchaseDocumentsParity = Assert<
  Equal<PurchaseDocuments, Schema["PurchaseDocuments-Output"]>
>;
export type PurchaseReceiptParity = Assert<
  Equal<PurchaseReceipt, Schema["PurchaseReceipt-Output"]>
>;

import type {
  VehicleBusiness,
  SaleBooking,
  WarrantyClaim,
  LedgerEntry,
} from "./index";
export type VehicleBusinessParity = Assert<
  Equal<VehicleBusiness, Schema["VehicleBusiness"]>
>;
export type SaleBookingParity = Assert<
  Equal<SaleBooking, Schema["SaleBooking"]>
>;
export type WarrantyClaimParity = Assert<
  Equal<WarrantyClaim, Schema["WarrantyClaim"]>
>;
export type LedgerEntryParity = Assert<
  Equal<LedgerEntry, Schema["LedgerEntry"]>
>;
import type { BusinessQueue } from "./index";
export type BusinessQueueParity = Assert<
  Equal<BusinessQueue, Schema["BusinessQueue"]>
>;

import type { ServiceFinance } from "./index";
export type ServiceFinanceParity = Assert<
  Equal<ServiceFinance, Schema["ServiceFinance"]>
>;

import type { EnquiryDetail } from "./index";
export type EnquiryDetailParity = Assert<
  Equal<EnquiryDetail, Schema["EnquiryDetail"]>
>;

import type { StockRecord } from "./index";
export type StockParity = Assert<Equal<StockRecord, Schema["StockRecord"]>>;

import type { Inbox } from "./index";
export type InboxParity = Assert<Equal<Inbox, Schema["Inbox"]>>;

import type { CarDocument } from "./index";
export type DocumentParity = Assert<Equal<CarDocument, Schema["Document"]>>;

import type { AssistantDraft, VideoClip } from "./index";
export type AssistantDraftParity = Assert<
  Equal<AssistantDraft, Schema["AssistantDraft"]>
>;
export type VideoClipParity = Assert<Equal<VideoClip, Schema["VideoClip"]>>;

import type {
  ManagedChecklist,
  CreateChecklistRevision,
  ApproveChecklist,
} from "./index";
export type ManagedChecklistParity = Assert<
  Equal<ManagedChecklist, Schema["ManagedChecklist"]>
>;
export type ChecklistRevisionParity = Assert<
  CreateChecklistRevision extends Schema["CreateChecklistRevision"]
    ? true
    : false
>;
export type ChecklistApproveParity = Assert<
  Equal<ApproveChecklist, Schema["ApproveChecklist"]>
>;
