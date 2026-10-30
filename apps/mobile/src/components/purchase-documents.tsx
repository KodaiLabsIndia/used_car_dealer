import React, { useEffect, useState } from "react";
import type { Purchase, PurchaseDocuments } from "@arihant/contracts";
import { Choice } from "./forms";
import { Button, ErrorNotice, Text, s } from "./ui";
import { FocusPage, SelectField } from "./workspace";
import { useApp } from "../state/app-context";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
export function PurchaseDocumentChecks({
  purchase,
  busy,
  onSave,
}: {
  purchase: Purchase;
  busy: boolean;
  onSave: (documents: PurchaseDocuments, version: number) => Promise<boolean>;
}) {
  const { language, session } = useApp(),
    hi = language === "hi",
    owner = session!.actor.id,
    key = `purchase-document-draft:${purchase.id}`;
  const [documents, setDocuments] = useState(purchase.documents);
  const [version, setVersion] = useState(purchase.version),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setReady(false);
    void loadLocal<{ documents: PurchaseDocuments; version: number }>(
      owner,
      key,
    )
      .then((saved) => {
        if (active) {
          setDocuments(saved?.documents ?? purchase.documents);
          setVersion(saved?.version ?? purchase.version);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setError(hi ? "ड्राफ्ट नहीं खुला।" : "Could not restore the draft.");
        }
      });
    return () => {
      active = false;
    };
  }, [owner, key, purchase.version]);
  function edit(next: PurchaseDocuments) {
    setDocuments(next);
    void saveLocal(owner, key, { documents: next, version }).catch(() =>
      setError(hi ? "ड्राफ्ट सेव नहीं हुआ।" : "Could not save this draft."),
    );
  }
  async function save() {
    if (await onSave(documents, version))
      await deleteLocal(owner, key).catch(() => {});
  }
  const stale = version !== purchase.version;
  return (
    <FocusPage
      scrollKey="checks"
      footer={
        <Button
          label={hi ? "जाँच सेव करें" : "Save document checks"}
          icon="checkmark-outline"
          busy={busy}
          disabled={!ready || stale}
          onPress={() => void save()}
        />
      }
    >
      {error ? <ErrorNotice message={error} /> : null}
      {stale ? (
        <ErrorNotice
          message={
            hi
              ? "रिकॉर्ड बदल गया। जाँच फिर मिलाएँ।"
              : "The record changed. Reload its checks before saving."
          }
          retry={() => {
            setVersion(purchase.version);
            setDocuments(purchase.documents);
            void deleteLocal(owner, key).catch(() => {});
          }}
        />
      ) : null}
      <Text style={{ fontSize: 20, fontWeight: "600", lineHeight: 28 }}>
        {hi ? "दस्तावेज़ की जाँच" : "Document checks"}
      </Text>
      {(
        [
          [
            "sellerVerified",
            hi ? "विक्रेता की पहचान जाँची" : "Seller identity checked",
          ],
          [
            "registrationVerified",
            hi ? "RC और गाड़ी का मिलान किया" : "Registration matched to car",
          ],
          [
            "ownershipVerified",
            hi
              ? "मालिकाना और बेचने का अधिकार जाँचा"
              : "Ownership and authority to sell checked",
          ],
        ] as const
      ).map(([field, label]) => (
        <Choice
          key={field}
          label={label}
          selected={documents[field]}
          onPress={() => {
            if (!busy && ready)
              edit({ ...documents, [field]: !documents[field] });
          }}
          icon="document-text-outline"
        />
      ))}
      <SelectField
        label={hi ? "लोन की स्थिति" : "Outstanding loan"}
        value={documents.loanStatus}
        options={(
          [
            ["unknown", hi ? "जाँच बाकी" : "Not checked"],
            ["no_loan", hi ? "लोन नहीं है" : "No loan"],
            ["pending", hi ? "लोन निपटाना बाकी है" : "Resolution pending"],
            ["cleared", hi ? "लोन निपटारा जाँचा" : "Resolution verified"],
          ] as const
        ).map(([id, label]) => ({ id, label, icon: "document-text-outline" }))}
        onChange={(value) =>
          edit({
            ...documents,
            loanStatus: value as PurchaseDocuments["loanStatus"],
          })
        }
        disabled={busy || !ready}
      />
      <Text style={s.muted}>
        {hi
          ? "केवल अपनी पूरी की गई जाँच दर्ज करें।"
          : "Record only the checks you have completed."}
      </Text>
    </FocusPage>
  );
}
