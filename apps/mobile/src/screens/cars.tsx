import { RecordRow } from "../components/layout";
import { can } from "../application/access";
import { ContentScroll } from "../components/layout";
import React, { useEffect, useState } from "react";
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
import { ChoiceModal, SelectField } from "../components/workspace";
import { WorkHeading } from "../components/operations";
import { GarageRoute, stageKeys } from "../components/garage-motion";
import { CardGrid } from "../components/layout";
import { Button } from "../components/ui";
export function CarsScreen({ navigation, route }: ScreenProps<"Cars">) {
  const { api, t, language, session } = useApp(),
    [search, setSearch] = useState(route.params?.query ?? ""),
    [query, setQuery] = useState(route.params?.query ?? ""),
    resource = useResource(
      `cars:${query}:${route.params?.stage ?? "all"}`,
      () => api.cars(query, route.params?.stage),
    );
  const [actions, setActions] = useState(false),
    [journey, setJourney] = useState(false);
  const overview = useResource("cars:journey", () =>
    session && can(session.actor, "overview")
      ? api.dashboard()
      : Promise.resolve(null),
  );
  useEffect(() => {
    setSearch(route.params?.query ?? "");
    setQuery(route.params?.query ?? "");
  }, [route.params?.query]);
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
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
        <WorkHeading
          title={tr("Cars", "गाड़ियाँ", "गाड्या")}
          action={tr("Actions", "कार्य", "कृती")}
          onPress={() => setActions(true)}
        />
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
        {session && can(session.actor, "overview") ? (
          <View style={{ gap: 8 }}>
            <Button
              secondary
              label={
                journey
                  ? tr(
                      "Hide car journey",
                      "गाड़ी का सफ़र छिपाएँ",
                      "गाडीचा प्रवास लपवा",
                    )
                  : tr("Car journey", "गाड़ी का सफ़र", "गाडीचा प्रवास")
              }
              onPress={() => setJourney((value) => !value)}
            />
            {journey && overview.data ? (
              <GarageRoute
                counts={overview.data.stages}
                selected={route.params?.stage ?? null}
                onSelect={(stage) =>
                  navigation.setParams({ stage: stage ?? undefined })
                }
              />
            ) : null}
          </View>
        ) : null}
        <SelectField
          label={tr("Show", "दिखाएँ", "दाखवा")}
          value={route.params?.stage ?? "all"}
          onChange={(stage) =>
            navigation.setParams({
              stage:
                stage === "all"
                  ? undefined
                  : (stage as import("@arihant/contracts").Stage),
            })
          }
          options={[
            {
              id: "all",
              label: tr(
                "All car records",
                "सभी गाड़ियों का रिकॉर्ड",
                "सर्व गाड्यांची नोंद",
              ),
            },
            ...(
              [
                "inspection",
                "purchase",
                "refurbishment",
                "ready",
                "delivered",
              ] as const
            ).map((stage) => ({ id: stage, label: t(stageKeys[stage]) })),
          ]}
        />
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
              <Panel style={{ gap: 9, padding: 14 }}>
                <RecordRow>
                  <CarThumb car={car} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 17,
                        lineHeight: 24,
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
      <ChoiceModal
        visible={actions}
        title={tr("Car actions", "गाड़ी के कार्य", "गाडीच्या कृती")}
        onClose={() => setActions(false)}
      >
        {[
          ...(session && can(session.actor, "intake")
            ? [
                {
                  label: tr("Add a car", "गाड़ी जोड़ें", "गाडी जोडा"),
                  go: () => navigation.navigate("AddCar"),
                },
              ]
            : []),
          {
            label: tr(
              "Seller enquiries",
              "विक्रेता पूछताछ",
              "विक्रेत्यांची चौकशी",
            ),
            go: () => navigation.navigate("Enquiries", { kind: "seller" }),
            capability: "leads" as const,
          },
          {
            label: tr("Buyer enquiries", "खरीदार पूछताछ", "खरेदीदारांची चौकशी"),
            go: () => navigation.navigate("Enquiries", { kind: "buyer" }),
            capability: "leads" as const,
          },
          {
            label: tr("Purchases", "खरीद", "खरेदी"),
            go: () => navigation.navigate("Purchases"),
            capability: "finance" as const,
          },
          {
            label: tr(
              "Bookings and sales",
              "बुकिंग और बिक्री",
              "बुकिंग व विक्री",
            ),
            go: () => navigation.navigate("BusinessBoard", { scope: "all" }),
            capability: "finance" as const,
          },
          {
            label: tr(
              "After-sales support",
              "बिक्री के बाद सहायता",
              "विक्रीनंतर मदत",
            ),
            go: () =>
              navigation.navigate("BusinessBoard", { scope: "support" }),
            capability: "finance" as const,
          },
        ]
          .filter(
            (action) =>
              !("capability" in action) ||
              (!!session && can(session.actor, action.capability)),
          )
          .map((action) => (
            <Button
              key={action.label}
              secondary
              label={action.label}
              onPress={() => {
                setActions(false);
                action.go();
              }}
            />
          ))}
      </ChoiceModal>
    </View>
  );
}
