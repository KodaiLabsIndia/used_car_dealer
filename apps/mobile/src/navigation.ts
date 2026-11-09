import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
export type RootStack = {
  Workforce:
    | { userId?: string; section?: "attendance" | "leave" | "pay" | "rules" }
    | undefined;
  Home:
    | {
        scope?: "all" | "mine" | "decisions" | undefined;
        employeeArea?: "today" | "me";
        area?: "today" | "dealership" | "people" | "decisions" | undefined;
      }
    | undefined;
  Work:
    | {
        mine?: boolean;
        personId?: string;
        phase?: "todo" | "review" | "finished";
        category?: "all" | "inspections" | "routines" | "service";
      }
    | undefined;
  Help: { taskId?: string; itemId?: string } | undefined;
  Routines:
    | {
        routineId?: string | undefined;
        day?: string | undefined;
        section?: "today" | "manage" | "history" | undefined;
      }
    | undefined;
  Cars:
    | { stage?: import("@arihant/contracts").Stage | undefined; query?: string }
    | undefined;
  Car: { id: string };
  Task: { id: string; itemId?: string };
  InspectionAllocation: {
    taskId: string;
    section?: "assign" | "review" | "coverage";
  };
  Scan: undefined;
  Settings: undefined;
  AddCar: undefined;
  AssignInspection: { carId: string; taskId?: string };
  Jobs: undefined;
  Job: { id: string };
  AssignRepair: { carId: string; issueId: string };
  Workshops: undefined;
  Purchases: undefined;
  Purchase: { carId: string };
  Business: { carId: string };
  BusinessBoard:
    { scope?: "all" | "booked" | "support" | "attention" } | undefined;
  ServiceFinance: { jobId: string };
  Enquiries: { kind?: "buyer" | "seller" } | undefined;
  Enquiry: { id: string };
  Stock: { carId: string };
  Clips: { taskId: string; itemId: string; initialView?: "saved" | "add" };
  Decisions: undefined;
  Reports: undefined;
  Checklists: undefined;
  CompanySettings: undefined;
  Inbox: undefined;
  Assistant:
    | {
        carId?: string;
        taskId?: string;
        itemId?: string;
        capability?: import("@arihant/contracts").AICapability;
      }
    | undefined;
  Documents: { carId: string };
  Team: undefined;
  Security: undefined;
};
export type Navigation = NativeStackNavigationProp<RootStack>;
export type ScreenProps<K extends keyof RootStack> = NativeStackScreenProps<
  RootStack,
  K
>;
