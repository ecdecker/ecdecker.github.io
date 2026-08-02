---
version: alpha
name: Folio
description: An eternally simple, paper-thin design system built on warm bone neutrals, hairline borders, and editorial serif headlines.
colors:
  primary: "#13120f"
  on-primary: "#ffffff"
  secondary: "#6c6a62"
  tertiary: "#f6f3eb"
  neutral: "#efece4"
  surface: "#ffffff"
  on-surface: "#13120f"
  on-surface-muted: "#6c6a62"
  border: "#e4dfd4"
  focus: "#13120f"
  error: "#8a2a1f"
typography:
  display:
    fontFamily: "Instrument Serif"
    fontWeight: 400
    fontSize: "96px"
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline-lg:
    fontFamily: "Instrument Serif"
    fontWeight: 400
    fontSize: "56px"
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline-md:
    fontFamily: "Instrument Serif"
    fontWeight: 400
    fontSize: "32px"
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body-md:
    fontFamily: "system-ui"
    fontWeight: 400
    fontSize: "16px"
    lineHeight: 1.55
    letterSpacing: "0"
  body-sm:
    fontFamily: "system-ui"
    fontWeight: 400
    fontSize: "14px"
    lineHeight: 1.55
    letterSpacing: "0"
  label-sm:
    fontFamily: "system-ui"
    fontWeight: 500
    fontSize: "12px"
    lineHeight: 1.4
    letterSpacing: "0.14em"
    textTransform: "uppercase"
  wordmark-italic:
    fontFamily: "Instrument Serif"
    fontStyle: "italic"
    fontWeight: 400
    fontSize: "20px"
    lineHeight: 1
    letterSpacing: "-0.01em"
rounded:
  none: "0px"
  sm: "4px"
  md: "10px"
  lg: "14px"
  xl: "22px"
  full: "999px"
spacing:
  3xs: "4px"
  2xs: "8px"
  xs: "12px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "48px"
  2xl: "72px"
  3xl: "96px"
  container-max: "1200px"
  container-pad: "32px"
  section-rhythm: "72px"
elevation:
  none: "none"
  paper: "0 1px 0 rgba(0,0,0,0.03), 0 24px 60px -32px rgba(19,18,15,0.18)"
border:
  hairline: "1px solid {colors.border}"
  ink: "1px solid {colors.on-surface}"
  focus: "2px solid {colors.focus}"
  focus-offset: "2px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    border: "1px solid {colors.primary}"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    transform: "translateY(-1px)"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    border: "1px solid {colors.border}"
  button-secondary-hover:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-surface}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    border: "1px solid {colors.border}"
  input-field-focus:
    border: "1px solid {colors.on-surface}"
    outline: "{border.focus}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "32px"
    border: "1px solid {colors.border}"
  card-leaf:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "32px"
    border: "1px solid {colors.border}"
    elevation: "{elevation.paper}"
  panel-subtle:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "24px"
    border: "1px solid transparent"
  checkbox:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    size: "16px"
    border: "1px solid {colors.border}"
  checkbox-checked:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    size: "16px"
    border: "1px solid {colors.primary}"
  tabs:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.body-sm}"
    border: "0 0 1px 0 solid {colors.border}"
  tabs-active:
    textColor: "{colors.on-surface}"
    border: "0 0 1px 0 solid {colors.on-surface}"
  divider:
    border: "1px solid {colors.border}"
  tag:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    border: "1px solid {colors.border}"
---

## Overview

Folio is a one-color, one-mark, one-voice system. The page is the leaf of a well-printed book — warm bone paper underneath, a pure white surface card on top, and editorial serif marquee headlines doing all the talking. Action is the only thing allowed to be ink-black. Decoration is the only thing not allowed at all.

The intended feel is calm, deliberate, and quietly confident — closer to a printed folio or a small architecture monograph than to a SaaS dashboard. Pages should feel composed, not assembled. Whitespace is a primary material; hairline borders are the structural language; the four-point spark is the only ornament permitted.

What to preserve from the visual direction:

- The single white card floating on a warm neutral page, framed by a 1px hairline.
- A high-contrast serif display paired with a quiet sans body — never two serifs, never two sans.
- A small italic-serif wordmark with a four-point spark mark to its left.
- Pill-shaped controls — ink primary, hairline secondary — in close proximity.
- Tight, asymmetric, left-aligned editorial layouts. Nothing centered for the sake of centering.

What to avoid:

