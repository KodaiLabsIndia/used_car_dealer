import type { Language } from "../state/copy";
const messages: Record<string, readonly [string, string, string]> = {
  punch_in: ["Attendance marked in", "हाज़िरी शुरू हुई", "हजेरी सुरू झाली"],
  punch_out: ["Attendance marked out", "हाज़िरी बंद हुई", "हजेरी बंद झाली"],
  review_day: [
    "Attendance review saved",
    "हाज़िरी की समीक्षा सेव हुई",
    "हजेरीची तपासणी जतन केली",
  ],
  request_leave: [
    "Leave request sent",
    "छुट्टी का अनुरोध भेजा",
    "रजेची विनंती पाठवली",
  ],
  review_leave: [
    "Leave decision saved",
    "छुट्टी का फैसला सेव हुआ",
    "रजेचा निर्णय जतन केला",
  ],
  request_advance: [
    "Advance request sent",
    "अग्रिम का अनुरोध भेजा",
    "आगाऊ रकमेची विनंती पाठवली",
  ],
  review_advance: [
    "Advance decision saved",
    "अग्रिम का फैसला सेव हुआ",
    "आगाऊ रकमेचा निर्णय जतन केला",
  ],
  pay_advance: [
    "Advance payment recorded",
    "अग्रिम भुगतान दर्ज हुआ",
    "आगाऊ रकमेचे देयक नोंदवले",
  ],
  pay_salary: [
    "Salary payment recorded",
    "वेतन भुगतान दर्ज हुआ",
    "पगाराचे देयक नोंदवले",
  ],
  confirm_salary: [
    "Salary confirmed",
    "वेतन की पुष्टि हुई",
    "पगार निश्चित केला",
  ],
  save_profile: [
    "Pay terms saved",
    "वेतन के नियम सेव हुए",
    "पगाराच्या अटी जतन केल्या",
  ],
  save_advance_plan: [
    "Recovery plan saved",
    "वसूली की योजना सेव हुई",
    "वसुलीची योजना जतन केली",
  ],
  reverse_payment: [
    "Payment correction recorded",
    "भुगतान का सुधार दर्ज हुआ",
    "देयकाची दुरुस्ती नोंदवली",
  ],
  void_salary: [
    "Salary record voided",
    "वेतन रिकॉर्ड रद्द हुआ",
    "पगाराची नोंद रद्द केली",
  ],
  start: ["Repair work started", "मरम्मत शुरू हुई", "दुरुस्ती सुरू झाली"],
  wait_parts: [
    "Part request recorded",
    "पार्ट का अनुरोध दर्ज हुआ",
    "भागाची विनंती नोंदवली",
  ],
  receive_part: ["Part received", "पार्ट मिल गया", "भाग मिळाला"],
  submit_repair: [
    "Repair sent for quality check",
    "मरम्मत की जाँच शुरू हुई",
    "दुरुस्ती तपासणीसाठी पाठवली",
  ],
  reopen: ["Repair reopened", "मरम्मत फिर खोली", "दुरुस्ती पुन्हा उघडली"],
  assign: ["Responsibility assigned", "ज़िम्मेदारी सौंपी", "जबाबदारी नेमली"],
  mark_ready: [
    "Car marked ready for sale",
    "गाड़ी बिक्री के लिए तैयार है",
    "गाडी विक्रीसाठी तयार केली",
  ],
  book: [
    "Car booking recorded",
    "गाड़ी की बुकिंग दर्ज हुई",
    "गाडीचे बुकिंग नोंदवले",
  ],
  extend_booking: [
    "Booking period updated",
    "बुकिंग की अवधि बदली",
    "बुकिंगची मुदत बदलली",
  ],
  cancel_booking: ["Booking cancelled", "बुकिंग रद्द हुई", "बुकिंग रद्द केले"],
  cost: ["Car cost recorded", "गाड़ी का खर्च दर्ज हुआ", "गाडीचा खर्च नोंदवला"],
  sale_receipt: [
    "Buyer receipt recorded",
    "खरीदार की रकम दर्ज हुई",
    "खरेदीदाराची रक्कम नोंदवली",
  ],
  sale_refund: [
    "Buyer refund recorded",
    "खरीदार की वापसी दर्ज हुई",
    "खरेदीदाराचा परतावा नोंदवला",
  ],
  sale_documents: [
    "Sale documents recorded",
    "बिक्री के दस्तावेज़ दर्ज हुए",
    "विक्रीची कागदपत्रे नोंदवली",
  ],
  configure_warranty: [
    "Car warranty saved",
    "गाड़ी की वारंटी सेव हुई",
    "गाडीची हमी जतन केली",
  ],
  deliver: [
    "Car delivery recorded",
    "गाड़ी की डिलीवरी दर्ज हुई",
    "गाडी दिल्याची नोंद केली",
  ],
  complete_transfer: [
    "Ownership transfer recorded",
    "मालिकाना ट्रांसफर दर्ज हुआ",
    "मालकी हस्तांतरण नोंदवले",
  ],
  open_claim: [
    "Customer concern recorded",
    "ग्राहक की शिकायत दर्ज हुई",
    "ग्राहकाची तक्रार नोंदवली",
  ],
  review_claim: [
    "Warranty decision recorded",
    "वारंटी का फैसला दर्ज हुआ",
    "हमीचा निर्णय नोंदवला",
  ],
  close_claim: [
    "Warranty case closed",
    "वारंटी का काम बंद हुआ",
    "हमीचे काम बंद केले",
  ],
  quote: [
    "Workshop quote recorded",
    "वर्कशॉप का अनुमान दर्ज हुआ",
    "वर्कशॉपचा अंदाज नोंदवला",
  ],
  decide_quote: [
    "Quote decision recorded",
    "अनुमान का फैसला दर्ज हुआ",
    "अंदाजाचा निर्णय नोंदवला",
  ],
  invoice: [
    "Workshop bill recorded",
    "वर्कशॉप का बिल दर्ज हुआ",
    "वर्कशॉपचे बिल नोंदवले",
  ],
  vendor_payment: [
    "Workshop payment recorded",
    "वर्कशॉप का भुगतान दर्ज हुआ",
    "वर्कशॉपचे देयक नोंदवले",
  ],
  correct_vendor_payment: [
    "Workshop payment correction recorded",
    "वर्कशॉप भुगतान का सुधार दर्ज हुआ",
    "वर्कशॉपच्या देयकाची दुरुस्ती नोंदवली",
  ],
};
/** Only announce after a successful command; recording a payment never implies a bank transfer. */
export function actionSuccessMessage(
  action: string,
  language: Language,
  fallback: string,
) {
  return (
    messages[action]?.[language === "mr" ? 2 : language === "hi" ? 1 : 0] ??
    fallback
  );
}
