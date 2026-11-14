import type { Metadata } from "next";
import { Anuphan, Overpass } from "next/font/google";
import "./globals.css";
import { LANG_KEY } from "@/lib/i18n";

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

// Overpass is a Highway Gothic interpretation: used for route numerals, codes and money.
const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
  weight: ["600", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "FAR Service — เช่าหางเทรลเลอร์ ชลบุรี · Trailer Rental Thailand",
    template: "%s · FAR Service",
  },
  description:
    "เช่าหางพื้นเรียบ หางก้างปลา หางโลว์เบด รับ–คืนเองที่ลานจอดบางพระและหนองใหญ่ จองและส่งเอกสารออนไลน์",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" data-lang="th" suppressHydrationWarning className={`${anuphan.variable} ${overpass.variable} h-full`}>
      <head>
        {/* apply the saved language before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem("${LANG_KEY}");if(l==="en"){document.documentElement.dataset.lang="en";document.documentElement.lang="en"}}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
