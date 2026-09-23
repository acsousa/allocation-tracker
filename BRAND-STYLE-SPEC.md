# Quartermaster — Brand Style Spec

General-purpose color, type and formatting rules for everything Quartermaster: app, site, social,
video, slides, print. Values match `Quartermaster Redesign v2.dc.html` (the current source of
truth). For app implementation detail see `design_handoff_quartermaster_redesign/STYLE-SPEC.md`;
for landing-page motion see `quartermaster-motion/MOTION-SPEC.md`.

---

## 1 · Personality

**A quiet instrument, not a market.** Analytical, patient, precise. Plain-spoken and honest about
what it doesn't know. Never hype, never urgency, never stock-ticker energy.

- One idea per frame / slide / section.
- Real numbers, stated plainly. Hedges go in fine print, not in the headline.
- Color carries meaning (see §3). It's never decoration.

---

## 2 · Name, domain, core line

| Item | Rule |
|---|---|
| Product name | **Quartermaster** — one word. Wordmark set in caps (see §6). |
| Domain | **realallocation.com** — always lowercase, no `www`. |
| Owned term | **your real allocation** — always lowercase, always possessive. |
| Foil | **a reported allocation** — what each institution shows you. |
| Hero line | **Every account. One real allocation.** |
| Support line | Every institution shows you a reported allocation — its own slice, in isolation. Nobody shows you the whole. |
| Verb | "run your real allocation" = do the quarterly check-in. |

Never: "RealAllocation™", "Real Allocation" (title case), "true allocation", "blended allocation",
account counts ("six accounts"), "download the file".

---

## 3 · Color

### 3.1 Core palette (light)

| Role | Name | Hex | Use |
|---|---|---|---|
| Primary | **Accent blue** | `#0F6493` | Allocation, primary actions, headline emphasis |
| Primary deep | Accent ink | `#0A4A6D` | Gradient end, blue text on light, pressed state |
| Support | **Teal** | `#1E8175` | Tax and asset location |
| Support | **Plum** | `#6C5AA8` | Goals, projections, Outlook |
| Support | **Amber** | `#96590B` | Caution, out-of-band, stale data |
| Highlight | Gold | `#C08A2E` | The amber underline on active tabs; REIT in charts |
| Semantic | Positive | `#1C7150` | Gains, correct placement, clean result |
| Semantic | Negative | `#A83F33` | Losses, misplacement — only when money is actually at risk |

### 3.2 Neutrals (light)

| Name | Hex | Use |
|---|---|---|
| Ink | `#151823` | Headlines, primary text, dark-band background |
| Ink 2 | `#48525C` | Body text |
| Ink 3 | `#7A8590` | Labels, captions, meta |
| Line | `#D6DCDA` | Borders |
| Line 2 | `#E8ECE9` | Interior dividers |
| Sunk | `#EBEFEB` | Tracks, wells |
| Paper | `#F2F4F1` | Page/canvas background |
| Panel 2 | `#F7F9F7` | Alternate section background |
| Panel | `#FFFFFF` | Cards and panels |

### 3.3 Soft tints (for callout grounds and badges)

| Name | Hex |
|---|---|
| Accent soft | `#DBEAF5` |
| Accent wash | `#F0F7FC` |
| Teal soft | `#DCEFEB` |
| Plum soft | `#E8E4F5` |
| Amber soft | `#FBEDD0` |
| Positive soft | `#DCF0E6` |
| Negative soft | `#FAE3E0` |

### 3.4 Dark palette

Use for dark video frames, the dark marketing band, and dark mode.

| Role | Hex | | Role | Hex |
|---|---|---|---|---|
| Background | `#0B0D14` | | Accent blue | `#57ACDC` |
| Panel | `#151823` | | Teal | `#45BFAE` |
| Panel 2 | `#1C2030` | | Plum | `#A99BE0` |
| Line | `#2B3140` | | Amber | `#E5AE4C` |
| Text | `#ECEFF3` | | Positive | `#4FC894` |
| Text 2 | `#AAB4C0` | | Negative | `#E3826F` |
| Text 3 | `#7B8694` | | | |

**Rule:** the dark-palette accents are light. Text *on* a dark-palette accent fill must be
near-black (`#08131B`), never white. On the light palette, text on any accent fill is `#FFFFFF`.

