"""Versioned starter content. Arihant must approve its inspection standards."""

import json
from pathlib import Path
from uuid import NAMESPACE_URL, UUID, uuid5

from app.workflow_contracts import ChecklistTemplate

PHOTO_CHECKS = [
    (
        "identity",
        "Registration and car",
        "कार और नंबर प्लेट",
        "Show the car and its registration plate.",
        "कार और उसकी नंबर प्लेट की साफ़ फोटो लें।",
    ),
    (
        "odometer",
        "Odometer",
        "किलोमीटर मीटर",
        "Photograph the odometer reading clearly.",
        "किलोमीटर मीटर की संख्या की साफ़ फोटो लें।",
    ),
    (
        "front",
        "Front body",
        "कार का आगे का हिस्सा",
        "Show the whole front of this car.",
        "कार का आगे का पूरा हिस्सा दिखाएँ।",
    ),
    (
        "rear",
        "Rear body",
        "कार का पीछे का हिस्सा",
        "Show the whole rear of this car.",
        "कार का पीछे का पूरा हिस्सा दिखाएँ।",
    ),
    (
        "left",
        "Left side",
        "कार की बाईं तरफ़",
        "Photograph the whole left side.",
        "कार की पूरी बाईं तरफ़ की फोटो लें।",
    ),
    (
        "right",
        "Right side",
        "कार की दाईं तरफ़",
        "Photograph the whole right side.",
        "कार की पूरी दाईं तरफ़ की फोटो लें।",
    ),
    (
        "front-left-tyre",
        "Front-left tyre",
        "आगे का बायाँ टायर",
        "Show the sidewall and tread of the front-left tyre.",
        "आगे के बाएँ टायर का किनारा और निशान दिखाएँ।",
    ),
    (
        "front-right-tyre",
        "Front-right tyre",
        "आगे का दायाँ टायर",
        "Show the sidewall and tread of the front-right tyre.",
        "आगे के दाएँ टायर का किनारा और निशान दिखाएँ।",
    ),
    (
        "rear-left-tyre",
        "Rear-left tyre",
        "पीछे का बायाँ टायर",
        "Show the sidewall and tread of the rear-left tyre.",
        "पीछे के बाएँ टायर का किनारा और निशान दिखाएँ।",
    ),
    (
        "rear-right-tyre",
        "Rear-right tyre",
        "पीछे का दायाँ टायर",
        "Show the sidewall and tread of the rear-right tyre.",
        "पीछे के दाएँ टायर का किनारा और निशान दिखाएँ।",
    ),
    (
        "dashboard",
        "Dashboard",
        "डैशबोर्ड",
        "Photograph the dashboard and record any visible warning.",
        "डैशबोर्ड की फोटो लें। दिखने वाली चेतावनी दर्ज करें।",
    ),
    (
        "interior",
        "Seats and cabin",
        "सीट और केबिन",
        "Show the seats and cabin condition.",
        "सीट और केबिन की हालत दिखाएँ।",
    ),
    (
        "lights",
        "Lights",
        "लाइट",
        "Photograph the lights being checked.",
        "जिन लाइट की जाँच हो रही है उनकी फोटो लें।",
    ),
    (
        "keys",
        "Keys and accessories",
        "चाबी और सामान",
        "Show the keys and accessories received with this car.",
        "कार के साथ मिली चाबी और सामान दिखाएँ।",
    ),
]
QC_CHECKS = [
    (
        "repair",
        "Repaired area",
        "मरम्मत की जगह",
        "Photograph the repaired item linked to this job.",
        "इस काम में जिस चीज़ की मरम्मत हुई उसकी फोटो लें।",
    ),
    (
        "function",
        "Function check",
        "काम की जाँच",
        "Record the check result and photograph the checked item. Ask your supervisor if unsure.",
        "जाँच का नतीजा दर्ज करें और उस चीज़ की फोटो लें। समझ न आए तो मदद माँगें।",
    ),
    (
        "finish",
        "Final condition",
        "अंतिम हालत",
        "Show the final condition and note any remaining issue.",
        "अंतिम हालत दिखाएँ। कोई समस्या बाकी हो तो दर्ज करें।",
    ),
]


def templates_for(company_id: UUID) -> list[ChecklistTemplate]:
    definitions = [
        ("pre_purchase", "Pre-purchase inspection · draft", PHOTO_CHECKS),
        ("intake", "Stock intake · draft", PHOTO_CHECKS[:6] + PHOTO_CHECKS[-3:]),
        ("repair_qc", "Repair evidence & QC · draft", QC_CHECKS),
        ("delivery", "Delivery PDI · draft", PHOTO_CHECKS[:4] + PHOTO_CHECKS[-4:]),
    ]
    starters = [
        ChecklistTemplate(
            id=uuid5(NAMESPACE_URL, f"arihant:{company_id}:{kind}:1"),
            name=name,
            kind=kind,
            version=1,
            approved=False,
            items=[
                {
                    "id": row[0],
                    "title": row[1],
                    "titleHi": row[2],
                    "instruction": row[3],
                    "instructionHi": row[4],
                    "order": index + 1,
                    "required": True,
                }
                for index, row in enumerate(content)
            ],
        )
        for kind, name, content in definitions
    ]
    library = json.loads((Path(__file__).parent / "data/inspection-library-v1.json").read_text())
    starters.append(
        ChecklistTemplate(
            id=uuid5(NAMESPACE_URL, f"arihant:{company_id}:comprehensive:1"),
            name="Vehicle inspection · comprehensive draft",
            kind="pre_purchase",
            version=1,
            approved=False,
            items=library["items"],
        )
    )
    return starters
