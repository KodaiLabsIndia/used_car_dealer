import { can } from "../application/access";
import React from "react";
import { ActivityIndicator, Image, RefreshControl, View } from "react-native";
import { colors } from "@arihant/design-tokens";
import type { ScreenProps } from "../navigation";
import { stageKeys } from "../components/garage-motion";
import { Split } from "../components/layout";
import { Workspace, FocusPage, CarIdentity } from "../components/workspace";
import { CarWork } from "../components/car-work";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Pill,
  Text,
  s,
  stockImages,
} from "../components/ui";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { useSection } from "../state/use-section";
export function CarScreen({ route, navigation }: ScreenProps<"Car">) {
  const { api, t, language, session } = useApp(),
    hi = language === "hi",
    owner = can(session!.actor, "finance");
  const resource = useResource(`car:${route.params.id}`, () =>
    api.car(route.params.id),
  );
  const [section, setSection] = useSection(
    `car:${route.params.id}`,
    "overview",
    ["overview", "work", "issues", "records", "history"] as const,
  );
  const car = resource.data;
  return (
    <Workspace
      title={car ? `${car.make} ${car.model}` : t("cars")}
      context={
        car ? (
          <CarIdentity car={car} detail={t(stageKeys[car.stage])} />
        ) : undefined
      }
      items={[
        {
          id: "overview",
          label: hi ? "सारांश" : "Overview",
          icon: "speedometer-outline",
        },
        { id: "work", label: hi ? "काम" : "Work", icon: "clipboard-outline" },
        {
          id: "issues",
          label: hi ? "समस्याएँ" : "Issues",
          icon: "alert-circle-outline",
        },
        {
          id: "records",
          label: hi ? "रिकॉर्ड" : "Records",
          icon: "folder-open-outline",
        },
        {
          id: "history",
          label: hi ? "इतिहास" : "History",
          icon: "time-outline",
        },
      ]}
      selected={section}
      onChange={setSection}
    >
      {!car ? (
        <FocusPage>
          {resource.error ? (
            <ErrorNotice message={resource.error} retry={resource.refresh} />
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </FocusPage>
      ) : section === "overview" ? (
        <FocusPage
          scrollKey="overview"
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
                label={hi ? "खरीद" : "Purchase"}
                secondary
                icon="wallet-outline"
                onPress={() =>
                  navigation.navigate("Purchase", { carId: car.id })
                }
                style={{ flex: 1 }}
              />

              <Button
                label={hi ? "काम खोलें" : "Open work"}
                icon="clipboard-outline"
                onPress={() => setSection("work")}
                style={{ flex: 1 }}
              />
            </ActionRow>
          }
        >
          {resource.error ? (
            <ErrorNotice
              message={resource.offline ? t("offline") : resource.error}
              retry={resource.refresh}
            />
          ) : null}
          <Split
            first={
              <>
                <View
                  style={{
                    borderRadius: 14,
                    overflow: "hidden",
                    height: 140,
                    backgroundColor: "#272727",
                  }}
                >
                  <Image
                    source={stockImages[car.imageKey]}
                    accessibilityLabel={`${car.make} ${car.model}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      resizeMode:
                        car.imageKey === "generic" ? "contain" : "cover",
                    }}
                  />
                </View>
                <View style={[s.row, { flexWrap: "wrap", gap: 7 }]}>
                  <Pill label={t(stageKeys[car.stage])} />
                  {car.commercialStatus === "booked" ? (
                    <Pill label={t("booked")} />
                  ) : null}
                  {car.serviceStatus === "waiting_parts" ? (
                    <Pill
                      label={hi ? "पार्ट का इंतज़ार" : "Waiting for parts"}
                      warning
                    />
                  ) : null}
                </View>
              </>
            }
            second={
              <Panel style={{ gap: 10 }}>
                <Text style={s.label}>{t("nextStep").toUpperCase()}</Text>
                <Text
                  style={{ fontSize: 20, lineHeight: 28, fontWeight: "600" }}
                >
                  {car.nextAction}
                </Text>
                <View style={s.divider} />
                <Text style={s.muted}>{t("location")}</Text>
                <Text>{car.location}</Text>
                {owner ? (
                  <Button
                    secondary
                    label={
                      hi ? "खर्च, बिक्री और सहायता" : "Costs, sale & support"
                    }
                    icon="briefcase-outline"
                    onPress={() =>
                      navigation.navigate("Business", { carId: car.id })
                    }
                  />
                ) : null}
                <Text style={{ color: colors.muted }}>
                  {car.year}
                  {car.odometerKm !== null
                    ? ` · ${car.odometerKm.toLocaleString("en-IN")} km`
                    : ""}
                </Text>
                {car.dueAt ? (
                  <Text>
                    {t("due")} ·{" "}
                    {new Date(car.dueAt).toLocaleDateString(
                      hi ? "hi-IN" : "en-IN",
                    )}
                  </Text>
                ) : null}
              </Panel>
            }
          />
        </FocusPage>
      ) : section === "records" ? (
        <FocusPage scrollKey="records">
          <Text style={s.title}>
            {hi ? "इस कार के रिकॉर्ड" : "This car’s records"}
          </Text>
          <Button
            secondary
            label={hi ? "कार की जगह, चाबी और रोक" : "Custody, keys & holds"}
            icon="key-outline"
            onPress={() => navigation.navigate("Stock", { carId: car.id })}
          />
          <Button
            secondary
            label={hi ? "निजी कागज़ात और बिल" : "Private documents & bills"}
            icon="documents-outline"
            onPress={() => navigation.navigate("Documents", { carId: car.id })}
          />
          {owner ? (
            <>
              <Button
                secondary
                label={
                  hi ? "खरीद और विक्रेता भुगतान" : "Purchase & seller payments"
                }
                icon="wallet-outline"
                onPress={() =>
                  navigation.navigate("Purchase", { carId: car.id })
                }
              />
              <Button
                secondary
                label={hi ? "खर्च, बिक्री और सहायता" : "Costs, sale & support"}
                icon="briefcase-outline"
                onPress={() =>
                  navigation.navigate("Business", { carId: car.id })
                }
              />
              <Button
                secondary
                label={hi ? "AI ड्राफ्ट सहायक" : "AI draft assistant"}
                icon="sparkles-outline"
                onPress={() =>
                  navigation.navigate("Assistant", { carId: car.id })
                }
              />
            </>
          ) : null}
        </FocusPage>
      ) : (
        <CarWork
          car={car}
          section={section}
          onOpenIssues={() => setSection("issues")}
        />
      )}
    </Workspace>
  );
}
