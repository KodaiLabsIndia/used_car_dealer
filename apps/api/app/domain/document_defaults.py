from app.company_contracts import DocumentPolicy, DocumentRule

# Editable product starters. Publishing is an explicit company policy decision.
STARTERS = [
    ("purchase-rc", "purchase", "Registration certificate", "पंजीकरण प्रमाणपत्र", "नोंदणी प्रमाणपत्र"),
    (
        "purchase-seller",
        "purchase",
        "Seller identity / authority",
        "विक्रेता की पहचान / अधिकार",
        "विक्रेत्याची ओळख / अधिकार",
    ),
    (
        "purchase-agreement",
        "purchase",
        "Signed purchase agreement",
        "हस्ताक्षर किया खरीद समझौता",
        "सही केलेला खरेदी करार",
    ),
    (
        "intake-handover",
        "intake",
        "Vehicle handover receipt",
        "गाड़ी की प्राप्ति रसीद",
        "गाडी ताब्यात घेतल्याची पावती",
    ),
    ("sale-buyer", "sale", "Buyer identity", "खरीदार की पहचान", "खरेदीदाराची ओळख"),
    ("sale-agreement", "sale", "Signed sale agreement", "हस्ताक्षर किया बिक्री समझौता", "सही केलेला विक्री करार"),
    (
        "delivery-receipt",
        "delivery",
        "Customer handover acknowledgement",
        "ग्राहक की डिलीवरी स्वीकृति",
        "ग्राहकाची गाडी मिळाल्याची पोच",
    ),
    (
        "delivery-warranty",
        "delivery",
        "Issued warranty / no-warranty acknowledgement",
        "वारंटी / बिना वारंटी की स्वीकृति",
        "वारंटी / वारंटी नसल्याची पोच",
    ),
    (
        "delivery-transfer",
        "delivery",
        "Ownership transfer papers",
        "मालिकाना ट्रांसफर के कागज़",
        "मालकी हस्तांतरणाची कागदपत्रे",
    ),
]


def starter_policy():
    return DocumentPolicy(
        version=0,
        rules=[
            DocumentRule(id=id, stage=stage, title=en, title_hi=hi, title_mr=mr)
            for id, stage, en, hi, mr in STARTERS
        ],
    )
