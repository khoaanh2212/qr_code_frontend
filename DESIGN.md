---
name: QR Code Generator
description: An honest QR code generator whose interface reads like a print proof.
colors:
  paper: "#fafaf9"
  ink: "#1c1917"
  ink-muted: "#57534e"
  rule: "#d6d3d1"
  control-edge: "#78716c"
  sheet: "#ffffff"
  signal-teal: "#0f766e"
  on-signal: "#ffffff"
  signal-wash: "#e6f4f1"
  masthead: "#e7f0ee"
  stop-red: "#b91c1c"
  caution-amber: "#92400e"
  paper-dark: "#0c0a09"
  ink-dark: "#f5f5f4"
  ink-muted-dark: "#a8a29e"
  rule-dark: "#44403c"
  control-edge-dark: "#8a837c"
  sheet-dark: "#1c1917"
  signal-teal-dark: "#2dd4bf"
  on-signal-dark: "#042f2e"
  signal-wash-dark: "#0f2e2b"
  masthead-dark: "#141f1d"
  stop-red-dark: "#fca5a5"
  caution-amber-dark: "#fcd34d"
typography:
  display:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
  title:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
  spec:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "\"tnum\""
rounded:
  proof: "2px"
  control: "6px"
  panel: "8px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "32px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.signal-teal}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "44px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "44px"
  type-tile:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.panel}"
    padding: "12px 8px"
  type-tile-selected:
    backgroundColor: "{colors.signal-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "12px 8px"
  segment-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "0 16px"
    height: "44px"
  panel:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.panel}"
    padding: "20px"
  masthead:
    backgroundColor: "{colors.masthead}"
    textColor: "{colors.ink}"
    height: "68px"
---

# Design System: QR Code Generator

## Overview

**Creative North Star: "The Print Proof"**

Everything this product makes ends up printed: on a menu, a table tent, a shop window, a business
card. The interface is the proof sheet that comes before the print run. A proof is trusted because
it is exact: it shows precisely what will be printed, its size and format, and it never shows
something that will not come out right. That is the standard every screen is held to.

The voice is assured and professional. Calm warm paper instead of cold grey, deep ink for text, one
signal color for action and readiness, precise numbers in a monospaced spec line. Controls are the
standard ones of the web, drawn firmly: clear borders, generous touch targets, unmistakable states.
Personality lives in exact details, never in decoration: the crop marks around the preview, the
spec line under it, a themed caret and text selection. The visual world rejects the free-tool
category look outright: no ad banners, pop-ups, blinking upgrade buttons or fake countdowns, and no
decorative purple gradients, glassmorphism or neon glow.

**Key Characteristics:**
- Warm paper ground, deep ink text, one signal teal for action and state.
- Standard web controls, firm borders (3:1 or better), 44 px touch targets on phones.
- Flat surfaces separated by rules and tone; shadows only for what floats above content.
- A proof frame with crop marks whose color carries the state of what it holds.
- Exact measurements in a monospaced, tabular spec voice.

## Colors

A restrained warm-stone palette with a single teal signal; every color has a light and a dark value
and both are tokens.

### Primary
- **Signal Teal** (`signal-teal`, dark `signal-teal-dark`): the only accent. Primary buttons, the
  selected type tile's border, focus rings, text selection, the caret, checkbox and slider fill,
  the "saved" check. It means "act here" or "this is ready".
- **On Signal** (`on-signal`, dark `on-signal-dark`): text and icons placed on Signal Teal.
- **Signal Wash** (`signal-wash`, dark `signal-wash-dark`): the quiet fill of a selected tile; the
  only tinted surface.

### Neutral
- **Paper** (`paper`, dark `paper-dark`): the page ground. Warm, never pure white.
- **Sheet** (`sheet`, dark `sheet-dark`): panels, inputs and tiles that sit on the paper.
- **Masthead** (`masthead`, dark `masthead-dark`): the header band, a teal-tinted paper that gives
  the shell its color without competing with the signal.
