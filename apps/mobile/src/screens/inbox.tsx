import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import type { Inbox } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { Workspace, FocusPage } from "../components/workspace";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";

const labels: Record<string, [string, string]> = {
  "task.overdue": ["Inspection is overdue", "जाँच की तारीख निकल गई"],
  "task.submit": ["Inspection ready for review", "जाँच समीक्षा के लिए तैयार"],
  "task.review": ["Inspection review recorded", "जाँच की समीक्षा दर्ज हुई"],
  "task.help": ["An employee needs help", "कर्मचारी को मदद चाहिए"],
  "task.assign": [
    "Inspection responsibility changed",
    "जाँच की ज़िम्मेदारी बदली",
  ],
  "task.takeover": [
    "Inspection responsibility changed",
    "जाँच की ज़िम्मेदारी बदली",
  ],
  "repair.overdue": [
    "Workshop return is overdue",
    "वर्कशॉप से वापसी की तारीख निकल गई",
  ],
  "enquiry.followup": [
    "Customer follow-up is due",
    "ग्राहक से फिर संपर्क करना है",
  ],
  "enquiry.updated": ["Enquiry updated", "पूछताछ अपडेट हुई"],
  "transfer.overdue": [
    "Ownership-transfer follow-up is overdue",
    "मालिकाना ट्रांसफर का संपर्क बाकी",
  ],
  "booking.expired": [
    "Booking hold expired · review any refund due",
    "बुकिंग की अवधि खत्म · बाकी वापसी जाँचें",
  ],
};
export function InboxScreen({ navigation }: ScreenProps<"Inbox">) {
  const { api, language, changed } = useApp(),
    hi = language === "hi",
    tr = (en: string, hindi: string) => (hi ? hindi : en);
  const [view, setView] = useState<"unread" | "all">("unread"),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const resource = useResource(`inbox:${view}:${offset}`, () =>
      api.inbox(view === "unread", offset),
    ),
    data = resource.data;
  async function read(id?: string) {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await api.readNotifications(data.cutoff, id);
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(item: Inbox["items"][number]) {
    void read(item.id);
    if (item.targetType === "task")
      navigation.navigate("Task", { id: item.targetId });
    else if (item.targetType === "job")
      navigation.navigate("Job", { id: item.targetId });
    else if (item.targetType === "enquiry")
      navigation.navigate("Enquiry", { id: item.targetId });
    else if (item.targetType === "business")
      navigation.navigate("Business", { carId: item.targetId });
    else navigation.navigate("Car", { id: item.targetId });
  }
  return (
    <Workspace
      title={tr("Updates & reminders", "सूचनाएँ और रिमाइंडर")}
      selected={view}
      busy={busy}
      onChange={(v) => {
        setView(v);
        setOffset(0);
      }}
      items={[
        {
          id: "unread",
          label: tr("Unread", "नई"),
          icon: "notifications-outline",
          badge: String(data?.unread ?? 0),
        },
        {
          id: "all",
          label: tr("All updates", "सभी सूचनाएँ"),
          icon: "time-outline",
        },
      ]}
    >
      <FocusPage
        scrollKey={`${view}:${offset}`}
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor="#fff"
          />
        }
        footer={
          <ActionRow>
            <Button
              secondary
              label={tr("Previous", "पिछला")}
              disabled={!offset || resource.loading}
              onPress={() => setOffset(Math.max(0, offset - 30))}
              style={{ flex: 1 }}
            />
            <Button
              label={tr("Mark all read", "सभी पढ़े हुए")}
              busy={busy}
              disabled={!data?.unread}
              onPress={() => void read()}
              style={{ flex: 2 }}
            />
            <Button
              secondary
              label={tr("Next", "अगला")}
              disabled={resource.loading || (data?.items.length ?? 0) < 30}
              onPress={() => setOffset(offset + 30)}
              style={{ flex: 1 }}
            />
          </ActionRow>
        }
      >
        {error || resource.error ? (
          <ErrorNotice
            message={error || resource.error}
            retry={resource.refresh}
          />
        ) : null}
        {resource.loading && !data ? <ActivityIndicator color="#fff" /> : null}
        {data?.items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={
              (labels[item.kind] ?? [
                "Work record updated",
                "काम का रिकॉर्ड अपडेट हुआ",
              ])[hi ? 1 : 0]
            }
            onPress={() => open(item)}
          >
            <Panel style={{ gap: 12 }}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text style={{ fontSize: 20, fontWeight: "600", flex: 1 }}>
                  {
                    (labels[item.kind] ?? [
                      "Work record updated",
                      "काम का रिकॉर्ड अपडेट हुआ",
                    ])[hi ? 1 : 0]
                  }
                </Text>
                {!item.readAt ? <Pill label={tr("New", "नई")} /> : null}
              </View>
              <Text style={s.muted}>
                {new Date(item.createdAt).toLocaleString(
                  hi ? "hi-IN" : "en-IN",
                )}
              </Text>
              <Text>{tr("Open record →", "रिकॉर्ड खोलें →")}</Text>
            </Panel>
          </Pressable>
        ))}
        {!resource.loading && !resource.error && !data?.items.length ? (
          <Panel style={{ gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>
              {tr("You're up to date.", "सभी नई सूचनाएँ देख लीं।")}
            </Text>
            <Text style={s.muted}>
              {tr(
                "Assigned work, reviews and follow-ups appear here.",
                "सौंपा हुआ काम, समीक्षा और फिर संपर्क की सूचना यहाँ आएगी।",
              )}
            </Text>
          </Panel>
        ) : null}
      </FocusPage>
    </Workspace>
  );
}
