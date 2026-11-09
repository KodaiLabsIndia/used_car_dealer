import type { RootStack } from "../navigation";
export type MainSection = "home" | "cars" | "work" | "staff" | "review" | "me";
export type CurrentScreen = {
  name: string;
  params?: Record<string, unknown> | undefined;
};
export function mainSection(
  screen: CurrentScreen,
  oversight: boolean,
): MainSection {
  if (screen.name === "Home") {
    if (oversight) return screen.params?.area === "people" ? "staff" : "home";
    return screen.params?.employeeArea === "me" ? "me" : "home";
  }
  if (screen.name === "Work" && oversight && screen.params?.personId)
    return "staff";
  if (
    [
      "Work",
      "Task",
      "InspectionAllocation",
      "AssignInspection",
      "Routines",
      "Jobs",
      "Job",
      "AssignRepair",
      "Workshops",
      "ServiceFinance",
      "Scan",
      "Clips",
      "Help",
    ].includes(screen.name)
  )
    return "work";
  if (["Workforce", "Team"].includes(screen.name))
    return oversight ? "staff" : "me";
  if (["Settings", "Security"].includes(screen.name))
    return oversight ? "home" : "me";
  if (screen.name === "Decisions") return oversight ? "review" : "me";
  if (
    [
      "Cars",
      "Car",
      "AddCar",
      "Purchases",
      "Purchase",
      "Business",
      "BusinessBoard",
      "Enquiries",
      "Enquiry",
      "Stock",
      "Documents",
    ].includes(screen.name)
  )
    return oversight ? "cars" : "work";
  return "home";
}
export type MainDestination = {
  name: keyof RootStack;
  params?: RootStack[keyof RootStack];
};
export function mainDestination(section: MainSection): MainDestination {
  switch (section) {
    case "cars":
      return { name: "Cars" };
    case "work":
      return { name: "Work" };
    case "staff":
      return { name: "Home", params: { area: "people" } };
    case "review":
      return { name: "Decisions" };
    case "me":
      return { name: "Home", params: { employeeArea: "me" } };
    default:
      return { name: "Home", params: { area: "today", employeeArea: "today" } };
  }
}
