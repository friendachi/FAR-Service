import "server-only";

/*
  Sends staff an alert on LINE whenever a customer sends a request (quotation, extra service, contact message).
  Uses the LINE Messaging API (LINE Notify was shut down in March 2025). Needs, in .env.local / the host:
    LINE_CHANNEL_ACCESS_TOKEN  long-lived channel access token of the company's LINE Official Account
    LINE_ALERT_TO              one or more user / group ids to notify, comma-separated (e.g. the staff group)
  Without them the alert is skipped silently; a failed alert never blocks the customer's request.
*/
export const lineAlertConfigured = () => !!(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_ALERT_TO);

export async function sendLineAlert(text: string) {
  if (!lineAlertConfigured()) return;
  const to = process.env.LINE_ALERT_TO!.split(",").map((s) => s.trim()).filter(Boolean);
  const body = { messages: [{ type: "text", text: text.slice(0, 4900) }] };
  await Promise.all(
    to.map((id) =>
      fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
        body: JSON.stringify({ to: id, ...body }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined),
    ),
  );
}

/** "📥 title" followed by "label: value" lines, skipping empty values. */
export function alertText(title: string, rows: [string, string | number | null | undefined | false][]) {
  return [`📥 ${title}`, ...rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false).map(([k, v]) => `${k}: ${v}`)].join("\n");
}