- **Ink** (`ink`, dark `ink-dark`): headings, body text, values.
- **Ink Muted** (`ink-muted`, dark `ink-muted-dark`): help text, captions, the spec line; 6:1 or
  better on paper in both themes.
- **Rule** (`rule`, dark `rule-dark`): dividers and panel outlines; structure, not interaction.
- **Control Edge** (`control-edge`, dark `control-edge-dark`): borders of anything you can type
  into or press; 3:1 against the sheet (WCAG 1.4.11).

### State
- **Stop Red** (`stop-red`, dark `stop-red-dark`): errors at a field, a refused download, invalid
  borders, the crop marks of a proof that failed.
- **Caution Amber** (`caution-amber`, dark `caution-amber-dark`): blocked but recoverable (low
  contrast, incomplete content) and the crop marks of a proof that cannot print yet.

### Named Rules
**The One Signal Rule.** Signal Teal is the only accent. It marks the primary action of an area and
state, never decoration; there is at most one teal button in view per area.

**The Two Edges Rule.** Rule color outlines structure; Control Edge outlines what responds to
input. A border that looks interactive must be interactive.

**The Paper Rule.** The QR code always sits on white, in both themes. A proof is never shown on a
dark tile.

## Typography

**Body Font:** Geist (with Arial, Helvetica, sans-serif), self-hosted through `next/font`.
**Label/Mono Font:** Geist Mono, for hex values, sizes and the spec line only.

**Character:** one well-tuned sans carries every role, as a working tool should; the mono face is
reserved for measured values, so a number set in mono always means "exact".

### Hierarchy
- **Display** (600, 1.875rem, 1.2, tracking -0.025em, balanced): the page title, once per page.
- **Headline** (600, 1.5rem, 1.33): titles of auth and account pages.
- **Title** (600, 1.125rem, 1.55): section headings inside a tool (Content, Design, Preview,
  Download).
- **Body** (400, 1rem, 1.5): input values and running text; intros capped at 65ch and wrapped with
  `text-wrap: pretty`.
- **Label** (500, 0.875rem, 1.43): field labels, tile labels, buttons in compact places.
- **Caption** (400, 0.75rem, 1.33): help text and field errors under inputs.
- **Spec** (Geist Mono 400, 0.75rem, tabular numerals): measurements and codes (`PNG · 1024 × 1024 px`,
  `#0F766E`).

### Named Rules
**The Measured Mono Rule.** Monospace appears only for values that are measured or exact (sizes,
colors, codes). Never for headings, labels or decoration.

**The Fixed Scale Rule.** Sizes are fixed rem steps (ratio about 1.2); no fluid clamp() type in the
product.

## Layout

A single centered column of 72rem (`max-w-6xl`) with a 16px gutter on public pages. Tool pages use a
two-column grid on large screens: the work on the left, the proof on the right in a 22rem column
that stays in view (sticky, 24px from the top); the gap between columns is 40px. On phones
everything stacks in task order: type row, content, design, proof, with a bottom bar that brings
the proof and its download into reach when it is off screen. Breakpoints: 640px (`sm`) and 1024px
(`lg`). Rhythm: 8px for grouped items, 16px inside a section, 32px between sections, 40px between
columns. Known drift: auth and account pages still use a 64rem container (`max-w-5xl`); move them
to 72rem when they are designed.

## Elevation & Depth

