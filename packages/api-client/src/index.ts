import {
  cataloguePageSchema,
  type VehicleConfiguration,
  managedChecklistsSchema,
  managedChecklistSchema,
  type CreateChecklistRevision,
  type ApproveChecklist,
} from "@arihant/contracts";
import { decisionsSchema } from "@arihant/contracts";
import { operationsReportSchema } from "@arihant/contracts";
import { videoClipSchema, videoClipsSchema } from "@arihant/contracts";
import {
  assistantDraftSchema,
  assistantOptionsSchema,
  type AssistantInput,
} from "@arihant/contracts";
import {
  documentsSchema,
  documentSchema,
  type ReviewDocument,
} from "@arihant/contracts";
import { inboxSchema } from "@arihant/contracts";
import { stockRecordSchema, type StockCommand } from "@arihant/contracts";
import {
  enquiriesSchema,
  enquiryDetailSchema,
  type CreateEnquiry,
  type EnquiryCommand,
} from "@arihant/contracts";
import {
  serviceFinanceSchema,
  type ServiceFinanceCommand,
} from "@arihant/contracts";
import {
  vehicleBusinessSchema,
  businessQueueSchema,
  memberSchema,
  teamSchema,
  type BusinessCommand,
  actorSchema,
  carSchema,
  dashboardSchema,
  evidenceSchema,
  sessionSchema,
  taskSchema,
  purchaseSchema,
  type PurchaseTerms,
  type PurchaseCommand,
  templateSchema,
  personSchema,
  carCreatedSchema,
  issueSchema,
  workshopSchema,
  jobSchema,
  historySchema,
  type CreateCar,
  type JobCommand,
  type TaskCommand,
  type Session,
  type Stage,
} from "@arihant/contracts";
import { z } from "zod";
export const API_URL = "http://localhost:4100";
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
export class ApiClient {
  async vehicleCatalogue(query = "", offset = 0) {
    return cataloguePageSchema.parse(
      await this.request(
        `/catalogue/vehicles?query=${encodeURIComponent(query)}&offset=${offset}&limit=40`,
      ),
    );
  }
  async operationsReport(scope = "all", search = "", offset = 0) {
    return operationsReportSchema.parse(
      await this.request(
        `/reports/operations?scope=${encodeURIComponent(scope)}&search=${encodeURIComponent(search)}&offset=${offset}&limit=30`,
      ),
    );
  }
  async exportOperationsReport(scope = "all", search = "") {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(
        `${this.url}/v1/reports/operations.csv?scope=${encodeURIComponent(scope)}&search=${encodeURIComponent(search)}`,
        {
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
          signal: controller.signal,
        },
      );
      if (response.status === 401 && this.token) this.onUnauthorized?.();
      if (!response.ok)
        throw new ApiError(
          "Could not export this report. Try a narrower filter.",
          "EXPORT_FAILED",
          response.status,
        );
      return await response.blob();
    } finally {
      clearTimeout(timer);
    }
  }
  constructor(
    readonly token: string | null,
    readonly url = API_URL,
    protected readonly onUnauthorized?: () => void,
  ) {}
  async request(path: string, init: RequestInit = {}) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`${this.url}/v1${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(init.body && !(init.body instanceof FormData)
            ? { "Content-Type": "application/json" }
            : {}),
          ...init.headers,
        },
      });
      if (response.status === 204) return null;
      const body = await response.json().catch(() => null);
      if (response.status === 401 && this.token) this.onUnauthorized?.();
      if (!response.ok)
        throw new ApiError(
          body?.error?.message || "Please try again.",
          body?.error?.code || "REQUEST_FAILED",
          response.status,
        );
      if (body === null)
        throw new ApiError(
          "The server returned an unreadable response. Please try again.",
          "INVALID_RESPONSE",
          response.status,
        );
      return body as unknown;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        "Could not connect. Your saved work stays on this phone.",
        "OFFLINE",
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async signIn(
    accessCode: string,
    account: "owner" | "employee",
  ): Promise<Session> {
    return sessionSchema.parse(
      await this.request("/auth/dev-session", {
        method: "POST",
        body: JSON.stringify({ accessCode, account }),
      }),
    );
  }
  async me() {
    return actorSchema.parse(await this.request("/me"));
  }
  async authOptions() {
    return z
      .object({ staffLogin: z.boolean(), trainingLogin: z.boolean() })
      .parse(await this.request("/auth/options"));
  }
  async signInPassword(dealerCode: string, username: string, secret: string) {
    return sessionSchema.parse(
      await this.request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ dealerCode, username, secret }),
      }),
    );
  }
  async changeSecret(currentSecret: string, newSecret: string) {
    return sessionSchema.parse(
      await this.request("/auth/change-secret", {
        method: "POST",
        body: JSON.stringify({ currentSecret, newSecret }),
      }),
    );
  }
  async serviceFinance(id: string) {
    return serviceFinanceSchema.parse(
      await this.request(`/jobs/${id}/finance`),
    );
  }
  async serviceFinanceCommand(id: string, body: ServiceFinanceCommand) {
    return serviceFinanceSchema.parse(
      await this.request(`/jobs/${id}/finance/commands`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async enquiries(scope: "all" | "mine" | "due", search = "", offset = 0) {
    return enquiriesSchema.parse(
      await this.request(
        `/enquiries?scope=${scope}&search=${encodeURIComponent(search)}&limit=30&offset=${offset}`,
      ),
    );
  }
  async enquiry(id: string) {
    return enquiryDetailSchema.parse(await this.request(`/enquiries/${id}`));
  }
  async createEnquiry(body: CreateEnquiry) {
    return enquiryDetailSchema.parse(
      await this.request("/enquiries", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async enquiryCommand(id: string, body: EnquiryCommand) {
    return enquiryDetailSchema.parse(
      await this.request(`/enquiries/${id}/commands`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async stock(id: string) {
    return stockRecordSchema.parse(await this.request(`/cars/${id}/stock`));
  }
  async stockCommand(id: string, body: StockCommand) {
    return stockRecordSchema.parse(
      await this.request(`/cars/${id}/stock/commands`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async inbox(unreadOnly = false, offset = 0) {
    return inboxSchema.parse(
      await this.request(
        `/notifications?unread_only=${unreadOnly}&offset=${offset}&limit=30`,
      ),
    );
  }
  async readNotifications(through: string, notificationId?: string) {
    await this.request("/notifications/read", {
      method: "POST",
      body: JSON.stringify({ through, notificationId: notificationId ?? null }),
    });
  }
  async documents(carId: string, offset = 0) {
    return documentsSchema.parse(
      await this.request(`/cars/${carId}/documents?offset=${offset}&limit=30`),
    );
  }
  async uploadDocument(
    carId: string,
    id: string,
    uri: string,
    metadata: object,
  ) {
    return documentSchema.parse(
      await this.uploadPreparedFile(
        `/cars/${carId}/documents/${id}`,
        uri,
        "image/jpeg",
        { metadata: JSON.stringify(metadata) },
      ),
    );
  }

  async reviewDocument(id: string, body: ReviewDocument) {
    return documentSchema.parse(
      await this.request(`/documents/${id}/review`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  documentUri(id: string) {
    return {
      uri: `${this.url}/v1/documents/${id}/file`,
      headers: { Authorization: `Bearer ${this.token}` },
    };
  }
  async clips(taskId: string) {
    return videoClipsSchema.parse(await this.request(`/tasks/${taskId}/clips`));
  }
  async uploadClip(taskId: string, itemId: string, id: string, uri: string) {
    return videoClipSchema.parse(
      await this.uploadPreparedFile(
        `/tasks/${taskId}/items/${encodeURIComponent(itemId)}/clips/${id}`,
        uri,
        "video/mp4",
      ),
    );
  }

  clipUri(id: string) {
    return {
      uri: `${this.url}/v1/clips/${id}/file`,
      headers: { Authorization: `Bearer ${this.token}` },
    };
  }
  async assistantOptions() {
    return assistantOptionsSchema.parse(
      await this.request("/assistant/options"),
    );
  }
  async createAssistantDraft(body: AssistantInput) {
    return assistantDraftSchema.parse(
      await this.request("/assistant/drafts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async assistantDraft(id: string) {
    return assistantDraftSchema.parse(
      await this.request(`/assistant/drafts/${id}`),
    );
  }
  async reviewAssistant(
    id: string,
    decision: "accepted" | "rejected",
    humanReviewed: boolean,
  ) {
    return assistantDraftSchema.parse(
      await this.request(`/assistant/drafts/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, humanReviewed }),
      }),
    );
  }
  async team() {
    return teamSchema.parse(await this.request("/team"));
  }
  async createStaff(body: {
    commandId: string;
    name: string;
    username: string;
    temporarySecret: string;
    workRoles?: import("@arihant/contracts").WorkRole[];
  }) {
    return memberSchema.parse(
      await this.request("/team", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async setupLogin(body: {
    commandId: string;
    username: string;
    secret: string;
  }) {
    return memberSchema.parse(
      await this.request("/auth/setup-login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async teamCommand(id: string, body: object) {
    return memberSchema.parse(
      await this.request(`/team/${id}/commands`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async logout() {
    await this.request("/session", { method: "DELETE" });
  }
  async decisions(offset = 0) {
    return decisionsSchema.parse(
      await this.request(`/decisions?limit=30&offset=${offset}`),
    );
  }
  async dashboard() {
    return dashboardSchema.parse(await this.request("/dashboard"));
  }
  async cars(search = "", stage?: Stage, offset = 0) {
    const query = new URLSearchParams({
      search,
      offset: String(offset),
      limit: "50",
      ...(stage ? { stage } : {}),
    });
    return z
      .object({
        items: z.array(carSchema),
        limit: z.number(),
        offset: z.number(),
      })
      .parse(await this.request(`/cars?${query}`));
  }
  async car(id: string) {
    return carSchema.parse(await this.request(`/cars/${id}`));
  }
  async vehicleBusiness(id: string) {
    return vehicleBusinessSchema.parse(
      await this.request(`/cars/${id}/business`),
    );
  }
  async businessQueue(
    search: string,
    scope: "all" | "booked" | "support" | "attention",
    offset = 0,
  ) {
    return businessQueueSchema.parse(
      await this.request(
        `/business?${new URLSearchParams({ search, scope, offset: String(offset), limit: "30" })}`,
      ),
    );
  }
  async businessCommand(id: string, command: BusinessCommand) {
    return vehicleBusinessSchema.parse(
      await this.request(`/cars/${id}/business/commands`, {
        method: "POST",
        body: JSON.stringify(command),
      }),
    );
  }
  async tasks(scope: "all" | "mine" | "decisions" = "all") {
    return z
      .object({ items: z.array(taskSchema) })
      .parse(await this.request(`/tasks?scope=${scope}`)).items;
  }
  async task(id: string) {
    return taskSchema.parse(await this.request(`/tasks/${id}`));
  }
  async command(id: string, command: TaskCommand) {
    return taskSchema.parse(
      await this.request(`/tasks/${id}/commands`, {
        method: "POST",
        body: JSON.stringify(command),
      }),
    );
  }
  async people() {
    return z
      .object({ items: z.array(personSchema) })
      .parse(await this.request("/people")).items;
  }
  async managedChecklists() {
    return managedChecklistsSchema.parse(
      await this.request("/checklists/manage"),
    );
  }
  async createChecklistRevision(body: CreateChecklistRevision) {
    return managedChecklistSchema.parse(
      await this.request("/checklists/revisions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async approveChecklist(id: string, body: ApproveChecklist) {
    return managedChecklistSchema.parse(
      await this.request(`/checklists/${id}/approve`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async templates() {
    return z
      .object({ items: z.array(templateSchema) })
      .parse(await this.request("/checklists")).items;
  }
  async createCar(body: CreateCar) {
    return carCreatedSchema.parse(
      await this.request("/cars", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async createInspection(
    carId: string,
    body: {
      commandId: string;
      templateId: string;
      assignedTo: string;
      dueAt: string | null;
      configuration?: VehicleConfiguration;
    },
  ) {
    return taskSchema.parse(
      await this.request(`/cars/${carId}/inspections`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async issues(carId: string) {
    return z
      .object({ items: z.array(issueSchema) })
      .parse(await this.request(`/cars/${carId}/issues`)).items;
  }
  async createIssue(
    carId: string,
    body: {
      commandId: string;
      expectedVersion: number;
      description: string;
      severity: "normal" | "urgent";
    },
  ) {
    return issueSchema.parse(
      await this.request(`/cars/${carId}/issues`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async workshops() {
    return z
      .object({ items: z.array(workshopSchema) })
      .parse(await this.request("/workshops")).items;
  }
  async createWorkshop(body: {
    commandId: string;
    name: string;
    phone: string;
  }) {
    return workshopSchema.parse(
      await this.request("/workshops", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async createJob(
    issueId: string,
    body: {
      commandId: string;
      expectedVersion: number;
      assignedTo: string;
      workshopId: string | null;
      dueAt: string | null;
    },
  ) {
    return jobSchema.parse(
      await this.request(`/issues/${issueId}/repairs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async jobs(carId?: string) {
    return z
      .object({ items: z.array(jobSchema) })
      .parse(await this.request(`/jobs${carId ? `?carId=${carId}` : ""}`))
      .items;
  }
  async job(id: string) {
    return jobSchema.parse(await this.request(`/jobs/${id}`));
  }
  async jobCommand(id: string, body: JobCommand) {
    return jobSchema.parse(
      await this.request(`/jobs/${id}/commands`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async history(carId: string) {
    return z
      .object({ items: z.array(historySchema) })
      .parse(await this.request(`/cars/${carId}/history`)).items;
  }
  async purchases(decisions = false) {
    return z
      .object({ items: z.array(purchaseSchema) })
      .parse(await this.request(`/purchases?decisions=${decisions}`)).items;
  }
  async purchaseForCar(carId: string) {
    return z
      .object({ purchase: purchaseSchema.nullable() })
      .parse(await this.request(`/cars/${carId}/purchase`)).purchase;
  }
  async createPurchase(
    carId: string,
    body: { commandId: string; expectedVersion: number; terms: PurchaseTerms },
  ) {
    return purchaseSchema.parse(
      await this.request(`/cars/${carId}/purchase`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async purchaseCommand(id: string, body: PurchaseCommand) {
    return purchaseSchema.parse(
      await this.request(`/purchases/${id}/commands`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }
  async upload(taskId: string, itemId: string, id: string, uri: string) {
    return evidenceSchema.parse(
      await this.uploadPreparedFile(
        `/tasks/${taskId}/items/${encodeURIComponent(itemId)}/evidence/${id}`,
        uri,
        "image/jpeg",
      ),
    );
  }
  protected async uploadPreparedFile(
    _path: string,
    _uri: string,
    _mime: string,
    _parameters?: Record<string, string>,
  ): Promise<unknown> {
    throw new ApiError(
      "Capture and upload evidence through the mobile app.",
      "MOBILE_CAPTURE_REQUIRED",
      400,
    );
  }

  evidenceUri(id: string) {
    return {
      uri: `${this.url}/v1/evidence/${id}`,
      headers: { Authorization: `Bearer ${this.token}` },
    };
  }
}
