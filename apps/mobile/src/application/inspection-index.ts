import type { Task } from "@arihant/contracts";
export { checkState, inspectionProgress } from "@arihant/contracts";

export const zones = [
  ["identity", "Identity", "पहचान"],
  ["exterior", "Body", "बॉडी"],
  ["visibility", "Glass", "शीशे"],
  ["wheels", "Wheels", "पहिए"],
  ["powertrain", "Powertrain", "इंजन / मोटर"],
  ["underbody", "Underbody", "नीचे का हिस्सा"],
  ["cabin", "Cabin", "केबिन"],
  ["electrical", "Electrical", "बिजली"],
  ["safety", "Safety", "सुरक्षा"],
  ["road_test", "Tests", "टेस्ट"],
  ["general", "Other", "अन्य"],
] as const;

export function componentChecks(task: Task, component: string) {
  return task.items.filter((i) => i.componentId === component);
}
