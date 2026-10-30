import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
export type RootStack = {
  Home: { scope?: "all" | "mine" | "decisions" } | undefined;
  Cars: undefined;
  Car: { id: string };
  Task: { id: string };
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
  BusinessBoard: undefined;
  ServiceFinance: { jobId: string };
  Enquiries: undefined;
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
