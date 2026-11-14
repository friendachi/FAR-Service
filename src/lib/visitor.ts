/*
  Reads a browser's user-agent string into device type, operating system and browser for the traffic report,
  and names where a visit came from. Kept small on purpose; unknown values stay "อื่น ๆ".
*/

export type Agent = { bot: boolean; device: "mobile" | "tablet" | "desktop"; os: string; browser: string };

export function parseUserAgent(ua: string): Agent {
  const bot = !ua || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|node-fetch/i.test(ua);

  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua));
  const tablet = ipad || /Tablet/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android/i.test(ua);
  const device = tablet ? "tablet" : mobile ? "mobile" : "desktop";

  const os = ipad
    ? "iPadOS"
    : /iPhone|iPod/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(ua)
              ? "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "อื่น ๆ";

  const browser = /\bLine\//i.test(ua)
    ? "LINE (ในแอป)"
    : /FBAN|FBAV|FB_IAB|FBIOS/.test(ua)
      ? "Facebook (ในแอป)"
      : /Instagram/.test(ua)
        ? "Instagram (ในแอป)"
        : /TikTok|musical_ly|BytedanceWebview/i.test(ua)
          ? "TikTok (ในแอป)"
          : /SamsungBrowser/.test(ua)
            ? "Samsung Internet"
            : /Edg\//.test(ua)
              ? "Edge"
              : /OPR\/|Opera/.test(ua)
                ? "Opera"
                : /Firefox|FxiOS/.test(ua)
                  ? "Firefox"
                  : /Chrome|CriOS/.test(ua)
                    ? "Chrome"
                    : /Safari/.test(ua)
                      ? "Safari"
                      : "อื่น ๆ";

  return { bot, device, os, browser };
}

/** Where the visit came from: an ad campaign tag, a known site, an app, or "เข้าเว็บโดยตรง". */
export function sourceOf(
  referrer: string | null,
  utmSource: string | null,
  fbclid: string | null,
  gclid: string | null,
  browser: string,
): string {
  if (gclid) return "Google Ads";
  if (utmSource) return utmSource.slice(0, 80);
  if (fbclid) return "Facebook";
  let host = "";
  try {
    host = referrer ? new URL(referrer).hostname.replace(/^www\.|^m\.|^l\./, "") : "";
  } catch {}
  if (/google\./.test(host)) return "Google (ค้นหา)";
  if (/facebook\.com|fb\.com|messenger\.com/.test(host)) return "Facebook";
  if (/line\.me|line-apps|naver\.jp/.test(host)) return "LINE";
  if (/instagram\.com/.test(host)) return "Instagram";
  if (/tiktok\.com/.test(host)) return "TikTok";
  if (/youtube\.com|youtu\.be/.test(host)) return "YouTube";
  if (/bing\.com/.test(host)) return "Bing (ค้นหา)";
  if (host) return host.slice(0, 80);
  if (browser.startsWith("LINE")) return "LINE";
  if (browser.startsWith("Facebook")) return "Facebook";
  return "เข้าเว็บโดยตรง";
}
