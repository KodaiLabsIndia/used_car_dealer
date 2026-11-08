import React, { useState } from "react";
import { View } from "react-native";
import type { RoutineItem } from "@arihant/contracts";
import { Field } from "./forms";
import { useApp } from "../state/app-context";
import { routinePhase } from "../application/work-overview";
import { SectionTabs, SelectField } from "./workspace";
import {
  WorkEmpty,
  WorkGrid,
  WorkHeading,
  WorkRow,
  operationColors as c,
} from "./operations";
import { RoutineCard } from "./routine-card";
import { Button, Icon, Text } from "./ui";
export function RoutineBoard({
  items,
  names,
  manager,
  section,
  onOpen,
  onEdit,
  onCreate,
}: {
  items: RoutineItem[];
  names: Record<string, string>;
  manager: boolean;
  section: "today" | "manage" | "history";
  onOpen: (id: string) => void;
  onEdit: (item: RoutineItem) => void;
  onCreate: () => void;
}) {
  const { language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [status, setStatus] = useState<"todo" | "finished">("todo");
  const [lifecycle, setLifecycle] = useState<"active" | "paused">("active");
  const [person, setPerson] = useState("all");
  const [ideas, setIdeas] = useState(false);
  const [search, setSearch] = useState("");
  const due = items.filter((i) => i.dueToday);
  const completed = due.filter((i) => routinePhase(i) === "finished");
  const options = [
    { id: "all", label: tr("All team", "पूरी टीम", "संपूर्ण टीम") },
    ...Array.from(
      new Map(
        items.map((i) => [i.definition.assignedTo, i.assigneeName]),
      ).entries(),
    ).map(([id, label]) => ({ id, label })),
  ];
  const scoped =
    section === "manage"
      ? items.filter(
          (i) =>
            i.currentDefinition.active === (lifecycle === "active") &&
            (!search.trim() ||
              `${i.currentDefinition.title} ${names[i.currentDefinition.assignedTo] ?? i.assigneeName} ${i.currentDefinition.steps.join(" ")}`
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase())),
        )
      : items.filter(
          (i) =>
            (person === "all" || i.definition.assignedTo === person) &&
            (section === "history" ||
              (i.dueToday &&
                (status === "finished"
                  ? routinePhase(i) === "finished"
                  : routinePhase(i) !== "finished"))),
        );
  const groups =
    manager && section !== "manage"
      ? Array.from(new Set(scoped.map((i) => i.definition.assignedTo))).map(
          (id) => ({
            id,
            name: scoped.find((i) => i.definition.assignedTo === id)!
              .assigneeName,
            items: scoped.filter((i) => i.definition.assignedTo === id),
          }),
        )
      : [{ id: "work", name: "", items: scoped }];
  function cadence(i: RoutineItem) {
    const ds = i.currentDefinition.weekdays;
    if (ds.length === 7) return tr("Every day", "हर दिन", "दररोज");
    return ds
      .map(
        (d) =>
          [
            tr("Mon", "सोम", "सोम"),
            tr("Tue", "मंगल", "मंगळ"),
            tr("Wed", "बुध", "बुध"),
            tr("Thu", "गुरु", "गुरु"),
            tr("Fri", "शुक्र", "शुक्र"),
            tr("Sat", "शनि", "शनि"),
            tr("Sun", "रवि", "रवि"),
          ][d],
      )
      .join(" · ");
  }
  return (
    <View style={{ gap: 20 }}>
      {section === "manage" ? (
        <>
          <WorkHeading
            kicker={tr(
              "ROUTINE LIBRARY",
              "रोज़ के कामों की सूची",
              "रोजच्या कामांची यादी",
            )}
            title={tr(
              "Set it up once.\nKeep work consistent.",
              "एक बार तय करें।\nरोज़ सही काम करें।",
              "एकदा ठरवा.\nरोज योग्य काम करा.",
            )}
          />
          <Button
            label={tr("Create routine", "काम बनाएँ", "काम तयार करा")}
            icon="add-outline"
            onPress={onCreate}
          />
          <SectionTabs
            selected={lifecycle}
            onChange={setLifecycle}
            items={[
              {
                id: "active",
                label: tr("In use", "चालू काम", "सुरू कामे"),
                icon: "repeat-outline",
                badge: String(
                  items.filter((i) => i.currentDefinition.active).length,
                ),
              },
              {
                id: "paused",
                label: tr("Paused", "रुके काम", "थांबवलेली"),
                icon: "pause-circle-outline",
                badge: String(
                  items.filter((i) => !i.currentDefinition.active).length,
                ),
              },
            ]}
          />
          <Field
            label={tr(
              "Find a routine or person",
              "काम या कर्मचारी खोजें",
              "काम किंवा कर्मचारी शोधा",
            )}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          <WorkGrid>
            {scoped.map((i) => (
              <View
                key={i.id}
                style={{
                  padding: 18,
                  gap: 14,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 20,
                  backgroundColor: c.card,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <Icon
                    name={
                      i.currentDefinition.active
                        ? "repeat-outline"
                        : "pause-circle-outline"
                    }
                    color="#E8BCA1"
                  />
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {i.currentDefinition.title}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: c.muted }}>
                  {names[i.currentDefinition.assignedTo] ?? i.assigneeName} ·{" "}
                  {cadence(i)} · {i.currentDefinition.steps.length}{" "}
                  {tr("steps", "चरण", "टप्पे")}
                </Text>
                <View style={{ gap: 5 }}>
                  {i.currentDefinition.steps.slice(0, 2).map((step, index) => (
                    <Text key={index} style={{ fontSize: 13, color: c.muted }}>
                      {index + 1}. {step}
                    </Text>
                  ))}
                </View>
                <Button
                  secondary
                  label={tr("Edit routine", "काम बदलें", "काम बदला")}
                  icon="options-outline"
                  onPress={() => onEdit(i)}
                />
              </View>
            ))}
          </WorkGrid>
          <WorkRow
            title={tr(
              "Routine ideas for your showroom",
              "शोरूम के कामों के सुझाव",
              "शोरूमच्या कामांच्या कल्पना",
            )}
            detail={tr(
              "Opening, vehicle care and closing",
              "शोरूम खोलना, गाड़ी की देखभाल और बंद करना",
              "शोरूम उघडणे, गाड्यांची देखभाल व बंद करणे",
            )}
            icon="bulb-outline"
            onPress={() => setIdeas((v) => !v)}
          />
          {ideas ? (
            <View
              style={{
                gap: 10,
                padding: 18,
                borderRadius: 18,
                backgroundColor: c.card,
              }}
            >
              {[
                tr(
                  "Opening: check the keys, gates and parked cars.",
                  "खोलना: चाबी, गेट और खड़ी गाड़ियाँ जाँचें।",
                  "उघडताना: चाव्या, गेट व गाड्या तपासा.",
                ),
                tr(
                  "Showroom care: cleaning, battery and tyre checks.",
                  "देखभाल: सफ़ाई, बैटरी और टायर जाँचें।",
                  "देखभाल: स्वच्छता, बॅटरी व टायर तपासा.",
                ),
                tr(
                  "Closing: reconcile keys and secure the showroom.",
                  "बंद करना: चाबी मिलाएँ और शोरूम सुरक्षित करें।",
                  "बंद करताना: चाव्या मोजा व शोरूम सुरक्षित करा.",
                ),
              ].map((t) => (
                <Text key={t} style={{ fontSize: 14, color: c.muted }}>
                  {t}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {section === "today" ? (
            <>
              <WorkHeading
                kicker={
                  manager
                    ? tr(
                        "TEAM ROUTINES",
                        "टीम के रोज़ के काम",
                        "टीमची रोजची कामे",
                      )
                    : tr(
                        "YOUR ROUTINES",
                        "आपके रोज़ के काम",
                        "तुमची रोजची कामे",
                      )
                }
                title={
                  manager
                    ? tr(
                        "Today’s routine work",
                        "आज के रोज़ के काम",
                        "आजची रोजची कामे",
                      )
                    : tr(
                        "Do one step at a time.",
                        "एक समय पर एक चरण करें।",
                        "एका वेळी एक टप्पा करा.",
                      )
                }
              />
              <Text style={{ fontSize: 14, color: c.muted }}>
                {completed.length}/{due.length}{" "}
                {tr("routines finished", "काम पूरे", "कामे पूर्ण")}
              </Text>
              <SectionTabs
                selected={status}
                onChange={setStatus}
                items={[
                  {
                    id: "todo",
                    label: tr("To do", "करना है", "करायचे"),
                    icon: "ellipse-outline",
                    badge: String(due.length - completed.length),
                  },
                  {
                    id: "finished",
                    label: tr("Finished", "पूरा हुआ", "पूर्ण"),
                    icon: "checkmark-done-outline",
                    badge: String(completed.length),
                  },
                ]}
              />
            </>
          ) : null}
          {manager ? (
            <SelectField
              label={tr("Team member", "कर्मचारी", "कर्मचारी")}
              value={person}
              options={options}
              onChange={setPerson}
            />
          ) : null}
          {groups.map((group) => (
            <View key={group.id} style={{ gap: 12 }}>
              {group.name ? <WorkHeading title={group.name} /> : null}
              <WorkGrid>
                {group.items.map((i) => (
                  <RoutineCard
                    key={i.id}
                    item={i}
                    onPress={() => onOpen(i.id)}
                  />
                ))}
              </WorkGrid>
            </View>
          ))}
        </>
      )}
      {!scoped.length ? (
        <WorkEmpty
          title={
            section === "manage"
              ? tr(
                  "No routines in this list",
                  "इस सूची में रोज़ के काम नहीं",
                  "या यादीत रोजची कामे नाहीत",
                )
              : section === "history"
                ? tr(
                    "No saved work on this date",
                    "इस दिन काम दर्ज नहीं",
                    "या दिवशी नोंदवलेले काम नाही",
                  )
                : status === "finished"
                  ? tr(
                      "Finished routines appear here",
                      "पूरे हुए काम यहाँ दिखेंगे",
                      "पूर्ण कामे येथे दिसतील",
                    )
                  : tr(
                      "No routines to do here",
                      "यहाँ कोई रोज़ का काम बाकी नहीं",
                      "येथे रोजची कामे बाकी नाहीत",
                    )
          }
          detail={
            manager
              ? tr(
                  "Manage repeat days and assignment in the routine library.",
                  "रोज़ के कामों की सूची में दिन और ज़िम्मेदारी तय करें।",
                  "रोजच्या कामांच्या यादीत दिवस व जबाबदारी ठरवा.",
                )
              : tr(
                  "Your assigned work appears on its scheduled days.",
                  "आपको सौंपे काम तय दिन पर दिखेंगे।",
                  "तुम्हाला नेमलेली कामे ठरलेल्या दिवशी दिसतील.",
                )
          }
        />
      ) : null}
    </View>
  );
}
