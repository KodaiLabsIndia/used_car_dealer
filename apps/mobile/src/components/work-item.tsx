import React from "react";
import { Pressable, View } from "react-native";
import {
  inspectionProgress,
  type Task,
  type RoutineItem,
  type RepairJob,
} from "@arihant/contracts";
import type { Navigation } from "../navigation";
import { useApp } from "../state/app-context";
import { nextRoutineStep } from "../application/work-overview";
import { CarThumb, Icon, Text } from "./ui";
export function inspectionName(kind: Task["kind"], language: string) {
  const names: Record<Task["kind"], [string, string, string]> = {
    pre_purchase: [
      "Before buying",
      "खरीदने से पहले की जाँच",
      "खरेदीपूर्व तपासणी",
    ],
    intake: ["Arrival checks", "आने पर जाँच", "आगमन तपासणी"],
    repair_qc: ["Check repaired work", "मरम्मत की जाँच", "दुरुस्ती तपासा"],
    delivery: [
      "Before delivery",
      "देने से पहले की जाँच",
      "देण्यापूर्वी तपासणी",
    ],
    reference: ["Car checks", "गाड़ी की जाँच", "गाडीची तपासणी"],
  };
  return names[kind][language === "mr" ? 2 : language === "hi" ? 1 : 0];
}
function CompactWork({
  title,
  detail,
  status,
  car,
  onPress,
  action,
  icon = "clipboard-outline",
}: {
  title: string;
  detail: string;
  status: string;
  car?: Task["car"];
  onPress: () => void;
  action: string;
  icon?: "clipboard-outline" | "repeat-outline" | "build-outline";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}, ${action}`}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 14,
        borderRadius: 17,
        backgroundColor: pressed ? "#332B29" : "#222221",
        gap: 10,
        borderWidth: 1,
        borderColor: "#383836",
      })}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        {car ? (
          <CarThumb car={car} size={48} />
        ) : (
          <Icon name={icon} color="#EDB7AA" size={26} />
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{title}</Text>
          <Text style={{ fontSize: 12, color: "#AAA7A2" }}>{detail}</Text>
        </View>
        <Icon name="chevron-forward-outline" color="#EF9CA0" size={19} />
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 12, color: "#CCC3B9", flexShrink: 1 }}>
          {status}
        </Text>
        <Text style={{ fontSize: 13, color: "#FF9FA4", fontWeight: "600" }}>
          {action} →
        </Text>
      </View>
    </Pressable>
  );
}
export function InspectionWorkItem({
  task,
  navigation,
  personName,
  review = false,
}: {
  task: Task;
  navigation: Navigation;
  personName?: string | undefined;
  review?: boolean;
}) {
  const { language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const p = inspectionProgress(task),
    submitted = review || task.status === "submitted",
    done = task.status === "completed";
  const action = done
    ? tr("View", "देखें", "पाहा")
    : submitted
      ? tr("View sent work", "भेजा काम देखें", "पाठवलेले पाहा")
      : tr("Continue", "आगे करें", "पुढे करा");
  const status = done
    ? tr("Accepted", "मंज़ूर", "मंजूर")
    : submitted
      ? tr("Sent for review", "समीक्षा को भेजा", "तपासणीसाठी पाठवले")
      : task.status === "recheck"
        ? tr("Changes requested", "बदलाव चाहिए", "बदल आवश्यक")
        : task.helpOpen
          ? tr("Help requested", "मदद माँगी है", "मदत मागितली")
          : tr(
              `${Math.max(0, p.total - p.completed)} checks left`,
              `${Math.max(0, p.total - p.completed)} जाँच बाकी`,
              `${Math.max(0, p.total - p.completed)} तपासण्या बाकी`,
            );
  return (
    <CompactWork
      car={task.car}
      title={`${task.car.make} ${task.car.model}`}
      detail={`${task.car.registration} · ${inspectionName(task.kind, language)}${personName ? ` · ${personName}` : ""}`}
      status={status}
      action={action}
      onPress={() => navigation.navigate("Task", { id: task.id })}
    />
  );
}
export function RoutineWorkItem({
  item,
  navigation,
  showPerson = false,
}: {
  item: RoutineItem;
  navigation: Navigation;
  showPerson?: boolean;
}) {
  const { language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const next = nextRoutineStep(item),
    done = next < 0;
  return (
    <CompactWork
      icon="repeat-outline"
      title={item.definition.title}
      detail={`${showPerson ? item.assigneeName + " · " : ""}${done ? tr("All steps recorded", "सभी चरण दर्ज", "सर्व टप्पे नोंदवले") : item.definition.steps[next]}`}
      status={`${item.completedSteps.length}/${item.definition.steps.length} ${tr("steps done", "चरण पूरे", "टप्पे पूर्ण")}`}
      action={
        done
          ? tr("View", "देखें", "पाहा")
          : tr("Continue", "आगे करें", "पुढे करा")
      }
      onPress={() => navigation.navigate("Routines", { routineId: item.id })}
    />
  );
}
export function ServiceWorkItem({
  job,
  navigation,
}: {
  job: RepairJob;
  navigation: Navigation;
}) {
  const { language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  return (
    <CompactWork
      icon="build-outline"
      car={job.car}
      title={`${job.car.make} ${job.car.model}`}
      detail={`${job.car.registration} · ${job.title}`}
      status={
        job.status === "waiting_parts"
          ? tr("Waiting for parts", "पार्ट का इंतज़ार", "भागांची प्रतीक्षा")
          : job.status === "awaiting_qc"
            ? tr(
                "Repair check pending",
                "मरम्मत जाँच बाकी",
                "दुरुस्ती तपासणी बाकी",
              )
            : job.status === "completed"
              ? tr("Finished", "पूरा हुआ", "पूर्ण")
              : tr("Repair work", "मरम्मत का काम", "दुरुस्तीचे काम")
      }
      action={tr("Open", "खोलें", "उघडा")}
      onPress={() => navigation.navigate("Job", { id: job.id })}
    />
  );
}
