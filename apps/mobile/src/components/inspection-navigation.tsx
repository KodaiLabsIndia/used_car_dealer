import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Speech from "expo-speech";
import { SectionList, Modal, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Task } from "@arihant/contracts";
import { colors } from "@arihant/design-tokens";
import {
  checkState,
  inspectionProgress,
  zones,
} from "../application/inspection-index";
import { inspectionPartName } from "../application/inspection-parts";
import { InspectionCar } from "./inspection-car";
import { useLayout } from "./layout";
import { ActionRow, Button, Icon, Text, s } from "./ui";
import { SelectField } from "./workspace";

const stateNames = {
  pending: ["Not checked", "जाँच बाकी"],
  recheck: ["Recheck", "दोबारा जाँच"],
  blocked: ["Cannot inspect", "जाँच नहीं हो सकी"],
  issue: ["Issue found", "समस्या"],
  exception: ["N/A · review needed", "लागू नहीं · समीक्षा"],
  done: ["Recorded", "जाँच दर्ज"],
};
export function AllChecks({
  task,
  index,
  open,
  onClose,
  onSelect,
  hi,
  initialScope,
}: {
  task: Task;
  index: number;
  open: boolean;
  onClose: () => void;
  onSelect: (index: number) => void;
  hi: boolean;
  initialScope?: { zone?: string; componentId?: string };
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [zone, setZone] = useState<string | null>(null),
    [component, setComponent] = useState<string | null>(null);
  const list = useRef<SectionList>(null);
  useEffect(() => {
    list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  }, [filter, zone, component]);
  useEffect(() => {
    if (open) {
      setQuery("");
      setFilter("all");
      setZone(initialScope?.zone || null);
      setComponent(initialScope?.componentId || null);
    }
  }, [open, initialScope?.zone, initialScope?.componentId]);
  const progress = inspectionProgress(task),
    unfinished = new Set(progress.missing.map((i) => i.id));
  const sections = zones
    .filter(([id]) => !zone || zone === id)
    .map(([id, en, h]) => ({
      title: hi ? h : en,
      data: task.items
        .map((item, i) => ({ item, i }))
        .filter(
          ({ item }) =>
            item.zone === id &&
            (!component || item.componentId === component) &&
            (filter === "all" ||
              (filter === "remaining" && unfinished.has(item.id)) ||
              (filter === "issues" &&
                ["issue", "blocked", "recheck", "exception"].includes(
                  checkState(task, item),
                ))) &&
            `${item.title} ${item.titleHi} ${item.id} ${en} ${h} ${inspectionPartName(item.componentId, hi)}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        ),
    }))
    .filter((v) => v.data.length);
  return (
    <Modal
      visible={open}
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.black,
            width: "100%",
            maxWidth: 900,
            alignSelf: "center",
            padding: 16,
            gap: 10,
          }}
        >
          <View style={s.row}>
            <Text
              style={{
                fontSize: 22,
                lineHeight: 30,
                fontWeight: "600",
                flex: 1,
              }}
            >
              {component
                ? inspectionPartName(component, hi)
                : hi
                  ? "सभी जाँच"
                  : "All checks"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hi ? "बंद करें" : "Close"}
              onPress={onClose}
              style={s.iconButton}
            >
              <Icon name="close-outline" />
            </Pressable>
          </View>
          <SectionList
            ref={list}
            style={{ flex: 1, minHeight: 0 }}
            ListHeaderComponent={
              <View style={{ gap: 12, paddingBottom: 12 }}>
                <Text style={s.muted}>
                  {progress.completed}/{progress.total}{" "}
                  {hi ? "दर्ज" : "recorded"} · {progress.issues}{" "}
                  {hi ? "समस्या" : "issues"}
                </Text>
                {zone || component ? (
                  <Button
                    secondary
                    label={hi ? "सभी हिस्सों की जाँच" : "Show all sections"}
                    onPress={() => {
                      setZone(null);
                      setComponent(null);
                    }}
                  />
                ) : null}
                <TextInput
                  accessibilityLabel={hi ? "जाँच ढूँढें" : "Search checks"}
                  placeholder={
                    hi ? "पुर्जा या जाँच ढूँढें" : "Find a part or check"
                  }
                  placeholderTextColor={colors.muted}
                  value={query}
                  onChangeText={setQuery}
                  style={s.input}
                />
                <ActionRow>
                  {[
                    ["all", "All", "सभी"],
                    ["remaining", "Remaining", "बाकी"],
                    ["issues", "Findings", "समस्या"],
                  ].map(([id, en, h]) => (
                    <Button
                      key={id}
                      label={(hi ? h : en)!}
                      secondary={filter !== id}
                      selected={filter === id}
                      style={{ flex: 1 }}
                      onPress={() => setFilter(id!)}
                    />
                  ))}
                </ActionRow>
              </View>
            }
            sections={sections}
            keyExtractor={(r) => r.item.id}
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            renderSectionHeader={({ section }) => (
              <View
                style={{
                  paddingVertical: 12,
                  backgroundColor: colors.black,
                  borderBottomWidth: 1,
                  borderColor: colors.line,
                }}
              >
                <Text style={s.label}>
                  {section.title} · {section.data.length}
                </Text>
              </View>
            )}
            renderItem={({ item: { item, i } }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: i === index }}
                onPress={() => {
                  onSelect(i);
                  onClose();
                }}
                style={{
                  paddingVertical: 15,
                  borderBottomWidth: 1,
                  borderColor: colors.line,
                  gap: 6,
                  minHeight: 78,
                }}
              >
                <Text>
                  {i + 1}. {hi ? item.titleHi : item.title}
                </Text>
                <Text style={[s.muted, { fontSize: 11 }]}>
                  {stateNames[checkState(task, item)][hi ? 1 : 0]} ·{" "}
                  {item.requiresClip
                    ? hi
                      ? "फोटो + वीडियो"
                      : "Photo + video"
                    : hi
                      ? "फोटो"
                      : "Photo"}
                  {item.measurementUnit ? ` · ${item.measurementUnit}` : ""}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text>
                {hi
                  ? "इस फ़िल्टर में कोई जाँच नहीं।"
                  : "No checks match this filter."}
              </Text>
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function InspectionNavigation({
  task,
  index,
  onSelect,
  onAll,
  onPart,
  hi,
}: {
  task: Task;
  index: number;
  onSelect: (i: number) => void;
  onAll: () => void;
  onPart: (componentId: string) => void;
  hi: boolean;
}) {
  const item = task.items[index]!,
    progress = inspectionProgress(task),
    layout = useLayout();
  const options = zones
    .filter(([id]) => task.items.some((i) => i.zone === id))
    .map(([id, en, h]) => {
      const checks = task.items.filter((i) => i.zone === id),
        missing = checks.filter((i) =>
          progress.missing.some((m) => m.id === i.id),
        );
      return {
        id,
        label: `${hi ? h : en} · ${checks.length - missing.length}/${checks.length}`,
      };
    });
  const components = useMemo(
    () => [
      ...new Set(
        task.items
          .filter((i) => i.zone === item.zone)
          .map((i) => i.componentId),
      ),
    ],
    [task.items, item.zone],
  );
  const schematic = (
    <View style={{ flex: layout.split ? 1.2 : undefined, gap: 10 }}>
      <InspectionCar
        configuration={task.vehicleConfiguration}
        item={item}
        components={components}
        hi={hi}
        onSelect={(id) => {
          onPart(id);
          const candidates = task.items
            .map((i, n) => ({ i, n }))
            .filter((v) => v.i.componentId === id && v.i.zone === item.zone);
          const candidate =
            candidates.find((v) =>
              progress.missing.some((m) => m.id === v.i.id),
            ) || candidates[0];
          if (candidate) onSelect(candidate.n);
        }}
      />
    </View>
  );
  const zone = (
    <SelectField
      label={hi ? "कौन सा हिस्सा?" : "Inspection zone"}
      value={item.zone}
      options={options}
      onChange={(zone) => {
        const candidates = task.items
          .map((i, n) => ({ i, n }))
          .filter((v) => v.i.zone === zone);
        const candidate =
          candidates.find((v) =>
            progress.missing.some((m) => m.id === v.i.id),
          ) || candidates[0];
        if (candidate) onSelect(candidate.n);
      }}
    />
  );
  const listen = () => {
    void Speech.stop();
    Speech.speak(hi ? item.instructionHi : item.instruction, {
      language: hi ? "hi-IN" : "en-IN",
    });
  };
  const selection = (
    <>
      {zone}
      <View style={[s.row, { alignItems: "center" }]}>
        <Text
          style={{ flex: 1, fontSize: 16, lineHeight: 23, fontWeight: "600" }}
        >
          {hi ? item.titleHi : item.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hi ? "जाँच सुनें" : "Listen to this check"}
          onPress={listen}
          style={{
            minWidth: 48,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="volume-high-outline" />
        </Pressable>
      </View>
    </>
  );
  const summary = (
    <Text
      style={{ fontSize: 11, color: colors.muted }}
    >{`${progress.completed}/${progress.total} ${hi ? "दर्ज" : "recorded"} · ${progress.issues} ${hi ? "समस्या" : "issues"} · ${progress.missing.length} ${hi ? "बाकी" : "unfinished"}`}</Text>
  );
  if (!layout.split)
    return (
      <View style={{ gap: 10 }}>
        {selection}
        {schematic}
        {summary}
      </View>
    );
  return (
    <View style={{ gap: 20, flexDirection: "row" }}>
      {schematic}
      <View style={{ flex: 1, gap: 12 }}>
        {selection}
        <Text style={s.muted}>
          {hi ? item.instructionHi : item.instruction}
        </Text>
        {summary}
        <Button
          secondary
          icon="list-outline"
          label={hi ? "सभी जाँच देखें" : "All checks & missing proof"}
          onPress={onAll}
        />
      </View>
    </View>
  );
}

// Keep the check name and counter readable when text is enlarged.
export function CheckStepper({
  index,
  total,
  disabled,
  hi,
  onSelect,
  onOpen,
}: {
  index: number;
  total: number;
  disabled: boolean;
  hi: boolean;
  onSelect: (index: number) => void;
  onOpen: () => void;
}) {
  const arrow = (next: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hi
          ? next
            ? "अगली जाँच"
            : "पिछली जाँच"
          : next
            ? "Next check"
            : "Previous check"
      }
      accessibilityState={{
        disabled: disabled || (next ? index >= total - 1 : index === 0),
      }}
      disabled={disabled || (next ? index >= total - 1 : index === 0)}
      onPress={() => onSelect(index + (next ? 1 : -1))}
      style={[
        s.iconButton,
        { opacity: (next ? index >= total - 1 : index === 0) ? 0.4 : 1 },
      ]}
    >
      <Icon name={next ? "chevron-forward-outline" : "chevron-back-outline"} />
    </Pressable>
  );
  return (
    <View style={[s.row, { gap: 8 }]}>
      {arrow(false)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${hi ? "सभी जाँच" : "All checks"} · ${index + 1}/${total}`}
        disabled={disabled}
        onPress={onOpen}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 48,
          padding: 8,
          gap: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 12,
        }}
      >
        <Icon name="list-outline" size={20} />
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, lineHeight: 18, textAlign: "center" }}>
            {hi ? "सभी जाँच" : "All checks"}
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 19,
              textAlign: "center",
              color: colors.muted,
            }}
          >
            {index + 1} / {total}
          </Text>
        </View>
      </Pressable>
      {arrow(true)}
    </View>
  );
}
