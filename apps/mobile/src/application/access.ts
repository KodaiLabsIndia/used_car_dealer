import type { Actor, WorkRole } from "@arihant/contracts";
const rules = {
  leads: ["sales", "manager"],
  lead_admin: ["manager"],
  overview: ["coordinator", "supervisor", "manager"],
  intake: ["manager"],
  assign_inspection: ["supervisor", "manager"],
  review_inspection: ["supervisor", "manager"],
  service: ["coordinator", "supervisor", "manager"],
} satisfies Record<string, WorkRole[]>;
export function can(actor: Actor, capability: keyof typeof rules): boolean {
  return (
    actor.role === "owner" ||
    actor.workRoles.some((role) =>
      (rules[capability] as WorkRole[]).includes(role),
    )
  );
}
