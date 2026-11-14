/*
  Real trailer photos from the company price deck (Rental cost FAR - Eng.pdf), saved in /public/photos.
  Photos are per model — every trailer of a model shows its model's photos.
*/
const byModel: Record<string, string[]> = {
  "FB-3": ["FB-3-1", "FB-3-2", "FB-3-3", "FB-3-4"],
  "SK40-3": ["SK40-3-1", "SK40-3-2"],
  "SK40-2": ["SK40-2-1", "SK40-2-2"],
  "LB2-STD": ["LB2-STD-1", "LB2-STD-2"],
  "LB2-2S": ["LB2-2S-1", "LB2-2S-2"],
  "LB3-STD": ["LB3-STD-1", "LB3-STD-2"],
  "LB3-SP": ["LB3-SP-1", "LB3-SP-2"],
  "LB3-SPO": ["LB3-SP-1", "LB3-SP-2"],
};

const byType: Record<string, string> = { FLATBED: "FB-3-1", SKELETAL: "SK40-3-1", LOWBED: "LB3-STD-1" };

// Graded copies (neutral white balance, sharpened). Originals stay in /public/photos.
const src = (name: string) => `/photos/models/${name}.jpg`;

/*
  Per-trailer photos, matched by plate number (public/photos/fleet/{plate}-{n}.jpg).
  Neutral white balance (no warm/golden cast), natural brightness, sharpened, all at the same size: -1 is the main 16:10 shot
  (rear-left three-quarter view), -2 the rear and plate, -3 the axles and tyres, -4 an extra angle.
*/
const byPlate: Record<string, number> = {
  "75-0403": 3, "71-9021": 3, "73-0855": 3, "73-0856": 3,
  "73-0612": 3, "73-0616": 3, "73-0617": 3, "73-0618": 4,
  "73-4671": 3, "74-4875": 3, "74-4533": 3, "74-4537": 3, "74-4538": 3, "74-4539": 3, "74-4540": 3,
  "74-8293": 3, "74-8294": 3, "74-8295": 3, "74-8296": 3, "75-0151": 3,
  "73-6319": 3, "63-0803": 3, "63-0854": 3, "74-5117": 3,
};

export const modelPhotos = (code: string) => (byModel[code] ?? []).map(src);

/** This trailer's own photos when we have them (own: true), otherwise its model's sample photos. */
export function trailerPhotos(trailer: { plate: string; model: { code: string }; uploadedPhotos?: { url: string }[] }) {
  // photos uploaded by staff win over the built-in set
  if (trailer.uploadedPhotos?.length) return { own: true, photos: trailer.uploadedPhotos.map((p) => p.url) };
  const n = byPlate[trailer.plate];
  if (n) return { own: true, photos: Array.from({ length: n }, (_, i) => `/photos/fleet/${trailer.plate}-${i + 1}.jpg`) };
  return { own: false, photos: modelPhotos(trailer.model.code) };
}
export const typePhoto = (type: string) => (byType[type] ? src(byType[type]) : undefined);

/** Trailers at work (excavators on lowbeds, the yard) for the home page. */
export const workPhotos = [
  { src: src("profile-flatbed"), alt: "หางพื้นเรียบ 3 เพลา สีเขียว FAR Service" },
  { src: src("profile-chassis"), alt: "หางก้างปลาพ่วงหัวลาก ที่ลานจอด" },
  { src: src("profile-lowbed"), alt: "หางโลว์เบดบรรทุกสินค้าขนาดใหญ่ในโรงงาน" },
];
