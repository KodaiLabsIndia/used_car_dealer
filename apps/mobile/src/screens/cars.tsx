import { RecordRow } from "../components/layout";
import { can } from "../application/access";
import { ContentScroll } from "../components/layout";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from "react-native";
import { colors } from "@arihant/design-tokens";
import type { ScreenProps } from "../navigation";
import { GarageHeader } from "../components/header";
import {
  CarThumb,
  ErrorNotice,
  Icon,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { stageKeys } from "../components/garage-motion";
import { CardGrid } from "../components/layout";
import { Button } from "../components/ui";
export function CarsScreen({ navigation }: ScreenProps<"Cars">) {
  const { api, t, language, session } = useApp(),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    resource = useResource(`cars:${query}`, () => api.cars(query));
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <GarageHeader back title={t("cars")} />
      <ContentScroll
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor="#fff"
          />
        }
      >
        <Text style={s.title}>{t("cars")}</Text>
        {session && can(session.actor, "intake") ? (
          <Button
            label={language === "hi" ? "गाड़ी जोड़ें" : "Bring a car in"}
            icon="add-outline"
            onPress={() => navigation.navigate("AddCar")}
          />
        ) : null}
        <View style={s.row}>
          <TextInput
            accessibilityLabel={t("search")}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => setQuery(search.trim())}
            returnKeyType="search"
            placeholder={t("search")}
            placeholderTextColor="#999"
            style={[s.input, { flex: 1 }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("search")}
            onPress={() => setQuery(search.trim())}
            style={s.iconButton}
          >
            <Icon name="search-outline" />
          </Pressable>
        </View>
        {resource.error ? (
          <ErrorNotice
            message={resource.offline ? t("offline") : resource.error}
            retry={resource.refresh}
          />
        ) : null}
        {resource.loading && !resource.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        <CardGrid>
          {resource.data?.items.map((car) => (
            <Pressable
              accessibilityRole="button"
              key={car.id}
              onPress={() => navigation.navigate("Car", { id: car.id })}
            >
              <Panel style={{ gap: 12 }}>
                <RecordRow>
                  <CarThumb car={car} size={87} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 20,
                        lineHeight: 27,
                        fontWeight: "600",
                      }}
                    >
                      {car.make} {car.model}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {car.registration}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.muted,
                        marginTop: 5,
                      }}
                    >
                      {car.stockNumber}
                    </Text>
                  </View>
                  <Icon name="chevron-forward-outline" />
                </RecordRow>
                <View style={[s.row, { flexWrap: "wrap", gap: 7 }]}>
                  <Pill label={t(stageKeys[car.stage])} />
                  {car.commercialStatus === "booked" ? (
                    <Pill label={t("booked")} />
                  ) : null}
                  {car.serviceStatus === "waiting_parts" ? (
                    <Pill
                      label={
                        language === "hi"
                          ? "पार्ट का इंतज़ार"
                          : "Waiting for parts"
                      }
                      warning
                    />
                  ) : null}
                </View>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {car.nextAction}
                </Text>
              </Panel>
            </Pressable>
          ))}
        </CardGrid>
        {resource.data?.items.length === 50 ? (
          <Text style={s.muted}>
            {language === "hi"
              ? "और गाड़ियाँ खोजने के लिए नंबर या मॉडल लिखें।"
              : "Search by registration or model to find more cars."}
          </Text>
        ) : null}
        {!resource.loading && !resource.data?.items.length ? (
          <Panel>
            <Text>{t("empty")}</Text>
          </Panel>
        ) : null}
      </ContentScroll>
    </View>
  );
}
