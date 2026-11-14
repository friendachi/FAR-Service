/*
  Thai / English. Every visible text is written in both languages; the page shows one at a time.
  Server and client components render <T th en/> (both spans in the HTML, CSS hides the other language),
  so switching is instant and pages stay cacheable. Attributes (placeholder, aria-label) use useT() in
  client components.
*/
export type Lang = "th" | "en";
export const LANG_KEY = "far-lang";

/** English names for data stored in Thai. */
export const modelNameEn: Record<string, string> = {
  "FB-3": "3-Axle Flatbed Trailer",
  "SK20-2": "20-Foot 2-Axle Chassis Trailer",
  "SK40-2": "40-Foot 2-Axle Chassis Trailer",
  "SK40-3": "40-Foot 3-Axle Chassis Trailer",
  "LB2-STD": "Standard 2-Axle Lowbed Trailer",
  "LB2-2S": "Special Spec 2-Axle Lowbed Trailer (2-step)",
  "LB3-STD": "Standard 3-Axle Lowbed Trailer",
  "LB3-SP": "Special Spec 3-Axle Lowbed Trailer",
  "LB3-SPO": "Special Spec 3-Axle Lowbed Trailer (open wheel)",
};

/** English trailer type names as used in the company price deck. */
export const typeNameEn: Record<string, string> = { FLATBED: "Flatbed", SKELETAL: "Chassis", LOWBED: "Lowbed" };

export const typeUseEn: Record<string, string> = {
  FLATBED: "General cargo, steel, building materials, pipes",
  SKELETAL: "20- and 40-foot containers",
  LOWBED: "Heavy machinery, backhoes, oversized cargo",
};

export const yardEn: Record<string, { name: string; short: string; address: string; note: string }> = {
  BP: {
    name: "Phanatmawim Bang Phra Yard",
    short: "Bang Phra",
    address: "Bang Phra, Si Racha, Chonburi",
    note: "On the main road by the motorway",
  },
  NY: {
    name: "Phanatmawim Nong Yai Yard",
    short: "Nong Yai",
    address: "Nong Yai, Nong Yai, Chonburi",
    note: "Second yard for lowbed and flatbed trailers",
  },
};

export const hoursEn = (h: string) => h.replace("จ.–ส.", "Mon–Sat");

/** English for document requirements (labels are stored in Thai). */
export const docEn: Record<string, { label: string; rule?: string }> = {
  company_cert: { label: "Company certificate", rule: "With company stamp, issued within the last 6 months" },
  pp20: { label: "VAT registration (P.P.20)", rule: "With company stamp" },
  director_id: { label: "Director's ID card (guarantor)", rule: "Signed as a true copy, no company stamp" },
  director_house: { label: "Director's house registration (guarantor)", rule: "Signed as a true copy, no company stamp" },
  renter_id: { label: "Renter's ID card" },
  renter_house: { label: "Renter's house registration" },
  guarantor_id: { label: "Guarantor's ID card" },
  guarantor_house: { label: "Guarantor's house registration" },
  tractor_book: { label: "Tractor registration book" },
  tractor_policy: { label: "Tractor insurance policy" },
  driver_license: { label: "Tractor driver's licence" },
  driver_id_card: { label: "Tractor driver's ID card" },
};
