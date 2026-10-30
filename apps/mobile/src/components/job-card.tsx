import { RecordRow } from "./layout";
import React from "react";
import { Pressable, View } from "react-native";
import type { RepairJob } from "@arihant/contracts";
import { CarThumb, Icon, Panel, Pill, Text, s } from "./ui";
export function jobLabel(status: RepairJob["status"], hi: boolean) {
  return {
    assigned: hi ? "काम दिया गया" : "Assigned",
    in_progress: hi ? "काम चालू है" : "In service",
    waiting_parts: hi ? "पार्ट का इंतज़ार" : "Waiting for parts",
    awaiting_qc: hi ? "जाँच बाकी है" : "Quality check",
    completed: hi ? "पूरा हुआ" : "Completed",
  }[status];
}
export function JobCard({
  job,
  hi,
  onPress,
}: {
  job: RepairJob;
  hi: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${job.car.make} ${job.car.model}, ${job.title}`}
      onPress={onPress}
    >
      <Panel style={{ gap: 12 }}>
        <RecordRow>
          <CarThumb car={job.car} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "600" }}>
              {job.car.make} {job.car.model}
            </Text>
            <Text style={s.muted}>{job.car.registration}</Text>
          </View>
          <Icon name="chevron-forward-outline" />
        </RecordRow>
        <Text>{job.title}</Text>
        <Pill
          label={jobLabel(job.status, hi)}
          warning={job.status === "waiting_parts"}
        />
        <Text style={s.muted}>
          {job.assigneeName}
          {job.workshopName ? ` · ${job.workshopName}` : ""}
        </Text>
      </Panel>
    </Pressable>
  );
}