### 3.5 Chart / asset-class colors

Always assign in this order so a class is the same color everywhere.

| Class | Light | Dark |
|---|---|---|
| US equity | `#1B6F9B` | `#4FA0CB` |
| International equity | `#1E8175` | `#45BFAE` |
| REIT | `#C08A2E` | `#DEA94A` |
| Bonds | `#6C5AA8` | `#A99BE0` |
| Cash | `#8A949E` | `#A6B0B9` |
| Other / blended | `#A4566B` | `#C97E92` |

### 3.6 Meaning map

| Color | Always means |
|---|---|
| Blue | Your real allocation · the main action |
| Teal | Tax, where each holding sits |
| Plum | Goals, the future, projections |
| Amber | Look at this — drift, stale data, a held-back trade |
| Green | Clean — inside band, $0 tax, correct placement |
| Red | Money actually at risk. Rare. |

### 3.7 Signature gradients (use sparingly — one per frame max)

| Name | Value | Use |
|---|---|---|
| Closing band | `linear-gradient(105deg, #0F6493 0%, #196D63 100%)` | CTA / end card, white text |
| Active tab | `linear-gradient(150deg, #0F6493 0%, #0A4A6D 100%)` + 3px `#C08A2E` underline | Selected state |
| Hero wash | `linear-gradient(160deg, #F0F7FC 0%, #FFFFFF 62%)` | Light hero backgrounds |

### 3.8 Proportion

Roughly **70% neutral · 20% blue · 10% everything else.** Any single frame uses blue plus at most
two support colors.

---

## 4 · Typography

### 4.1 Families

| Family | Weights | Role |
|---|---|---|
| **Barlow Condensed** | 500 · 600 · 700 | Headlines, numbers, labels, the wordmark |
| **Barlow** | 400 · 500 · 600 · 700 | Body copy, UI text |
| **IBM Plex Mono** | 400 · 500 | Tickers, filenames, code, technical asides |

All three are free on Google Fonts. Fallbacks: `system-ui, sans-serif` / `ui-monospace, monospace`.

### 4.2 Roles

| Role | Font | Weight | Case | Tracking | Line height |
|---|---|---|---|---|---|
| Display / hero | Barlow Condensed | 700 | Sentence | −1.5% | 0.94 |
| Headline | Barlow Condensed | 700 | Sentence | 0 | 1.02 |
| Big number | Barlow Condensed | 700 | — | 0, tabular figures | 1.0 |
| Eyebrow / label | Barlow Condensed | 600 | UPPERCASE | +15–20% | 1.2 |
| Wordmark | Barlow Condensed | 700 | UPPERCASE | +8% | 1 |
| Body | Barlow | 400 | Sentence | 0 | 1.5 |
| Emphasis in body | Barlow | 600 | Sentence | 0 | 1.5 |
| Data / ticker | IBM Plex Mono | 500 | As written | 0 | 1.4 |

### 4.3 Web / app scale

| Role | Size |
|---|---|
| Hero | 86–104px |
| Section headline | 46–58px |
| Panel headline | 30–34px |
| Big number | 32–50px |
| Body large | 19–21px |
| Body | 15–16px |
| Table / UI | 13.5–14px |
| Eyebrow | 11–13px |
| Fine print (minimum) | 12.5px |

### 4.4 Video scale

For **1080 × 1920 (9:16)** and **1920 × 1080 (16:9)**. Sizes in px at native resolution.

| Role | 9:16 | 16:9 |
|---|---|---|
| Hero line | 120–150 | 110–140 |
| Headline | 84–100 | 72–90 |
| Big number | 160–220 | 140–200 |
| Eyebrow | 34–40 | 28–34 |
| Body / subtitle | 44–52 | 36–44 |
| Caption / legal (minimum) | 30 | 26 |
| Burned-in captions | 52, Barlow 600 | 44, Barlow 600 |

- Max **~8 words per line**, **3 lines per frame**.
- Hold any readable line at least **1.5s + 0.3s per word**.

### 4.5 Rules

