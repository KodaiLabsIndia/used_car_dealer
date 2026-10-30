import { RecordRow } from "../components/layout";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import type { ScreenProps } from "../navigation";
import { ContentScroll, CardGrid } from "../components/layout";
import { GarageHeader } from "../components/header";
import { Choice } from "../components/forms";
import {
  Button,
  CarThumb,
  ErrorNotice,
  Icon,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { formatMoney } from "../application/money";
import { purchaseLabel } from "./purchase";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
export function PurchasesScreen({ navigation }: ScreenProps<"Purchases">) {
  const { api, language, session } = useApp(),
    hi = language === "hi",
    [decisions, setDecisions] = useState(false);
  const resource = useResource(`purchases:${decisions}`, () =>
    api.purchases(decisions),
  );
  return (
    <View style={{ flex: 1 }}>
      <GarageHeader back title={hi ? "खरीद" : "Purchases"} />
      <ContentScroll
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor="#fff"
          />
        }
      >
        <Text style={s.title}>
          {hi ? "हर खरीद का पूरा हिसाब।" : "Every purchase. Accounted for."}
        </Text>
        {session?.actor.role === "owner" ? (
          <>
            <Choice
              label={
                hi
                  ? "केवल मंज़ूरी के लिए आए प्रस्ताव"
                  : "Awaiting approval only"
              }
              selected={decisions}
              onPress={() => setDecisions((v) => !v)}
              icon="checkmark-done-outline"
            />
            {resource.error ? (
              <ErrorNotice message={resource.error} retry={resource.refresh} />
            ) : null}
            {resource.loading && !resource.data ? (
              <ActivityIndicator color="#fff" />
            ) : null}
            <CardGrid>
              {resource.data?.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate("Purchase", { carId: p.carId })
                  }
                >
                  <Panel style={{ gap: 14 }}>
                    <RecordRow>
                      <CarThumb car={p.car} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: "600" }}>
                          {p.car.make} {p.car.model}
                        </Text>
                        <Text style={s.muted}>{p.car.registration}</Text>
                      </View>
                      <Icon name="chevron-forward-outline" />
                    </RecordRow>
                    <Pill
                      label={purchaseLabel(p.status, hi)}
                      warning={p.status === "submitted"}
                    />
                    <Text
                      style={{
                        fontSize: 24,
                        lineHeight: 32,
                        fontWeight: "600",
                      }}
                    >
                      {formatMoney(p.terms.purchasePricePaise, hi)}
                    </Text>
                    <Text style={s.muted}>
                      {hi ? "बाकी" : "Balance"}{" "}
                      {formatMoney(p.balancePaise, hi)}
                    </Text>
                  </Panel>
                </Pressable>
              ))}
            </CardGrid>
            {!resource.loading && !resource.data?.length ? (
              <Panel style={{ gap: 14 }}>
                <Text>
                  {hi
                    ? "अभी कोई खरीद प्रस्ताव नहीं है। गाड़ी के रिकॉर्ड से शुरू करें।"
                    : "No purchase proposals here yet. Start from a car record."}
                </Text>
                <Button
                  label={hi ? "गाड़ियाँ खोलें" : "Open cars"}
                  secondary
                  icon="car-sport-outline"
                  onPress={() => navigation.navigate("Cars")}
                />
              </Panel>
            ) : null}
          </>
        ) : (
          <Text>{hi ? "मालिक की पहुँच चाहिए।" : "Owner access required."}</Text>
        )}
      </ContentScroll>
    </View>
  );
}
