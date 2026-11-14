import { redirect } from "next/navigation";

/* The site is a company profile: no online booking, payment or customer accounts. Ask for a quotation instead. */
export default function Page(): never {
  redirect("/quote");
}
