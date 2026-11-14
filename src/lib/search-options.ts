import type { TrailerTypeId } from "./types";

/**
 * Choices in the trailer search box. Each covers one or more trailer models (codes in supabase/fleet.json).
 * The value goes in ?type=…; the older type ids (FLATBED, SKELETAL, LOWBED) still work as wider filters.
 */
export const searchOptions: { id: string; th: string; en: string; type: TrailerTypeId; models: string[] }[] = [
  { id: "SK20-2", th: "หางก้างปลา 20 ฟุต 2 เพลา", en: "Chassis 20 ft, 2 axles", type: "SKELETAL", models: ["SK20-2"] },
  { id: "SK40-2", th: "หางก้างปลา 40 ฟุต 2 เพลา", en: "Chassis 40 ft, 2 axles", type: "SKELETAL", models: ["SK40-2"] },
  { id: "SK40-3", th: "หางก้างปลา 40 ฟุต 3 เพลา", en: "Chassis 40 ft, 3 axles", type: "SKELETAL", models: ["SK40-3"] },
  { id: "FB-3", th: "หางพื้นเรียบ 3 เพลา", en: "Flatbed, 3 axles", type: "FLATBED", models: ["FB-3"] },
  { id: "LB2-STD", th: "โลว์เบด 2 เพลา มาตรฐาน", en: "Lowbed 2 axles, standard", type: "LOWBED", models: ["LB2-STD"] },
  { id: "LB2-SP", th: "โลว์เบด 2 เพลา พิเศษ", en: "Lowbed 2 axles, special", type: "LOWBED", models: ["LB2-2S"] },
  { id: "LB3-STD", th: "โลว์เบด 3 เพลา มาตรฐาน", en: "Lowbed 3 axles, standard", type: "LOWBED", models: ["LB3-STD"] },
  { id: "LB3-SP", th: "โลว์เบด 3 เพลา พิเศษ", en: "Lowbed 3 axles, special", type: "LOWBED", models: ["LB3-SP", "LB3-SPO"] },
];

export const searchOption = (id?: string) => searchOptions.find((o) => o.id === id);

/** Does a trailer match the ?type= value (a search option or a trailer type)? */
export function matchesSearchType(t: { type: string; model: { code: string } }, value?: string) {
  if (!value) return true;
  const o = searchOption(value);
  return o ? o.models.includes(t.model.code) : t.type === value;
}

/** Trailer type behind a ?type= value (for the monthly minimum and headings). */
export const searchTypeOf = (value?: string): string | undefined => searchOption(value)?.type ?? value;
