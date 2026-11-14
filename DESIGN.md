---
name: FAR Service
description: Trailer rental web app built as a Thai highway guide sign — sign green, white keyline, reflective yellow action.
colors:
  sign: "#00703c"
  sign-hover: "#005c31"
  sign-deep: "#003b20"
  sign-ink: "#e6f2eb"
  sign-tint: "#e7f3ec"
  sign-wash: "#f3f9f5"
  reflect: "#ffd200"
  reflect-hover: "#f0c400"
  reflect-tint: "#fff6c7"
  ink: "#17201b"
  ink-2: "#46534b"
  ink-3: "#6a776f"
  line: "#d9e1dc"
  line-strong: "#b9c6be"
  paper: "#ffffff"
  ground: "#f5f7f5"
  info: "#1d5fbf"
  info-tint: "#e6eefa"
  warn: "#a35a00"
  warn-tint: "#fdf0dc"
  danger: "#b42318"
  danger-tint: "#fdeceb"
typography:
  display:
    fontFamily: "Anuphan, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "0em"
  heading:
    fontFamily: "Anuphan, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Anuphan, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  route:
    fontFamily: "Overpass, Anuphan, ui-sans-serif, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.1
rounded:
  sm: "8px"
  md: "12px"
  sign: "14px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.reflect}"
    textColor: "{colors.sign-deep}"
    rounded: "{rounded.sm}"
    height: "52px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.reflect-hover}"
  button-sign:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "0 20px"
  button-sign-hover:
    backgroundColor: "{colors.sign-hover}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "48px"
    padding: "0 14px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
  sign-panel:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sign}"
  admin-sidebar:
    backgroundColor: "{colors.sign-deep}"
    textColor: "{colors.sign-ink}"
    width: "256px"
---

# Design System: FAR Service

## Overview

FAR Service is drawn from the Thai Department of Highways guide sign: a green field with a white inner keyline, white lettering, route shields carrying numbers, and arrows that tell you which way to go. Renting a trailer is wayfinding — which yard (shield 1 บางพระ, shield 2 หนองใหญ่), how long (rate tier), what comes next (arrow). The sign is the identity; everything around it is a calm white working surface.

The world lends four things only: the green/white/yellow palette, the bold Thai sign lettering (Anuphan) plus Highway-Gothic-style numerals (Overpass), the yard route shield, and the keyline sign panel. Layout, navigation and controls stay standard web components so staff and drivers recognise them instantly.

Light only. Customers read it in offices; Ops and drivers read it outdoors on phones in direct sun.

## Colors

### Primary
- **Sign Green `#00703c`** — sign panels, primary navigation bar, sign-style buttons, selected states, positive status, prices.
- **Sign Deep `#003b20`** — back-office sidebar, footer, text on yellow.

### Secondary
- **Reflective Yellow `#ffd200`** — the one primary action per screen ("ค้นหาหางว่าง", "จองหางคันนี้", "ส่งคำขอจอง", "เปิด QR เช็กอิน"), the current step of any route, text selection, focus ring.

### Neutral
- **Paper `#ffffff`** content surfaces; **Ground `#f5f7f5`** page field; **Line `#d9e1dc`** hairlines; **Ink `#17201b` / `#46534b` / `#6a776f`** text, all faintly green-tinted.

### State
- Info blue `#1d5fbf`, warn amber `#a35a00`, danger red `#b42318`, each with a pale tint for badge grounds. They appear only where they carry meaning.

### Named Rules
- **One Yellow Rule.** Reflective yellow marks exactly one thing per view: the primary action or the current step. Never decoration.
- **On-Sign Text Rule.** Secondary text on green uses Sign Ink `#e6f2eb`, never grey.

## Typography

- **Anuphan** (Thai + Latin, 400–700) for everything readable. Headings bold, sign-weight.
- **Overpass** (600/800) for route language only: yard/bay codes (`1-A01`), booking numbers, money, times, check-in codes. Always tabular figures for numbers in columns.

### Hierarchy
- Display 34→52px / 700 / 1.18 (sign panel headline only)
- Page title 26–30px / 700
- Section 19–28px / 700
- Body 15–16px / 400 / 1.6; driver and checklist screens ≥17px
- Caption 12–13px (sample-data notes, hints)

### Named Rules
- **Route Numerals Rule.** Codes, money and times are set in Overpass extra-bold; prose never is.

## Layout

- Public pages: max 1280px, 16/24/32px gutters, 12-column flow collapsing to one column on phones.
- Back office: fixed 256px deep-green sidebar on desktop, horizontal scrolling nav strip on phones; content max 1400px; dense hairline tables.
- Driver: single column max 576px, one appointment owns the first viewport, fixed 64px bottom nav, buttons 56–64px tall.
- Booking: content + 360px sticky price summary.

## Elevation & Depth

Flat. Hierarchy comes from the green field, 1px hairlines and 2px selected borders. The only shadow is the soft dropdown under the mobile menu (`0 12px 32px -12px rgba(0,59,32,.35)`).

## Shapes

8px controls, 12px panels, 14px sign panels, pills for badges and filter chips. The route shield is a fixed SVG shape (flat top, curved point).

## Components

### Sign Panel (signature)
Green field, 5px green inset then 3px white keyline (`box-shadow: inset 0 0 0 5px #00703c, inset 0 0 0 8px #fff`), radius 14px. Used for the home hero, yard headers, driver's next appointment, booking confirmation, code plates (`sign-panel-sm`).

### Yard Route Shield (signature)
White shield, green 2.5px stroke, Overpass 800 number. Appears wherever a yard is named: search, cards, tables, timeline, driver screens.

### Buttons
- Primary: reflective yellow, sign-deep text, 52px.
- Sign: green, white text, 44px.
- Outline: 2px green border on white.
- Danger: 2px red border on white.

### Route Steps
Segmented bar: done legs green with a check, current leg yellow, upcoming legs white. Used for the booking wizard and the booking timeline.

### Badges
Pill, pale tint ground, dark text of the same hue, 6px dot.

### Inputs
48px, 2px line border, green on focus, yellow focus ring.

### Navigation
Public: green top bar with white keyline beneath. Admin: deep green sidebar, active item becomes a white tab.

## Do's and Don'ts

### Do:
- Name a yard with its shield every time.
- Show the rate tier and deposit next to every price.
- Label every sample value as sample until real data arrives; use the dashed photo slot until company photos are supplied.

### Don't:
- Don't add gradients, glass, glows or decorative shadows.
- Don't use yellow for anything but the single primary action or current step.
- Don't put a small label above a heading.
- Don't show a discount field anywhere; pricing is rate-tier only.
