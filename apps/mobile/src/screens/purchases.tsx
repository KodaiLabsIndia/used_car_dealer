import { uxText } from "../state/ux-copy";
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
import { Choice, Field } from "../components/forms";
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
    [decisions, setDecisions] = useState(false),
    [search, setSearch] = useState("");
  const resource = useResource(`purchases:${decisions}`, () =>
    api.purchases(decisions),
  );
  const visible = resource.data?.filter((p) =>
    `${p.car.make} ${p.car.model} ${p.car.registration} ${p.car.stockNumber}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <View style={{ flex: 1 }}>
      <GarageHeader back title={uxText(language, "Purchases", "खरीद")} />
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
          {uxText(language, "Purchase records", "खरीद का रिकॉर्ड")}
        </Text>
        {session?.actor.role === "owner" ? (
          <>
            <Field
              label={
                language === "mr"
                  ? "गाडी क्रमांक किंवा मॉडेल शोधा"
                  : uxText(
                      language,
                      "Search registration or model",
                      "नंबर या मॉडल खोजें",
                    )
              }
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            <Choice
              label={uxText(
                language,
                "Awaiting approval only",
                "केवल मंज़ूरी के लिए आए प्रस्ताव",
              )}
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
              {visible?.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate("Purchase", { carId: p.carId })
                  }
                >
                  <Panel style={{ gap: 10 }}>
                    <RecordRow>
                      <CarThumb car={p.car} size={48} />
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
                        fontSize: 20,
                        lineHeight: 28,
                        fontWeight: "600",
                      }}
                    >
                      {formatMoney(p.terms.purchasePricePaise, hi)}
                    </Text>
                    <Text style={s.muted}>
                      {language === "mr"
                        ? "विक्रेत्याची बाकी"
                        : hi
                          ? "विक्रेता का बाकी"
                          : "Seller balance"}{" "}
                      {formatMoney(p.balancePaise, hi)}
                    </Text>
                  </Panel>
                </Pressable>
              ))}
            </CardGrid>
            {!resource.loading && !resource.error && !visible?.length ? (
              <Panel style={{ gap: 10 }}>
                <Text>
                  {search.trim()
                    ? language === "mr"
                      ? "जुळणारी गाडी नाही. शोध बदला."
                      : hi
                        ? "गाड़ी नहीं मिली। खोज बदलें।"
                        : "No matching car. Try another search."
                    : decisions
                      ? language === "mr"
                        ? "मंजुरीसाठी खरेदी प्रस्ताव बाकी नाहीत."
                        : hi
                          ? "खरीद मंज़ूरी बाकी नहीं है।"
                          : "No purchases awaiting approval."
                      : uxText(
                          language,
                          "No purchase proposals here yet. Start from a car record.",
                          "अभी कोई खरीद प्रस्ताव नहीं है। गाड़ी के रिकॉर्ड से शुरू करें।",
                        )}
                </Text>
                <Button
                  label={uxText(language, "Open cars", "गाड़ियाँ खोलें")}
                  secondary
                  icon="car-sport-outline"
                  onPress={() => navigation.navigate("Cars")}
                />
              </Panel>
            ) : null}
          </>
        ) : (
          <Text>
            {uxText(
              language,
              "Owner access required.",
              "मालिक की पहुँच चाहिए।",
            )}
          </Text>
        )}
      </ContentScroll>
    </View>
  );
}
