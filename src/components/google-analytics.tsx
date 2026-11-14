import Script from "next/script";

/*
  Google Analytics 4, loaded only when NEXT_PUBLIC_GA_ID (e.g. "G-XXXXXXXXXX") is set.
  The site's own report cannot know a visitor's age or gender; GA4 estimates them (Reports → User → Demographics)
  once "Google signals" is turned on in the GA4 property. GA4 also links to Google Ads audiences.
*/
export const gaId = process.env.NEXT_PUBLIC_GA_ID;

export function GoogleAnalytics() {
  if (!gaId) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}');`}
      </Script>
    </>
  );
}