- Headlines are sentences with a period. "Every account. One real allocation."
- Emphasize one phrase per headline by coloring it accent blue — never bold + color + underline.
- Numbers always use tabular (monospaced) figures.
- Negative values use a true minus sign `−` (U+2212), not a hyphen.
- Money: `$1,301,900` in full; `$1.30M` only when space is tight. Percent: `80.6%`. Drift: `+3.6pp`.
- Eyebrows get a short rule before them: a 26 × 2px bar in the eyebrow's color.

---

## 5 · Shape, depth, layout

### 5.1 Radius

| Token | Value | Use |
|---|---|---|
| sm | 10px | Inputs, small chips |
| md | 14px | Panels, cards |
| lg | 18px | Marketing cards, dialogs, video cards |
| pill | 999px | Every button, tag, badge, progress bar |

### 5.2 Borders

- Panels: 1px `#D6DCDA` (light) / `#2B3140` (dark).
- **Colored top cap:** a 3px top border in the meaning color identifies what a card is about —
  the system's signature device. Use it on video cards too.
- **Callout:** 3px left rule + soft tint background.

### 5.3 Shadow (light surfaces only)

| Name | Value |
|---|---|
| Small | `0 1px 2px rgba(21,24,35,.04), 0 14px 30px -26px rgba(21,24,35,.45)` |
| Medium | `0 1px 2px rgba(21,24,35,.04), 0 20px 38px -24px rgba(21,24,35,.50)` |
| Large (product shots) | `0 22px 46px -34px rgba(21,24,35,.50)` |
| Primary button | `0 16px 34px -18px rgba(15,100,147,.85)` |

### 5.4 Spacing

8px base. Common steps: 8 · 12 · 16 · 20 · 26 · 34 · 56 · 92.
Default card padding 26px; gap between cards 20px.

### 5.5 Video frame layout

| | 9:16 (1080×1920) | 16:9 (1920×1080) |
|---|---|---|
| Outer margin | 72px sides | 120px sides, 96px top/bottom |
| Top safe zone | keep text below 220px | — |
| Bottom safe zone | keep text above 1560px (UI overlays) | keep text above 960px |
| Text column | ≤ 936px | ≤ 1100px |
| Alignment | Left or centered — pick one per video | Left |

---

## 6 · Logo

A quartered ring, open at the lower right, with a tick crossing the gap. It reads as the allocation
donut, as a **Q**, and as the gap between what you hold and what you meant to hold.

| Version | Arcs | Tick | Use |
|---|---|---|---|
| Four-hue (light) | `#1B6F9B` `#1E8175` `#6C5AA8` `#C08A2E` | `#151823` | Default at 24px+ |
| Four-hue (dark) | `#57ACDC` `#45BFAE` `#A99BE0` `#E5AE4C` | `#ECEFF3` | Dark backgrounds |
| Mono | one color | `#0F6493` | Below 24px, favicon, on color fields |

- Lockup: mark + **QUARTERMASTER** (Barlow Condensed 700, caps, +8% tracking). Gap between mark
  and word ≈ 0.45 × mark height.
- Clear space: one ring-stroke width on all sides.
- Never rotate (the opening must stay lower-right). Never fill the ring. Never add a fifth segment.
- SVG path data: see the `<svg viewBox="0 0 32 32">` in `Quartermaster Redesign v2.dc.html`.

---

## 7 · Components (quick reference)

| Element | Spec |
|---|---|
| Primary button | Pill, `#0F6493` fill, white Barlow 600, primary-button shadow |
| Secondary button | Pill, 1px `#D6DCDA` border, ink text, white fill |
| Tag / badge | Pill, soft tint fill, full-strength text of same hue, Barlow Condensed 600 caps |
| Card | 14–18px radius, white, 1px line, 3px colored top cap, small shadow |
| Callout | 3px left rule in meaning color, soft tint ground |
| Progress bar | Pill track `#EBEFEB`, pill fill in meaning color |
| Drift meter | Track = ±6pp, soft-blue band shading, thin center tick, marker green in-band / amber out-of-band |

---

## 8 · Motion

**Calm and purposeful.** Nothing bounces, spins, or ticks.

