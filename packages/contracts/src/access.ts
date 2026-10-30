import type { Actor, WorkRole } from "./index";
const supervisors: WorkRole[] = ["supervisor", "manager"];
const rules = {
  stock_catalog: ["sales", ...supervisors],
  leads: ["inspector", "sales", "coordinator", ...supervisors],
  lead_admin: supervisors,
  overview: supervisors,
  intake: supervisors,
  assign_inspection: supervisors,
  review_inspection: supervisors,
  service: supervisors,
  finance: supervisors,
} satisfies Record<string, WorkRole[]>;
export function can(
  actor: Pick<Actor, "role" | "workRoles">,
  capability: keyof typeof rules,
): boolean {
  return (
    actor.role === "owner" ||
    actor.workRoles.some((role) =>
      (rules[capability] as WorkRole[]).includes(role),
    )
  );
}
export function workingLevel(
  actor: Pick<Actor, "role" | "workRoles">,
): "owner" | "supervisor" | "employee" {
  return actor.role === "owner"
    ? "owner"
    : can(actor, "overview")
      ? "supervisor"
      : "employee";
}