- SaaS gradients, glass blurs, glow halos, color accents, drop shadows.
- Tints on hover. Hover is a 1px lift or a Whisper infill — never a color change.
- Iconography clusters, badges, eyebrow tags, oversized illustrations.
- Mixed type families, decorative dividers, multi-tone surfaces.

## Colors

The palette is a single warm neutral family plus one action color. Background is `neutral` (`#efece4`, Bone) — the only page color in the entire system. Surfaces are `surface` (`#ffffff`, Snow), separated from Bone only by a 1px `border` (`#e4dfd4`, Mist) hairline.

Text uses `on-surface` (`#13120f`, Ink) for headlines, primary copy, brand mark, and the primary pill button fill. Body text and helper copy use `secondary` (`#6c6a62`, Stone) — never pure Ink. The `tertiary` token (`#f6f3eb`, Whisper) is reserved for hover infills, zebra rows, and very quiet panel backgrounds.

There is no accent color. There is no gradient. There is no tinted hover state. If a future component needs to assert importance, it should do so by becoming more typographic, not more colorful. The system reserves a single `error` token (`#8a2a1f`) for destructive states only, and even there it is used as a text color, not a surface fill.

Contrast targets: Ink on Bone reaches AAA at body sizes. Stone on Bone is 4.59:1 and reaches AA Normal; keep it for body copy, meta, captions, helper text, and the second-line subtitles under headlines. Snow remains the preferred long-form reading surface, where Stone reaches 5.42:1.

## Typography

One downloaded family and one native system stack.

- **Instrument Serif** carries every headline from `headline-md` (32px) through `display` (96px). It is also used in its italic cut for the brand wordmark and standalone marquee statements. Headlines are tight: -0.02em tracking, 1.05–1.15 line-height.
- The **system UI sans stack** carries body copy, UI labels, button labels, input text, captions, and all meta. Weights are limited to 400/500/600. The `label-sm` token at 12px with 0.14em tracking and uppercase is the only place small-caps tracking appears, and it is reserved for genuine meta — never as an eyebrow above a heading.

Lead every section with the heading itself. There is no kicker, no chip, no "Features" label sitting above the headline. If a section needs introduction, the first sentence after the heading provides it.

Body color is `on-surface-muted` (Stone), not Ink. Reserve Ink for headlines, the wordmark, button labels, key emphasis inside paragraphs, and the four-point spark glyph.

## Layout

The system is a generous, left-aligned editorial grid. The maximum container width is 1200px with 32px (clamped) horizontal padding. Section vertical rhythm is 72px (clamped). Major sections almost always live inside a single white card surface so the warm Bone page reads as a frame around the content.

Composition rules:

- **Hero**: split-card. A single Snow card on Bone, divided into a left text column and a right media column. The wordmark sits in the top-left corner of the text column; the headline sits flush left below it with 24–32px of space; a 1–2 sentence Stone subtitle follows; a small feature list and a pair of pill buttons close the column. The media column carries one image — full-bleed inside the card, no caption, no overlay.
- **Feature grids**: three columns at desktop, single column at mobile, separated by hairline borders rather than gaps. Each cell starts with a small Lucide icon in Ink, a 28px serif headline, and a 14px Stone paragraph.
- **Forms**: vertical, single-column. Inputs are 10px-radius, hairline-bordered, with the label above and the hint below in `label-sm`. Pill submit button sits flush left at the bottom of the form.
- **Detail / content pages**: long single-column body of 64ch with hairline horizontal dividers between sub-sections. Decorative dividers may center the four-point spark glyph between two hairline segments.
- **Mobile**: split layouts stack vertically with the media column collapsing below the text column. Container padding falls to 20px. Headlines reduce via `clamp()` rather than at hard breakpoints.

Whitespace is generous everywhere. Never use space-between to fill the gap between unrelated elements — always commit to either tight rhythm or generous breathing room. When in doubt, choose breathing room.

## Elevation & Depth

Depth is contrast, not shadow. The system has effectively no shadow vocabulary. There is exactly one optional elevation — `elevation.paper` — for the floating composition card on a hero. It is a near-imperceptible whisper: `0 1px 0 rgba(0,0,0,0.03), 0 24px 60px -32px rgba(19,18,15,0.18)`. It must never be applied to multiple stacked surfaces.

Every other separation in the system is a 1px Mist hairline. Cards, panels, inputs, table rows, section dividers, tabs — all use the same hairline weight. Never use a 2px border. Never use a double border or inset ring. The hairline is the system's voice; thickening it is incorrect.