| Use | Value |
|---|---|
| UI ease | `cubic-bezier(.2, .6, .2, 1)` |
| Entrance ease | `cubic-bezier(.22, .61, .36, 1)` |
| Product-shot settle ease | `cubic-bezier(.19, .82, .28, 1)` |
| UI duration | 160–180ms |
| Text / card entrance | 620ms fade + 720ms rise, 18–24px travel |
| Product-shot entrance | 1000ms, 44–64px rise, scale .97→1 |
| Stagger | 70ms per item, max 8 items |
| Ambient float | 10px up/down over 9s, ease-in-out |
| Background light pass | 64s, alternate, ease-in-out |

**For video:**
- Enter elements in reading order: eyebrow → headline → body → visual.
- Transitions are cuts or 300–400ms cross-fades. No wipes, zooms, or spins.
- Numbers may count up (600–900ms, entrance ease) — only when the number is the point.
- Drift markers and bars animate *to* their value so movement carries meaning.
- Always end on the closing-band gradient with the lockup and `realallocation.com`.

---

## 9 · Voice

- Short declaratives. "When it doesn't know, it says so."
- Say what it does, then what it costs. Name dollars, not adjectives.
- Explain the foil, then the fix: reported → real.
- Privacy is a supporting point: "Your data stays with you. Your holdings live in one file. You keep
  the file."
- Required fine print where numbers appear: *Illustrative. Estimates, not a forecast. Not investment,
  tax or legal advice.*

---

## 10 · Copy-paste tokens

```css
:root {
  /* brand */
  --qm-accent: #0F6493; --qm-accent-ink: #0A4A6D; --qm-accent-soft: #DBEAF5; --qm-accent-wash: #F0F7FC;
  --qm-teal: #1E8175;   --qm-teal-soft: #DCEFEB;
  --qm-plum: #6C5AA8;   --qm-plum-soft: #E8E4F5;
  --qm-warn: #96590B;   --qm-warn-soft: #FBEDD0;
  --qm-pos: #1C7150;    --qm-pos-soft: #DCF0E6;
  --qm-neg: #A83F33;    --qm-neg-soft: #FAE3E0;
  /* neutrals */
  --qm-ink: #151823; --qm-ink-2: #48525C; --qm-ink-3: #7A8590;
  --qm-line: #D6DCDA; --qm-line-2: #E8ECE9; --qm-sunk: #EBEFEB;
  --qm-paper: #F2F4F1; --qm-panel-2: #F7F9F7; --qm-panel: #FFFFFF;
  /* chart */
  --qm-c1: #1B6F9B; --qm-c2: #1E8175; --qm-c3: #C08A2E; --qm-c4: #6C5AA8; --qm-c5: #8A949E; --qm-c6: #A4566B;
  /* type */
  --qm-font-display: 'Barlow Condensed', system-ui, sans-serif;
  --qm-font-body: 'Barlow', system-ui, sans-serif;
  --qm-font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  /* shape */
  --radius-sm: 10px; --radius-md: 14px; --radius-lg: 18px; --radius-pill: 999px;
}

[data-qm-theme="dark"] {
  --qm-paper: #0B0D14; --qm-panel: #151823; --qm-panel-2: #1C2030; --qm-line: #2B3140;
  --qm-ink: #ECEFF3; --qm-ink-2: #AAB4C0; --qm-ink-3: #7B8694;
  --qm-accent: #57ACDC; --qm-teal: #45BFAE; --qm-plum: #A99BE0;
  --qm-warn: #E5AE4C; --qm-pos: #4FC894; --qm-neg: #E3826F;
}
```

### Plain list (for video editors / Figma / Canva)

```
Accent blue   #0F6493    Teal      #1E8175    Plum      #6C5AA8
Accent ink    #0A4A6D    Amber     #96590B    Gold      #C08A2E
Positive      #1C7150    Negative  #A83F33
Ink           #151823    Ink 2     #48525C    Ink 3     #7A8590
Paper         #F2F4F1    Panel     #FFFFFF    Line      #D6DCDA
Dark bg       #0B0D14    Dark panel #151823   Dark text #ECEFF3
Dark blue     #57ACDC    Dark teal #45BFAE    Dark plum #A99BE0   Dark amber #E5AE4C

Fonts: Barlow Condensed 700 (headlines, numbers)
       Barlow 400/600 (body)
       IBM Plex Mono 500 (tickers, data)
```
