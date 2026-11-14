# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS + Supabase (user-specified). Phase 1 is UI only with mock data; Supabase is not wired yet.

## Users

Two groups weighted equally (confirmed):
- **Customers** — Thai transport companies (นิติบุคคล) and individual operators (บุคคลธรรมดา) who own their own tractor heads and rent semi-trailers for weeks to months. They compare availability by yard, read rate tiers and deposit, and submit contract documents. Desktop and phone.
- **Staff** — Sales/CS (document review, approval, booking on behalf of callers), Ops at the two yards (pickup/return check-in, condition checklists on phone/tablet outdoors), Super Admin (revenue, settings, approvals of Sales' work).
- **Drivers** — the customer's tractor drivers, phone-only, often not tech-comfortable; they need the appointment, yard map, and check-in QR, and they sign off on condition reports at the yard.

## Product Purpose

FAR Service rents semi-trailers (flatbed / พื้นเรียบ, skeletal / ก้างปลา, lowbed / โลว์เบด) from two yards in Chonburi. The product replaces phone/LINE/paper with one flow: search → book → upload documents → approval → pay (PromptPay or transfer + slip) → pick up at yard with checklist → return (any yard) → settle deposit. Success: most bookings go through the system, approval within 4 working hours, zero double bookings, higher utilisation.

## Positioning

Trailer-only rental with self pickup/return at two owned yards (บางพระ ศรีราชา, หนองใหญ่), return to either yard free, transparent rate tiers by contract length (day/week/month) with no negotiated discounts, and photo-evidenced condition reports that the customer's driver signs.

## Operating Context

- Yards are outdoor lots; Ops work on phones/tablets in sun, gloves, poor signal.
- Contract documents are Thai legal paperwork: company certificate and ภ.พ.20 must bear the company stamp; director ID/house registration must be signed "certified true copy" without stamp. Every contract has a guarantor. Tractor registration, tractor insurance and driver licence are also required.
- Payment is PromptPay QR or bank transfer with slip; no cards.
- Full spec lives in `PRD.md` (v1.3) — decisions D1–D17 are binding.

## Capabilities and Constraints

- Roles: Super Admin, Sales/CS, Staff (Ops), Customer, Driver; access matrix in PRD §5.
- Deposit: flatbed/skeletal ฿20,000, lowbed ฿30,000 per trailer.
- Early termination recalculated by actual days and matching rate tier; pre-pickup cancellation incurs a fee (amount undecided).
- Staff may book on behalf of customers; Sales' bookings/payments need Super Admin approval; Super Admin may self-approve.
- Undecided: cancellation fee amount, instalment billing for long contracts, partial-day rounding, late return rule, VAT-inclusive pricing (see PRD §15).
- Language: Thai first; dates in พ.ศ.; currency THB.

## Brand Commitments

- Name: FAR Service.
- Colour direction is binding: green and white (เขียว–ขาว).
- Logo and real photos of trailers/yards exist and will be supplied later; until then use clearly marked placeholders, never stock photos posing as the company's fleet.

## Evidence on Hand

- Yard addresses and map links (PRD §1.3).
- No real fleet count, prices, customer names, testimonials or statistics yet — do not fabricate them as fact; mock data must read as sample data.

## Product Principles

1. Price and deposit are never hidden: show the rate tier applied and the total before commitment.
2. Paperwork is the bottleneck — make every document requirement explicit, reusable, and checkable.
3. Evidence over trust: every handover produces photos, a checklist and a driver signature.
4. Each role sees only its job; staff screens favour speed and scanability, driver screens favour large targets and zero reading.

## Accessibility & Inclusion

WCAG 2.1 AA contrast; outdoor yard use and low-tech drivers require large touch targets (≥48px) and high-contrast text on driver/ops screens.
