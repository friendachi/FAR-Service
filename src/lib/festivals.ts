/*
  Monthly festival themes (Thai and international). The site picks the festival of the current month in Bangkok
  time; Super Admin can switch it off or force one in settings (settings.festival_theme: "auto" | "off" | id).
  Colours are dark enough for white text (WCAG AA on the top strip and badges).
*/
export type FestivalIcon =
  | "party" | "sparkles" | "trees" | "droplets" | "hardhat" | "leaf" | "flame" | "heart" | "moon" | "ghost" | "moonstar" | "tree" | "krathong";

export type Festival = {
  id: string;
  month: number; // 1–12
  th: string;
  en: string;
  greetingTh: string;
  greetingEn: string;
  /** what น้องฟาร์ says on the home page this month */
  mascotTh: string;
  mascotEn: string;
  color: string; // strip / badge background (white text)
  accent: string; // decorative second colour
  icon: FestivalIcon;
  /** what น้องฟาร์ holds on every page during the festival */
  mascotPose?: "krathong";
};

export const festivals: Festival[] = [
  { id: "new-year", month: 1, th: "ปีใหม่", en: "New Year", greetingTh: "สวัสดีปีใหม่ ขอให้ปีนี้เป็นปีแห่งความสำเร็จ งานขนส่งราบรื่นทุกเส้นทาง สุขภาพแข็งแรง ร่ำรวยตลอดปี", greetingEn: "Happy New Year — may this be your year of success, with smooth roads, good health and prosperity all year", mascotTh: "สวัสดีปีใหม่ครับ ขอให้ปีนี้งานขนส่งราบรื่น ร่ำรวยตลอดปีนะครับ", mascotEn: "Happy New Year! Smooth hauling and prosperity all year.", color: "#8a5a00", accent: "#ffd34d", icon: "party" },
  { id: "chinese-new-year", month: 2, th: "ตรุษจีน", en: "Chinese New Year", greetingTh: "ซินเจียยู่อี่ ซินนี้ฮวดใช้ ขอให้มั่งมีศรีสุข โชคลาภไหลมาเทมา กิจการรุ่งเรืองดั่งมังกรทะยานฟ้า", greetingEn: "Gong Xi Fa Cai — may fortune flow in and your business soar like a dragon", mascotTh: "ซินเจียยู่อี่ครับ ขอให้โชคลาภไหลมาเทมา กิจการรุ่งเรืองนะครับ", mascotEn: "Gong Xi Fa Cai! May fortune flow your way.", color: "#a8071a", accent: "#f5c542", icon: "sparkles" },
  { id: "thai-elephant-day", month: 3, th: "วันช้างไทย", en: "Thai Elephant Day", greetingTh: "วันช้างไทย ขอให้ธุรกิจมั่นคงแข็งแรงดั่งช้างไทย แบกงานหนักได้ทุกงาน ก้าวไปข้างหน้าอย่างมั่นคง", greetingEn: "Thai Elephant Day — may your business be as strong and steady as the Thai elephant", mascotTh: "วันช้างไทยครับ ขอให้ธุรกิจมั่นคงแข็งแรงดั่งช้างไทยนะครับ", mascotEn: "Thai Elephant Day! Strong and steady like an elephant.", color: "#4d5d24", accent: "#c8d98a", icon: "trees" },
  { id: "songkran", month: 4, th: "สงกรานต์", en: "Songkran", greetingTh: "สุขสันต์วันสงกรานต์ ขอให้น้ำใสเย็นชำระสิ่งไม่ดีให้ไหลผ่านไป เหลือไว้แต่ความสดชื่น และเดินทางกลับบ้านปลอดภัย", greetingEn: "Happy Songkran — may cool water wash away misfortune, leaving freshness and a safe journey home", mascotTh: "สุขสันต์วันสงกรานต์ครับ ขอให้น้ำใสเย็นพาความสดชื่นมาให้นะครับ", mascotEn: "Happy Songkran! May cool water bring you fresh blessings.", color: "#0466a6", accent: "#7fd3ff", icon: "droplets" },
  { id: "labour-day", month: 5, th: "วันแรงงาน", en: "Labour Day", greetingTh: "วันแรงงาน ขอบคุณทุกหยาดเหงื่อของพี่ ๆ คนขับและทีมงานขนส่ง ขอให้ทุกความตั้งใจได้รับผลตอบแทนที่คุ้มค่า", greetingEn: "Labour Day — thank you for every drop of sweat; may all your hard work be richly rewarded", mascotTh: "ขอบคุณทุกหยาดเหงื่อของพี่ ๆ คนขับครับ สุขสันต์วันแรงงาน", mascotEn: "Thank you for all your hard work! Happy Labour Day.", color: "#b23a06", accent: "#ffb27a", icon: "hardhat" },
  { id: "environment-day", month: 6, th: "วันสิ่งแวดล้อมโลก", en: "World Environment Day", greetingTh: "วันสิ่งแวดล้อมโลก ขอให้โลกของเราเขียวขจี อากาศสดใส ร่วมกันขนส่งอย่างใส่ใจ เพื่อโลกที่น่าอยู่ของคนรุ่นต่อไป", greetingEn: "World Environment Day — may our world stay green and our air clear; let's haul with care for the next generation", mascotTh: "ร่วมกันขนส่งอย่างใส่ใจโลกนะครับ วันสิ่งแวดล้อมโลก", mascotEn: "Let's haul with care for the planet!", color: "#166534", accent: "#86efac", icon: "leaf" },
  { id: "buddhist-lent", month: 7, th: "เข้าพรรษา", en: "Buddhist Lent", greetingTh: "เทศกาลเข้าพรรษา ขอให้แสงเทียนนำทางชีวิตสู่ความสงบร่มเย็น ถือศีลงดเหล้า ขับขี่ปลอดภัยตลอดพรรษา", greetingEn: "Buddhist Lent — may the candlelight guide you to peace; abstain from alcohol and travel safely", mascotTh: "ขอให้แสงเทียนพรรษานำทางสู่ความสงบ ขับขี่ปลอดภัยนะครับ", mascotEn: "May the Lent candle light your way to peace.", color: "#9a4b00", accent: "#fcd34d", icon: "flame" },
  { id: "mothers-day", month: 8, th: "วันแม่", en: "Mother's Day", greetingTh: "วันแม่แห่งชาติ ขอให้รักของแม่เป็นพลังใจในทุกเส้นทาง และขอให้ทุกคนได้กลับไปกอดแม่อย่างปลอดภัย", greetingEn: "Mother's Day — may a mother's love power every journey, and bring everyone home safely to her", mascotTh: "วันแม่ปีนี้ กลับไปกอดแม่อย่างปลอดภัยนะครับ", mascotEn: "Mother's Day — get home safely and hug your mum!", color: "#1d4ed8", accent: "#bfdbfe", icon: "heart" },
  { id: "mid-autumn", month: 9, th: "ไหว้พระจันทร์", en: "Mid-Autumn Festival", greetingTh: "เทศกาลไหว้พระจันทร์ ขอให้ชีวิตสมบูรณ์พูนสุขดั่งจันทร์เต็มดวง ครอบครัวพร้อมหน้า กิจการเจริญรุ่งเรือง", greetingEn: "Mid-Autumn Festival — may life be as full as the moon, your family together and your business thriving", mascotTh: "ขอให้ชีวิตสมบูรณ์ดั่งจันทร์เต็มดวงนะครับ", mascotEn: "May life be as full as the moon!", color: "#7c2d12", accent: "#fde68a", icon: "moon" },
  { id: "halloween", month: 10, th: "ฮาโลวีน", en: "Halloween", greetingTh: "Happy Halloween ขอให้เรื่องน่ากลัวทั้งหลายหายไปกับคืนนี้ เหลือไว้แต่ความสนุก และการเดินทางที่ราบรื่น", greetingEn: "Happy Halloween — may every scare vanish with the night, leaving only fun and smooth journeys", mascotTh: "Happy Halloween ครับ ขอให้เรื่องน่ากลัวหายไปกับคืนนี้", mascotEn: "Happy Halloween! May every scare vanish tonight.", color: "#5b21b6", accent: "#fb923c", icon: "ghost" },
  { id: "loy-krathong", month: 11, th: "ลอยกระทง", en: "Loy Krathong", greetingTh: "สุขสันต์วันลอยกระทง ขอให้อุปสรรคทั้งหลายลอยไปกับกระทง เหลือไว้แต่ความสำเร็จที่ส่องสว่างดั่งจันทร์เพ็ญ", greetingEn: "Happy Loy Krathong — may every obstacle float away with the krathong, leaving success as bright as the full moon", mascotTh: "ขอให้อุปสรรคลอยไปกับกระทง เหลือแต่ความสำเร็จนะครับ", mascotEn: "May your obstacles float away with the krathong!", color: "#0b0b12", accent: "#fcd34d", icon: "krathong", mascotPose: "krathong" },
  { id: "christmas", month: 12, th: "คริสต์มาส", en: "Christmas", greetingTh: "Merry Christmas ขอให้ความสุขและของขวัญที่ดีที่สุดมาถึงทุกบ้าน ส่งท้ายปีเก่าอย่างอบอุ่น ต้อนรับปีใหม่ด้วยความหวัง", greetingEn: "Merry Christmas — may joy and the best gifts reach every home; farewell the old year warmly and welcome the new with hope", mascotTh: "Merry Christmas ครับ ขอให้ความสุขมาถึงทุกบ้านนะครับ", mascotEn: "Merry Christmas! Joy to every home.", color: "#14532d", accent: "#ef4444", icon: "tree" },
];

/** The festival for a month (1–12), or the one forced/turned off by the setting. */
export function festivalFor(month: number, setting?: unknown): Festival | null {
  if (setting === "off") return null;
  if (typeof setting === "string" && setting !== "auto") return festivals.find((f) => f.id === setting) ?? null;
  return festivals.find((f) => f.month === month) ?? null;
}

/** Current month in Bangkok (UTC+7). */
export const bangkokMonth = (now = new Date()) => new Date(now.getTime() + 7 * 36e5).getUTCMonth() + 1;
