/** Company details. Defaults from the business card and price deck; Super Admin can edit them (settings.company). */
export type Company = {
  nameTh: string;
  nameEn: string;
  taxId: string;
  addressTh: string;
  addressEn: string;
  phone: string;
  email: string;
  facebook: string;
  facebookUrl: string;
  profileTh: string;
  profileEn: string;
};

export const DEFAULT_COMPANY: Company = {
  nameTh: "บริษัท เอฟ เอ อาร์ เซอร์วิส จำกัด",
  nameEn: "FAR Service Co., Ltd.",
  taxId: "0205566068063",
  addressTh: "619 ม.2 ต.หนองใหญ่ อ.หนองใหญ่ จ.ชลบุรี 20190",
  addressEn: "619 Moo 2, Nong Yai Subdistrict, Nong Yai District, Chonburi 20190",
  phone: "090-289-4964",
  email: "farservice23@gmail.com",
  facebook: "FAR Trailer Rental Thailand",
  facebookUrl: "https://www.facebook.com/profile.php?id=100044744628277",
  profileTh:
    "FAR Service คือทางเลือกที่ไว้วางใจได้สำหรับการเช่าหางเทรลเลอร์หลากหลายประเภทและสเปก ทั้งหางก้างปลาสำหรับตู้คอนเทนเนอร์ หางพื้นเรียบ หางโลว์เบด และอื่น ๆ\n" +
    "บริการเช่าที่สะดวก ไม่ยุ่งยาก เหมาะกับงานขนส่งและงานก่อสร้าง ทั้งระยะสั้นและระยะยาว พร้อมบริการซ่อมบำรุงและช่วยเหลือกรณีหางเสียรวมอยู่ในค่าเช่า",
  profileEn:
    "FAR Service is the trusted choice for trailer rental across many types and specifications, including container chassis semi-trailers, flatbed semi-trailers, lowbed flat deck (lowboy) semi-trailers and more.\n" +
    "Hassle-free trailer rental from FAR Service is a perfect fit for logistics and construction projects, short or long term. Maintenance and breakdown services are included.",
};

export const LINE_QR = "/brand/line-qr.jpg";

/** "090-289-4964" → "tel:+66902894964" */
export const telHref = (phone: string) => `tel:+66${phone.replace(/\D/g, "").replace(/^0/, "")}`;

export const COMPANY_PHONE = DEFAULT_COMPANY.phone;
export const COMPANY_PHONE_TEL = telHref(COMPANY_PHONE);
