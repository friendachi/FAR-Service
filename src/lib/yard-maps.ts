/*
  Google Maps satellite view of each yard (embedded, no API key needed). Locations come from the yards'
  map links: both point at named Google places.
*/
const where: Record<string, string> = {
  // owner-supplied link https://share.google/1lKt1CMxIBFrkyWww → Google place "PSS TRAILER AND SERVICE COMPANY LIMITED"
  BP: "PSS TRAILER AND SERVICE COMPANY LIMITED บางพระ ศรีราชา ชลบุรี",
  NY: "บริษัท สยามอีเลฟเฟนท์ เซอร์วิส จำกัด หนองใหญ่ ชลบุรี",
};

export function yardMapEmbed(code: string, address: string) {
  const q = where[code] ?? address;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=k&z=17&hl=th&output=embed`;
}
