import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { Workspace, FocusPage } from "../components/workspace";
import {
  ActionRow,
  Button,
  CarThumb,
  ErrorNotice,
  Icon,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { Field } from "../components/forms";
import { FormRow, CardGrid } from "../components/layout";
import { formatMoney } from "../application/money";
import { stageKeys } from "../components/garage-motion";

export function BusinessBoardScreen({
  navigation,
}: ScreenProps<"BusinessBoard">) {
  const { api, language, t } = useApp(),
    hi = language === "hi";
  const [scope, setScope] = useState<
      "all" | "booked" | "support" | "attention"
    >("attention"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0);
  const resource = useResource(
    `business-queue:${scope}:${query}:${offset}`,
    () => api.businessQueue(query, scope, offset),
  );
  return (
    <Workspace
      title={hi ? "बिक्री और सहायता" : "Sales & support"}
      selected={scope}
      onChange={(value) => {
        setScope(value);
        setOffset(0);
      }}
      items={[
        {
          id: "attention",
          label: hi ? "ध्यान दें" : "Attention",
          icon: "alert-circle-outline",
        },
        {
          id: "all",
          label: hi ? "सभी गाड़ियाँ" : "All cars",
          icon: "car-sport-outline",
        },
        { id: "booked", label: hi ? "बुकिंग" : "Booked", icon: "key-outline" },
        {
          id: "support",
          label: hi ? "बिक्री के बाद" : "After sales",
          icon: "shield-checkmark-outline",
        },
      ]}
    >
      <FocusPage
        scrollKey={`${scope}:${offset}`}
        top={
          <FormRow>
            <View style={{ flex: 1 }}>
              <Field
                label={
                  hi ? "नंबर या मॉडल खोजें" : "Search registration or model"
                }
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => {
                  setOffset(0);
                  setQuery(search.trim());
                }}
                returnKeyType="search"
              />
            </View>
            <Button
              label={hi ? "खोजें" : "Search"}
              icon="search-outline"
              onPress={() => {
                setOffset(0);
                setQuery(search.trim());
              }}
            />
          </FormRow>
        }
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
              label={hi ? "पिछला पेज" : "Previous"}
              disabled={offset === 0 || resource.loading}
              onPress={() => setOffset((n) => Math.max(0, n - 30))}
              style={{ flex: 1 }}
            />
            <Text style={s.muted}>{Math.floor(offset / 30) + 1}</Text>
            <Button
              secondary
              label={hi ? "अगला पेज" : "Next"}
              disabled={
                !resource.data ||
                resource.data.items.length < 30 ||
                resource.loading
              }
              onPress={() => setOffset((n) => n + 30)}
              style={{ flex: 1 }}
            />
          </ActionRow>
        }
      >
        {resource.error ? (
          <ErrorNotice message={resource.error} retry={resource.refresh} />
        ) : null}
        {resource.loading && !resource.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        <CardGrid>
          {resource.data?.items.map((item) => (
            <Pressable
              key={item.car.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.car.make} ${item.car.model}, ${item.car.registration}`}
              onPress={() =>
                navigation.navigate("Business", { carId: item.car.id })
              }
            >
              <Panel style={{ gap: 13 }}>
                <View style={s.row}>
                  <CarThumb car={item.car} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: "600" }}>
                      {item.car.make} {item.car.model}
                    </Text>
                    <Text style={s.muted}>
                      {item.car.registration} · {item.car.stockNumber}
                    </Text>
                  </View>
                  <Icon name="chevron-forward-outline" />
                </View>
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  <Pill label={t(stageKeys[item.car.stage])} />
                  {item.car.commercialStatus === "booked" ? (
                    <Pill label={hi ? "बुकिंग" : "Booked"} />
                  ) : null}
                  {item.expiredBooking ? (
                    <Pill
                      label={hi ? "बुकिंग समय समाप्त" : "Booking expired"}
                      warning
                    />
                  ) : null}
                </View>
                {item.customerName ? <Text>{item.customerName}</Text> : null}
                {item.refundDuePaise > 0 ? (
                  <Text>
                    {hi ? "वापसी बाकी" : "Refund due"} ·{" "}
                    {formatMoney(item.refundDuePaise, hi)}
                  </Text>
                ) : null}
                {item.openClaims > 0 ? (
                  <Text>
                    {hi ? "खुले वारंटी अनुरोध" : "Open warranty claims"} ·{" "}
                    {item.openClaims}
                  </Text>
                ) : null}
                {item.transferDueAt ? (
                  <Text style={s.muted}>
                    {hi ? "ट्रांसफर फॉलो-अप" : "Transfer follow-up"} ·{" "}
                    {new Date(item.transferDueAt).toLocaleDateString(
                      hi ? "hi-IN" : "en-IN",
                    )}
                  </Text>
                ) : null}
              </Panel>
            </Pressable>
          ))}
        </CardGrid>
        {!resource.loading &&
        !resource.error &&
        !resource.data?.items.length ? (
          <Panel>
            <Text>
              {hi ? "इस हिस्से में कोई गाड़ी नहीं।" : "No cars in this view."}
            </Text>
          </Panel>
        ) : null}
      </FocusPage>
    </Workspace>
  );
}