Flat by default. Surfaces separate by tone (paper, sheet, masthead) and by a 1px rule, not by
shadow. Shadows exist only for layers that float above content and must read as detached.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.12)`): menus and popovers (the language menu).
- **Dock** (`box-shadow: 0 -4px 16px rgb(0 0 0 / 0.08)`): the bar fixed to the bottom of the phone
  screen.

### Named Rules
**The Float-Only Rule.** A shadow means "this sits above the page". Panels, tiles, inputs and
buttons never carry one.

## Shapes

Gently rounded, never pill-shaped. Controls (inputs, buttons, segmented toggles) use 6px; panels and
type tiles use 8px; the white tile behind the QR code uses 2px, so the code reads as a printed
square. Borders are 1px; crop marks are 2px L-shapes, 16px on each arm, at the four corners of the
proof.

## Components

### Buttons
Firm and unambiguous.
- **Shape:** gently rounded (6px).
- **Primary:** Signal Teal fill, On Signal text, 600 weight, 48px tall, with a leading icon when it
  starts a file action (download). One per area.
- **Secondary:** sheet fill, Control Edge border, ink text, 44px tall; hover adds a 5% ink tint.
- **Hover / Focus / Disabled:** hover lowers opacity to 90% (150ms); focus shows a 2px Signal Teal
  outline offset 2px; disabled drops to 40% opacity with a not-allowed cursor, and the reason is
  always written next to it.

### Type Tiles
The row of QR types: icon above label, the familiar pattern of the category.
- **Style:** sheet fill, Rule border, Ink Muted label, 20px Lucide icon at 1.75 stroke.
- **Selected:** Signal Teal border, Signal Wash fill, Ink label. Native radios underneath, so arrow
  keys move between types.
- **Phones:** one horizontally scrolling row with snap points; seven equal columns from 640px.

### Inputs / Fields
- **Style:** sheet fill, Control Edge border, 6px radius, 44px tall, 1rem text.
- **Focus:** the global 2px Signal Teal outline; the caret is Signal Teal.
- **Error:** Stop Red border and a Stop Red caption under the field saying exactly what is wrong;
  shown once, at the field, after the user leaves it.
- **Help:** an Ink Muted caption under the field, linked with `aria-describedby`.

### Segmented Toggle
Two or three mutually exclusive options (PNG / SVG): a Control Edge outline around 44px segments;
the selected segment is Ink filled with Paper text, set in the spec voice.

### Navigation
- **Masthead:** the teal-tinted band at the top; product name left, language menu and account
  links right, every target 44px tall.
- **Language menu:** a disclosure (languages icon, current language, chevron) opening a Float list
  of real links, each in its own language.

### Print Proof (signature)
The preview of the code.
- A square frame up to 18rem with four crop marks. The marks carry state: Ink at 40% when the code
  is ready to print, Caution Amber when the content is incomplete, invalid or too low in contrast,
  Stop Red when the server refused it.
- Inside, the code on a white tile (2px radius). While a newer render loads, the current image
  dims to 50%. A code that cannot print is never shown; a QR outline icon takes its place.
- Under it, the spec line (format · size in px) in the spec voice, then one status line that says
  what is missing or wrong, naming the field.

## Do's and Don'ts

### Do:
- **Do** keep Signal Teal for the primary action and for state; one teal button per area.
- **Do** outline every control with Control Edge (`#78716c` / `#8a837c`) and every structure with Rule.
- **Do** make touch targets at least 44px tall on phones.
- **Do** set measured values (sizes, hex colors, codes) in Geist Mono with tabular numerals.
- **Do** show the QR code on white in both themes, framed by crop marks that tell its state.
- **Do** theme the browser's own surfaces: text selection, caret, focus ring, `accent-color`.
- **Do** keep transitions between 150 and 250ms and for state changes only; respect reduced motion.

### Don't:
- **Don't** use the free-tool category look: no ad banners, pop-ups, blinking "Upgrade" buttons or fake countdowns.
- **Don't** use decorative purple gradients, glassmorphism or neon glow. The one blur in the system is the phone bar's backdrop, there for legibility over scrolling content.
- **Don't** put shadows on panels, tiles, inputs or buttons; shadows are for floating layers only.
- **Don't** show a QR code that cannot be printed or scanned, even dimmed.
- **Don't** use monospace for headings, labels or as a "technical" costume.
- **Don't** add a second accent color or tint surfaces other than the selected tile.
