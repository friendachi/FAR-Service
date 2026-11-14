/** Thai PromptPay QR payload (EMVCo merchant-presented, tag 29), with the amount fixed. */
const f = (id: string, value: string) => id + String(value.length).padStart(2, "0") + value;

function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** `id` is a mobile number (10 digits), a tax/national id (13 digits) or an e-wallet id (15 digits). */
export function promptPayPayload(id: string, amount: number) {
  const digits = id.replace(/\D/g, "");
  const account =
    digits.length >= 15
      ? f("03", digits)
      : digits.length >= 13
        ? f("02", digits)
        : f("01", ("0000000000000" + "66" + digits.replace(/^0/, "")).slice(-13));
  const body =
    f("00", "01") +
    f("01", "12") +
    f("29", f("00", "A000000677010111") + account) +
    f("53", "764") +
    f("54", amount.toFixed(2)) +
    f("58", "TH") +
    "6304";
  return body + crc16(body);
}