Focus is the only place a stronger ring appears: a 2px Ink outline with a 2px offset. It must read crisply on both Bone and Snow surfaces.

## Shapes

Four radii, used consistently:

- **Pills (999px)** — all buttons, all chips, all tags. The pill is the action shape.
- **Cards (14px)** — large surface cards, media frames, leaf hero card.
- **Inputs (10px)** — text inputs, selects, textareas, dropdowns, small panels.
- **Checkbox / squarish (4px)** — checkboxes, the only square geometry in the system.

The signature ornament is the **four-point Folio spark** — a compass-style star with concave sides. It appears:

- As the brand mark next to the italic-serif wordmark.
- As the optional centered ornament between two hairline segments in a section divider.
- As a tiny inline glyph in marquee statements where a separator is needed.

It is never recolored, never animated, never used as a repeating pattern, and never larger than 24px inside running content.

## Components

**Button — primary.** Pill, Ink fill, Snow text, 12px×20px padding, system UI sans 500 at 14px. On hover the button lifts 1px on the y-axis. No color shift. No glow. Focus shows the 2px Ink outline with 2px offset.

**Button — secondary.** Pill, Snow fill, Ink text, 1px Mist border, identical padding and label. On hover the fill swaps to Whisper (`tertiary`). No color shift on the border or label.

**Input.** Snow fill, 1px Mist border, 10px radius, 12px×14px padding. Ink text, Stone placeholder. Focus draws the 2px Ink outline; the border simultaneously shifts to Ink — no fill change. Errors are communicated through a Stone helper line that switches to the `error` color; the border does not turn red.

**Card.** Snow surface on Bone background. 1px Mist border. 14px radius. 32–48px internal padding. The hero variant (`card--leaf`) carries the single permitted whisper-soft elevation.

**Checkbox.** 16px square, 4px radius, 1px Mist border, Snow fill. Checked state fills with Ink and shows a Snow check stroke (Lucide `check`, 10px). Focus uses the 2px Ink outline on the visible box.

**Tabs.** Text-only labels in system UI sans 500 at 14px. Container has a 1px Mist bottom hairline. Active tab is Ink with a 1px Ink underline that overlaps the container hairline. Inactive tabs are Stone with no underline. No pills, no background fills, no animated indicators.

**Feature list.** Vertical list of 14px Stone lines with a 5px round Ink bullet (or the four-point spark glyph for marquee placements). Tight 8px gap between items.

**Divider.** 1px Mist hairline. For section breaks, optionally center the four-point spark glyph (12px Ink) between two hairline segments using `.divider`.

**Tag.** A quiet pill — Whisper fill, Mist hairline, Stone `label-sm` text, 4px×10px padding. Used only for taxonomy or meta, never as an eyebrow above a heading.

**Iconography.** Lucide outline icons (https://lucide.dev/, ISC). One weight only. 16–20px next to body text, stroked in Ink via `currentColor`. Reserve icons for genuine interaction or feature affordance — never as decoration.

**Imagery.** Single full-bleed image inside a `media-frame` with a 14px radius and a hairline border. No captions overlaid on the image. No duotone treatment. No multi-image collages. If multiple photos are needed, place them in a single row separated by hairlines, not gaps.

## Do's and Don'ts

**Do**

- Do lead every section with the heading itself.
- Do treat the white card on warm Bone as the canonical hero composition.
- Do use the 1px Mist hairline for every structural separation.
- Do use Stone (not Ink) for body paragraphs and helper text.
- Do reserve Ink as the only "action" color — primary button fill, checkbox checked, focus ring.
- Do use the four-point spark exclusively as the brand mark and the optional divider ornament.
- Do prefer generous whitespace over visual chrome to communicate hierarchy.
- Do collapse split layouts into a single column on mobile and let media sit below text.

**Don't**

- Don't add accent colors, gradients, glows, or glassmorphism.
- Don't introduce drop shadows beyond the single optional `elevation.paper` whisper.
- Don't tint hover states with color — use a 1px lift on buttons or Whisper infill on secondaries.
- Don't mix more than two type voices. Instrument Serif + the native system UI sans only.
- Don't decorate with the spark, repeat it as a pattern, or recolor it.
- Don't use double borders, 2px borders, or inset rings — the hairline is the voice.
- Don't center every section. Editorial left alignment is the default.
- Don't add badges, pills, or chips above headings as eyebrows or kickers.
- Don't use small-caps tracking anywhere except genuine meta `label-sm` usage.
- Don't introduce icon weight variants. One Lucide outline weight, system-wide.
