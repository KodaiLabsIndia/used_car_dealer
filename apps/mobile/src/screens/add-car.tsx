import { uxText } from "../state/ux-copy";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  createCarSchema,
  vehicleConfigurationSchema,
} from "@arihant/contracts";
import { VehicleConfigurationFields } from "../components/vehicle-configuration";
import { VehicleCataloguePicker } from "../components/vehicle-catalogue-picker";
import { randomUUID } from "expo-crypto";
import type { ScreenProps } from "../navigation";
import { Workspace, FocusPage, SelectField } from "../components/workspace";
import { useSection } from "../state/use-section";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Text,
  s,
} from "../components/ui";
import { Field } from "../components/forms";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
import { sendCommand } from "../application/send-command";
const empty = {
  make: "",
  model: "",
  registration: "",
  year: "",
  odometer: "",
  location: "Arihant showroom",
  assignedTo: "",
  templateId: "",
  catalogueModelId: "",
  configuration: vehicleConfigurationSchema.parse({}),
};
export function AddCarScreen({ navigation }: ScreenProps<"AddCar">) {
  const { api, session, language, changed } = useApp(),
    ownerId = session!.actor.id,
    hi = language === "hi";
  const catalog = useResource("intake-options", async () => ({
    people: await api.people(),
    templates: (await api.templates()).filter((t) =>
      ["pre_purchase", "intake"].includes(t.kind),
    ),
  }));
  const [form, setForm] = useState(empty),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [picker, setPicker] = useState(false),
    [draftSaved, setDraftSaved] = useState(false);
  const draftWrites = useRef(Promise.resolve());
  const steps = ["car", "configuration", "arrival", "assign"] as const;
  const [step, setStep] = useSection("intake", "car", steps);
  const formRef = useRef(form);
  formRef.current = form;
  useEffect(() => {
    let active = true;
    void loadLocal<typeof empty>(ownerId, "intake-draft")
      .catch(() => null)
      .then((saved) => {
        if (active) {
          setForm(
            saved
              ? {
                  ...empty,
                  ...saved,
                  configuration: saved.configuration || empty.configuration,
                }
              : { ...empty, assignedTo: ownerId },
          );
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [ownerId]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setDraftSaved(false);
    const snapshot = formRef.current;
    draftWrites.current = draftWrites.current
      .catch(() => {})
      .then(() => saveLocal(ownerId, "intake-draft", snapshot));
    void draftWrites.current
      .then(() => {
        if (active) setDraftSaved(true);
      })
      .catch(() => {
        if (active)
          setError(
            uxText(
              language,
              "Could not save the draft. Keep this screen open and try again.",
              "मसौदा सेव नहीं हुआ। स्क्रीन खुली रखें और फिर कोशिश करें।",
            ),
          );
      });
    return () => {
      active = false;
    };
  }, [form, ready, ownerId]);
  const edit = (
    key: Exclude<keyof typeof empty, "configuration">,
    value: string,
  ) => {
    if (!busy)
      setForm((v) => ({
        ...v,
        [key]: value,
        ...(["make", "model"].includes(key) ? { catalogueModelId: "" } : {}),
      }));
  };
  async function submit() {
    setError("");
    const parsed = createCarSchema.safeParse({
      commandId: randomUUID(),
      make: form.make,
      model: form.model,
      registration: form.registration,
      year: Number(form.year),
      odometerKm: form.odometer.trim() ? Number(form.odometer) : null,
      location: form.location,
      assignedTo: form.assignedTo,
      templateId: form.templateId,
      dueAt: null,
      configuration: form.configuration,
      catalogueModelId: form.catalogueModelId || null,
    });
    if (!parsed.success) {
      if (!detailsValid()) setStep("car");
      else if (!arrivalValid()) setStep("arrival");
      else setStep("assign");
      setError(
        hi
          ? "गाड़ी की जानकारी, चेकलिस्ट और कर्मचारी चुनें। साल और किलोमीटर जाँचें।"
          : "Complete the car details, checklist and person. Check the year and kilometres.",
      );
      return;
    }
    setBusy(true);
    try {
      await draftWrites.current;
      const { commandId: _id, ...payload } = parsed.data;
      const result = await sendCommand(ownerId, "create-car", payload, (body) =>
        api.createCar(body),
      );
      await deleteLocal(ownerId, "intake-draft");
      setStep("car");
      changed(uxText(language, "Car added", "गाड़ी जुड़ गई"));
      navigation.replace("Car", { id: result.car.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function detailsValid() {
    return createCarSchema
      .pick({ make: true, model: true, registration: true, year: true })
      .safeParse({
        make: form.make,
        model: form.model,
        registration: form.registration,
        year: Number(form.year),
      }).success;
  }
  function arrivalValid() {
    return createCarSchema
      .pick({ location: true, odometerKm: true })
      .safeParse({
        location: form.location,
        odometerKm: form.odometer.trim() ? Number(form.odometer) : null,
      }).success;
  }
  function go(target: typeof step) {
    if (!ready || busy) return;
    if (steps.indexOf(target) > steps.indexOf(step)) {
      if (!detailsValid()) {
        setError(
          hi
            ? "गाड़ी की जानकारी और साल जाँचें।"
            : "Check the car details and year.",
        );
        setStep("car");
        return;
      }
      if (target === "assign" && !arrivalValid()) {
        setError(
          hi ? "जगह और किलोमीटर जाँचें।" : "Check the location and kilometres.",
        );
        setStep("arrival");
        return;
      }
    }
    setError("");
    setStep(target);
  }
  const current = steps.indexOf(step);
  return (
    <>
      <Workspace
        title={uxText(language, "Bring a car in", "गाड़ी जोड़ें")}
        items={[
          {
            id: "car",
            label: hi ? "1 · गाड़ी" : "1 · Car",
            icon: "car-outline",
          },
          {
            id: "configuration",
            label: hi ? "2 · प्रकार" : "2 · Specs",
            icon: "options-outline",
          },
          {
            id: "arrival",
            label: hi ? "3 · प्राप्ति" : "3 · Arrival",
            icon: "location-outline",
          },
          {
            id: "assign",
            label: uxText(
              language,
              "4 · Review & assign",
              "4 · जाँचें और सौंपें",
            ),
            icon: "person-outline",
          },
        ]}
        selected={step}
        onChange={go}
        busy={busy}
      >
        <FocusPage
          scrollKey={step}
          footer={
            <ActionRow>
              {current > 0 ? (
                <Button
                  label={uxText(language, "Back", "पीछे")}
                  secondary
                  disabled={busy}
                  onPress={() => go(steps[current - 1]!)}
                  style={{ flex: 1 }}
                />
              ) : null}
              {current < steps.length - 1 ? (
                <Button
                  label={uxText(language, "Next", "आगे")}
                  icon="arrow-forward-outline"
                  disabled={!ready || busy}
                  onPress={() => go(steps[current + 1]!)}
                  style={{ flex: 2 }}
                />
              ) : (
                <Button
                  label={uxText(
                    language,
                    "Create car & inspection",
                    "गाड़ी और जाँच बनाएँ",
                  )}
                  icon="checkmark-outline"
                  busy={busy}
                  disabled={!ready || !catalog.data}
                  onPress={() => void submit()}
                  style={{ flex: 2 }}
                />
              )}
            </ActionRow>
          }
        >
          {error || catalog.error ? (
            <ErrorNotice
              message={error || catalog.error}
              retry={catalog.refresh}
            />
          ) : null}
          {!ready || (catalog.loading && !catalog.data) ? (
            <ActivityIndicator color="#fff" />
          ) : null}
          {draftSaved ? (
            <Text style={{ fontSize: 12, color: "#A9C4B1" }}>
              {uxText(language, "Saved on this phone", "इस फोन पर सेव है")}
            </Text>
          ) : null}
          {step === "car" ? (
            <Panel style={{ gap: 14 }}>
              <Button
                label={uxText(
                  language,
                  "Find make & model",
                  "ब्रांड और मॉडल ढूँढें",
                )}
                icon="search-outline"
                secondary
                onPress={() => setPicker(true)}
                disabled={busy || !ready}
              />
              <Field
                label={uxText(language, "Make", "कंपनी")}
                value={form.make}
                onChangeText={(v) => edit("make", v)}
                maxLength={60}
                placeholder="Maruti Suzuki"
                editable={!busy && ready}
              />
              <Field
                label={uxText(language, "Model", "मॉडल")}
                value={form.model}
                onChangeText={(v) => edit("model", v)}
                maxLength={80}
                placeholder="Swift VXi"
                editable={!busy && ready}
              />
              <Field
                label={uxText(language, "Registration", "नंबर प्लेट")}
                value={form.registration}
                onChangeText={(v) => edit("registration", v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={24}
                placeholder="MH 01 AB 1234"
                editable={!busy && ready}
              />
              <Field
                label={uxText(language, "Year", "साल")}
                value={form.year}
                onChangeText={(v) => edit("year", v)}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="2022"
                editable={!busy && ready}
              />
            </Panel>
          ) : null}
          {step === "configuration" ? (
            <VehicleConfigurationFields
              value={form.configuration}
              onChange={(configuration) =>
                setForm((v) => ({ ...v, configuration }))
              }
              hi={hi}
              disabled={busy}
            />
          ) : null}
          {step === "arrival" ? (
            <>
              <Text style={{ fontSize: 22, lineHeight: 30, fontWeight: "600" }}>
                {form.make} {form.model}
              </Text>
              <Text style={s.muted}>{form.registration}</Text>
              <Field
                label={hi ? "किलोमीटर (वैकल्पिक)" : "Kilometres (optional)"}
                value={form.odometer}
                onChangeText={(v) => edit("odometer", v)}
                keyboardType="number-pad"
                maxLength={7}
                placeholder="42000"
                editable={!busy && ready}
              />
              <Field
                label={hi ? "गाड़ी कहाँ है?" : "Where is the car?"}
                value={form.location}
                onChangeText={(v) => edit("location", v)}
                maxLength={120}
                editable={!busy && ready}
              />
            </>
          ) : null}
          {step === "assign" ? (
            <>
              <Panel style={{ gap: 6 }}>
                <Text style={{ fontWeight: "600" }}>
                  {form.make} {form.model} · {form.year}
                </Text>
                <Text style={s.muted}>
                  {form.registration} · {form.location}
                </Text>
                <Text style={s.muted}>
                  {uxText(language, "Kilometres", "किलोमीटर")} ·{" "}
                  {form.odometer ||
                    uxText(language, "Not provided", "नहीं दिया")}
                </Text>
              </Panel>
              <SelectField
                label={hi ? "पहली जाँच" : "First inspection"}
                value={form.templateId}
                options={
                  catalog.data?.templates.map((t) => ({
                    id: t.id,
                    label: t.name,
                    detail: `v${t.version} · ${t.items.length} ${hi ? "फोटो" : "photos"} · ${t.approved ? uxText(language, "Approved", "स्वीकृत") : hi ? "ड्राफ्ट · प्रशिक्षण" : "Draft · training"}`,
                    icon: "clipboard-outline",
                  })) || []
                }
                onChange={(value) => edit("templateId", value)}
                disabled={busy || !catalog.data}
              />
              <SelectField
                label={uxText(
                  language,
                  "Who starts this inspection?",
                  "जाँच शुरू कौन करेगा?",
                )}
                value={form.assignedTo}
                options={
                  catalog.data?.people.map((p) => ({
                    id: p.id,
                    label:
                      p.id === ownerId
                        ? `${p.name} · ${hi ? "मैं" : "Me"}`
                        : p.name,
                    icon: "person-outline",
                  })) || []
                }
                onChange={(value) => edit("assignedTo", value)}
                disabled={busy || !catalog.data}
              />
              <Text style={s.muted}>
                {hi
                  ? "ड्राफ्ट चेकलिस्ट को इस्तेमाल से पहले Arihant की मंज़ूरी चाहिए।"
                  : "The inspection can be split between employees after this car is created. Draft checklists need approval before use."}
              </Text>
            </>
          ) : null}
        </FocusPage>
      </Workspace>
      <VehicleCataloguePicker
        open={picker}
        onClose={() => setPicker(false)}
        hi={hi}
        onSelect={(model) =>
          setForm((v) => ({
            ...v,
            make: model.make,
            model: model.model,
            catalogueModelId: model.id,
            configuration: vehicleConfigurationSchema.parse({
              ...v.configuration,
              bodyType: model.bodyType,
            }),
          }))
        }
      />
    </>
  );
}
