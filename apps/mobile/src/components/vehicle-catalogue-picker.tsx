import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CatalogueModel } from "@arihant/contracts";
import { colors } from "@arihant/design-tokens";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { ActionRow, Button, ErrorNotice, Icon, Text, s } from "./ui";

export function VehicleCataloguePicker({
  open,
  onClose,
  onSelect,
  hi,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (model: CatalogueModel) => void;
  hi: boolean;
}) {
  return (
    <Modal
      visible={open}
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      {open ? (
        <CatalogueSearch onClose={onClose} onSelect={onSelect} hi={hi} />
      ) : null}
    </Modal>
  );
}
function CatalogueSearch({
  onClose,
  onSelect,
  hi,
}: {
  onClose: () => void;
  onSelect: (model: CatalogueModel) => void;
  hi: boolean;
}) {
  const { api } = useApp();
  const [input, setInput] = useState(""),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [input]);
  const resource = useResource(`vehicle-catalogue:${query}:${offset}`, () =>
    api.vehicleCatalogue(query, offset),
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 900,
          alignSelf: "center",
          padding: 16,
          gap: 12,
        }}
      >
        <View style={s.row}>
          <Text
            style={{ fontSize: 22, lineHeight: 30, fontWeight: "600", flex: 1 }}
          >
            {hi ? "कार ढूँढें" : "Find make & model"}
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
        <FlatList
          style={{ flex: 1, minHeight: 0 }}
          ListHeaderComponent={
            <View style={{ gap: 12, paddingBottom: 12 }}>
              <Text style={s.muted}>
                {hi
                  ? "कार और दस्तावेज़ से साल, वेरिएंट और उपकरण की पुष्टि करें।"
                  : "Confirm year, variant and fitted equipment against the actual car and documents."}
              </Text>
              <TextInput
                accessibilityLabel={
                  hi ? "ब्रांड या मॉडल ढूँढें" : "Search make or model"
                }
                placeholder={hi ? "जैसे Kia Sonet" : "For example, Kia Sonet"}
                placeholderTextColor={colors.muted}
                value={input}
                onChangeText={setInput}
                style={s.input}
                autoFocus
              />
              {resource.error ? (
                <ErrorNotice
                  message={resource.error}
                  retry={resource.refresh}
                />
              ) : null}
              {resource.loading ? (
                <ActivityIndicator color={colors.white} />
              ) : null}
            </View>
          }
          data={resource.data?.items || []}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(m) => m.id}
          renderItem={({ item: m }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onSelect(m);
                onClose();
              }}
              style={{
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderColor: colors.line,
                gap: 5,
              }}
            >
              <Text>{`${m.make} ${m.model}`}</Text>
              <Text style={[s.muted, { fontSize: 11 }]}>
                {m.marketStatus === "india_reference"
                  ? hi
                    ? "भारत का नाम / बॉडी संदर्भ"
                    : "India name / body reference"
                  : hi
                    ? "वैश्विक नाम संदर्भ · पुष्टि करें"
                    : "Global name reference · verify"}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={
            <View style={{ paddingVertical: 16 }}>
              <ActionRow>
                <Button
                  label={hi ? "पिछले" : "Previous"}
                  secondary
                  disabled={offset === 0 || resource.loading}
                  onPress={() => setOffset(Math.max(0, offset - 40))}
                />
                <Text
                  style={{ flex: 1, textAlign: "center" }}
                >{`${Math.min(offset + 1, resource.data?.total || 0)}–${Math.min(offset + 40, resource.data?.total || 0)} / ${resource.data?.total || 0}`}</Text>
                <Button
                  label={hi ? "अगले" : "Next"}
                  secondary
                  disabled={
                    !resource.data ||
                    offset + 40 >= resource.data.total ||
                    resource.loading
                  }
                  onPress={() => setOffset(offset + 40)}
                />
              </ActionRow>
            </View>
          }
          ListEmptyComponent={
            !resource.loading ? (
              <Text>
                {hi
                  ? "नाम न मिले तो कार की जानकारी स्वयं दर्ज करें।"
                  : "No match. You can enter the car details manually."}
              </Text>
            ) : undefined
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
