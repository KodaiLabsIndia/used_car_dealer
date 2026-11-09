import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@arihant/design-tokens";
import type { Car } from "@arihant/contracts";
import { GarageHeader } from "./header";
import { ContentScroll, useLayout } from "./layout";
import { CarThumb, Icon, Text, s, type IconName } from "./ui";
import { useInteractionLock } from "../state/use-interaction-lock";
import { uxText } from "../state/ux-copy";
import { useApp } from "../state/app-context";

export type Section<T extends string = string> = {
  id: T;
  label: string;
  icon: IconName;
  badge?: string;
};
const ScrollingContext = createContext<ReactNode>(null);
export function FocusScreen({
  title,
  children,
  onBack,
  busy = false,
}: {
  title: string;
  busy?: boolean;
  onBack?: (() => void) | undefined;
  children: ReactNode;
}) {
  useInteractionLock(busy);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <GarageHeader back title={title} onBack={onBack} />
      <View
        style={{ flex: 1, width: "100%", maxWidth: 1280, alignSelf: "center" }}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}
export function SectionTabs<T extends string>({
  items,
  selected,
  onChange,
  disabled = false,
  vertical = false,
}: {
  items: readonly Section<T>[];
  selected: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  vertical?: boolean;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: vertical ? "column" : "row",
        flexWrap: vertical ? "nowrap" : "wrap",
        gap: 6,
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: item.id === selected, disabled }}
          disabled={disabled}
          onPress={() => {
            Keyboard.dismiss();
            onChange(item.id);
          }}
          style={{
            width: vertical ? "100%" : undefined,
            flexBasis: "auto",
            flexGrow: vertical ? 0 : 1,
            flexShrink: 0,
            maxWidth: "100%",
            minWidth: vertical ? undefined : 56,
            minHeight: vertical ? 52 : 46,
            paddingHorizontal: 8,
            paddingVertical: 8,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: vertical ? "flex-start" : "center",
            gap: 7,
            backgroundColor: item.id === selected ? "#3E252C" : colors.card,
            borderWidth: 1,
            borderColor: item.id === selected ? "#CC7985" : colors.line,
          }}
        >
          <Icon
            name={item.icon}
            size={18}
            color={item.id === selected ? "#FFC2C9" : "#B9B1AB"}
          />
          <Text
            style={{
              fontSize: vertical ? 14 : 12,
              lineHeight: vertical ? 22 : 18,
              fontWeight: "600",
              textAlign: vertical ? "left" : "center",
              flexShrink: 1,
            }}
          >
            {item.label}
            {item.badge ? ` · ${item.badge}` : ""}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Workspace<T extends string>({
  title,
  context,
  items,
  selected,
  onChange,
  busy = false,
  sectionLocked = false,
  children,
}: {
  title: string;
  context?: ReactNode;
  items: readonly Section<T>[];
  selected: T;
  onChange: (value: T) => void;
  busy?: boolean;
  sectionLocked?: boolean;
  children: ReactNode;
}) {
  useInteractionLock(busy);
  const { width, height, fontScale, keyboardVisible } = useLayout();
  const { language } = useApp(),
    hi = language === "hi";
  const compact =
    items.length > 1 &&
    (keyboardVisible ||
      height < 600 ||
      fontScale >= 1.3 ||
      (width < 360 && items.length > 3));
  const [menu, setMenu] = useState(false);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <GarageHeader back title={title} />
      <View
        style={{ flex: 1, width: "100%", maxWidth: 1480, alignSelf: "center" }}
      >
        {context && !compact ? (
          <View
            style={{
              paddingHorizontal: width >= 768 ? 24 : 16,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}
          >
            {context}
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          {items.length < 2 ? null : compact ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={uxText(
                language,
                "Choose section",
                "हिस्सा चुनें",
              )}
              disabled={busy || sectionLocked}
              onPress={() => {
                Keyboard.dismiss();
                setMenu(true);
              }}
              style={[
                s.row,
                {
                  minHeight: 50,
                  paddingHorizontal: 18,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Icon
                name={
                  items.find((i) => i.id === selected)?.icon || "grid-outline"
                }
              />
              <Text style={{ flex: 1, fontWeight: "600" }}>
                {items.find((i) => i.id === selected)?.label}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {items.findIndex((item) => item.id === selected) + 1}/
                {items.length}
              </Text>
              <Icon name="chevron-down-outline" />
            </Pressable>
          ) : (
            <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <SectionTabs
                items={items}
                selected={selected}
                onChange={onChange}
                disabled={busy || sectionLocked}
              />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <ScrollingContext.Provider value={compact ? context : null}>
              {children}
            </ScrollingContext.Provider>
          </View>
        </View>
      </View>
      <ChoiceModal
        visible={menu}
        title={uxText(language, "Choose section", "हिस्सा चुनें")}
        onClose={() => setMenu(false)}
      >
        <SectionTabs
          items={items}
          selected={selected}
          onChange={(id) => {
            onChange(id);
            setMenu(false);
          }}
        />
      </ChoiceModal>
    </KeyboardAvoidingView>
  );
}

// Navigation and actions stay outside this sole content scroll area. Overflow is
// still available for small windows, the keyboard, long records and large text.
export function FocusPage({
  children,
  footer,
  scrollKey,
  top,
  widthLimit = 1280,
  ...scrollProps
}: {
  children: ReactNode;
  footer?: ReactNode;
  top?: ReactNode;
  scrollKey?: string;
  widthLimit?: number;
} & ScrollViewProps) {
  const { width, height, fontScale, keyboardVisible } = useLayout();
  const context = useContext(ScrollingContext);
  // Keep top inputs mounted when the keyboard opens; reparenting loses focus.
  const flowTop = width < 380 || height < 600 || fontScale >= 1.3;
  const flowFooter = flowTop || keyboardVisible;
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      {top && !flowTop ? (
        <View
          style={{
            width: "100%",
            maxWidth: widthLimit,
            alignSelf: "center",
            paddingHorizontal: 16,
            paddingTop: 10,
            gap: 10,
          }}
        >
          {top}
        </View>
      ) : null}
      <ContentScroll
        {...scrollProps}
        key={scrollKey}
        style={{ flex: 1 }}
        contentContainerStyle={{
          maxWidth: widthLimit,
          padding: 16,
          gap: 14,
          paddingBottom: 20,
        }}
      >
        {context}
        {flowTop ? top : null}
        {children}
        {flowFooter ? footer : null}
      </ContentScroll>
      {footer && !flowFooter ? (
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.black,
          }}
        >
          <View
            style={{
              padding: 12,
              width: "100%",
              maxWidth: widthLimit,
              alignSelf: "center",
              gap: 10,
            }}
          >
            {footer}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function CarIdentity({
  car,
  detail,
  onPress,
}: {
  car: Car;
  detail?: string;
  onPress?: () => void;
}) {
  const { width, fontScale } = useLayout();
  const textNeedsWidth = width < 600 && fontScale >= 1.3;
  const content = (
    <View style={s.row}>
      {!textNeedsWidth ? <CarThumb car={car} size={42} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "600" }}>
          {car.make} {car.model}
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 17, color: colors.muted }}>
          {car.registration} · {car.stockNumber}
          {detail ? ` · ${detail}` : ""}
        </Text>
      </View>
      {onPress && !textNeedsWidth ? (
        <Icon name="chevron-forward-outline" size={18} />
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${car.make} ${car.model}, ${car.registration}`}
      onPress={onPress}
      style={{ minHeight: 48, justifyContent: "center" }}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function StepHeader({
  labels,
  current,
  onSelect,
  disabled = false,
}: {
  labels: string[];
  current: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {labels.map((label, index) => (
        <Pressable
          key={`${index}:${label}`}
          accessibilityRole="tab"
          accessibilityLabel={`${index + 1}. ${label}`}
          accessibilityState={{ selected: current === index, disabled }}
          disabled={disabled}
          onPress={() => {
            Keyboard.dismiss();
            onSelect(index);
          }}
          style={{
            flexGrow: 1,
            flexShrink: 0,
            flexBasis: "auto",
            maxWidth: "100%",
            minHeight: 48,
            padding: 8,
            gap: 4,
            borderBottomWidth: 3,
            borderColor: current === index ? colors.red : colors.line,
          }}
        >
          <Text
            style={{
              color: current === index ? "#fff" : colors.muted,
              fontSize: 12,
              lineHeight: 18,
              fontWeight: "600",
              flexShrink: 1,
            }}
          >
            {index + 1} · {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ChoiceModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#000b",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ flex: 1, minHeight: 20 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "88%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            width: "100%",
            maxWidth: 700,
            alignSelf: "center",
          }}
        >
          <View style={[s.row, { padding: 16 }]}>
            <Text
              accessibilityRole="header"
              style={{ flex: 1, fontSize: 19, fontWeight: "600" }}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={s.iconButton}
            >
              <Icon name="close-outline" />
            </Pressable>
          </View>
          <ContentScroll
            contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10 }}
          >
            {children}
          </ContentScroll>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export type SelectOption = {
  id: string;
  label: string;
  detail?: string;
  icon?: IconName;
};
export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { language } = useApp(),
    hi = language === "hi";
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const current = options.find((option) => option.id === value);
  const filtered = options.filter((option) =>
    `${option.label} ${option.detail || ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <View style={{ gap: 7 }}>
        <Text style={{ fontWeight: "600" }}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${current?.label || placeholder || uxText(language, "Choose", "चुनें")}`}
          accessibilityState={{ disabled, expanded: open }}
          disabled={disabled}
          onPress={() => {
            Keyboard.dismiss();
            setSearch("");
            setOpen(true);
          }}
          style={[
            s.row,
            {
              minHeight: 58,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Icon name={current?.icon || "list-outline"} />
          <View style={{ flex: 1 }}>
            <Text>
              {current?.label ||
                placeholder ||
                uxText(language, "Choose", "चुनें")}
            </Text>
            {current?.detail ? (
              <Text
                style={{ fontSize: 11, lineHeight: 17, color: colors.muted }}
              >
                {current.detail}
              </Text>
            ) : null}
          </View>
          <Icon name="chevron-down-outline" />
        </Pressable>
      </View>
      <ChoiceModal visible={open} title={label} onClose={() => setOpen(false)}>
        {options.length > 7 ? (
          <TextInput
            accessibilityLabel={uxText(
              language,
              "Search choices",
              "सूची में खोजें",
            )}
            placeholder={uxText(language, "Search", "खोजें")}
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            style={s.input}
          />
        ) : null}
        {filtered.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: value === option.id }}
            onPress={() => {
              Keyboard.dismiss();
              onChange(option.id);
              setOpen(false);
            }}
            style={[
              s.row,
              {
                minHeight: 60,
                padding: 14,
                borderRadius: 12,
                backgroundColor: value === option.id ? "#422024" : colors.card,
                borderWidth: 1,
                borderColor: value === option.id ? "#ef5961" : colors.line,
              },
            ]}
          >
            <Icon
              name={
                value === option.id
                  ? "checkmark-circle"
                  : option.icon || "ellipse-outline"
              }
            />
            <View style={{ flex: 1 }}>
              <Text>{option.label}</Text>
              {option.detail ? (
                <Text
                  style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}
                >
                  {option.detail}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
        {!filtered.length ? (
          <Text style={s.muted}>
            {uxText(language, "No matching choices.", "कोई विकल्प नहीं मिला।")}
          </Text>
        ) : null}
      </ChoiceModal>
    </>
  );
}
