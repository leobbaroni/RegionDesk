---
name: RegionDesk
description: A compact regional browser workspace with visible connection evidence.
colors:
  bg: "#121316"
  sidebar: "#18191d"
  fg: "#e9e9ef"
  muted: "#a3a6b2"
  border: "#2c2e35"
  accent: "#c2b5ff"
  green: "#9dd9b3"
  panel: "#17181c"
  control: "#202126"
  control-hover: "#2b2c33"
  control-text: "#d8d9e0"
  accent-ink: "#242031"
  accent-hover: "#d0c7ff"
  input: "#111215"
  input-text: "#e0e1e8"
  selection: "#292634"
  selection-text: "#dfd8ff"
  pending: "#d9bd8d"
  pending-bg: "#29251e"
  ready: "#9ce0b9"
  ready-bg: "#1c2c24"
  checking: "#d6caff"
  checking-bg: "#29243a"
  error: "#f3b1b1"
  error-bg: "#332124"
typography:
  headline:
    fontFamily: "'Inter Variable', 'Segoe UI', sans-serif"
    fontSize: "23px"
    fontWeight: 560
    lineHeight: 1.3
    letterSpacing: "-0.75px"
  title:
    fontFamily: "'Inter Variable', 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 530
    letterSpacing: "-0.15px"
  body:
    fontFamily: "'Inter Variable', 'Segoe UI', sans-serif"
    fontSize: "13px"
  button:
    fontFamily: "'Inter Variable', 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
  label:
    fontFamily: "'Inter Variable', 'Segoe UI', sans-serif"
    fontSize: "11px"
  section-label:
    fontFamily: "'Inter Variable', 'Segoe UI', sans-serif"
    fontSize: "9px"
    fontWeight: 500
    letterSpacing: "0.7px"
rounded:
  tag: "4px"
  field: "5px"
  button: "6px"
  diagnostic: "8px"
  panel: "9px"
spacing:
  inline: "8px"
  compact: "12px"
  browser-gap: "18px"
  form-gap: "20px"
  section: "24px"
  page-inline: "30px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "7px 11px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.control}"
    textColor: "{colors.control-text}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "7px 11px"
  button-secondary-hover:
    backgroundColor: "{colors.control-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.control-text}"
    rounded: "{rounded.button}"
    padding: "7px 11px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "#f2acb4"
    rounded: "{rounded.button}"
    padding: "7px 11px"
  input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.input-text}"
    rounded: "{rounded.field}"
    height: "35px"
    padding: "7px 10px"
  navigation-active:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.selection-text}"
    rounded: "{rounded.button}"
    height: "37px"
    padding: "0 12px"
  status-pending:
    backgroundColor: "{colors.pending-bg}"
    textColor: "{colors.pending}"
    rounded: "{rounded.field}"
    padding: "5px 8px"
  settings-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
---

# Design System: RegionDesk

## Overview

**Creative North Star: "The regional workspace"**

RegionDesk follows the approved Linear/Vercel dark utility direction: graphite layers, hairline separators, quiet violet selection, compact workhorse type and precise status labels. Its Windows desktop shell keeps profile identity and connection evidence near the browser. This document captures the implemented system in `src/tokens.css`, `src/styles.css`, and `src/App.tsx`; the stylesheet remains the implementation source of truth.

Controls are restrained and direct. Configuration, pending checks and measured observations have distinct visual states. Decoration does not compete with settings or browsing; icons support labels and state rather than substitute for them.

**Key Characteristics:**

- Compact desktop density with a persistent navigation rail.
- Graphite panels separated by fine borders and tonal shifts.
- Violet actions and selection, with labelled semantic status colors.
- Visible profile context and explicit connection evidence.

## Colors

The palette pairs cool graphite neutrals with pale violet emphasis and muted semantic colors.

### Primary

Quiet violet (`accent`) marks primary actions, focus and selected controls. Its darker ink keeps filled actions readable. Active navigation uses a separate subdued violet surface so it does not compete with the main action.

### Neutral

Graphite canvas (`bg`), raised rail (`sidebar`) and near-black form fields (`input`) establish nested work areas. Soft white (`fg`) carries main content; slate (`muted`) carries supporting text. Hairline graphite (`border`) separates sections. Local surface variations in the stylesheet distinguish browser chrome, diagnostics and form panels without introducing another brand accent.

### Semantic states

Amber pending, violet checking, green ready and rose error each combine a tinted surface, border, dot and written label. Green also marks observed matches and active connection indicators. Keep these semantic uses separate from primary action emphasis.

**The Evidence Rule.** Color supports a written state; configured values must never look like measured results merely because they are saved.

Browser controls include a compact second toolbar for zoom, pop-out, full screen and permissions. A visible cooldown explains rate-limited verification. The floating browser uses native Windows chrome and a Browser menu, preserving the existing page. Profile permissions use labelled native selects with the same field styling as other settings.

## Typography

Inter Variable is used throughout, with Segoe UI and the system sans-serif fallback. There is no separate display or monospace family. The hierarchy is compact and predominantly regular to medium weight; large promotional typography is absent from the workspace.

- Page headlines use the frontmatter headline role; compact windows reduce them to (21px).
- Section titles use the title role; region identity titles use (14px, 550).
- Body defaults to the body role; explanations commonly use (11–12px), with relaxed line height where text wraps.
- Field labels use the label role. Uppercase environment section labels use the section-label role.
- Footer and metadata text use (9–10px). Keep essential decisions in larger labels and controls.
- Clocks and provider prices use tabular numerals. Values remain selectable where native text controls permit it.

## Layout

The Windows surface contract targets at least (1024 × 680) content; the actual BrowserWindow minimum is (1060 × 740), and the CSS shell has a minimum width of (1000px). This is a desktop layout, with no implemented mobile navigation mode.

The default rail is (218px) wide. A (56px) top bar and (31px) footer frame a scrolling content region. Page padding is (31px 30px 22px). Browser content uses a flexible main panel and a (238px) environment panel separated by (18px). Its minimum content height is (439px), allowing the page to scroll at smaller heights.

Settings use a flexible form panel plus a (236px) explanatory aside. Form fields use a two-column grid with (20px) gaps; connection protocol, host and port use a three-column ratio of (1.05:1.65:0.6). Settings sections use (24px) padding. Diagnostics use a full-width evidence table and two equal lower panels.

At widths up to (1200px), the rail becomes (194px), page padding becomes (26px 23px 20px), the environment panel becomes (214px), and field gaps reduce to (15px). Location choices stack vertically. Secondary identity-strip detail is hidden; core status remains visible. Preserve scrolling and wrapping of long evidence values instead of clipping them.

## Elevation & Depth

Persistent panels are flat: tonal layering and one-pixel borders establish structure. Shadows are reserved for floating UI. The profile menu uses `0 10px 30px #0008`; notifications use `0 12px 30px #0006`. The help drawer uses a dimmed overlay and a left border rather than a floating-card shadow.

**The Flat Workspace Rule.** Keep ordinary panels shadow-free; use depth to distinguish transient UI from the workspace.

## Shapes

The form language uses gently rounded rectangles: tags, fields, buttons, diagnostic containers and main panels follow the frontmatter radius scale. Region marks are compact letter badges; avatars and small status indicators are circular. The locked-browser emblem is a larger rounded square with a smaller lock badge. Most structural borders are one pixel. Avoid turning utilitarian actions into oversized pills.

## Components

### Buttons

Primary buttons have a pale violet fill and dark ink. Secondary buttons have graphite fill and a visible border; ghost buttons are transparent; destructive buttons use rose text and border. Standard buttons have a minimum height of (33px), icon gaps of (7px), and the padding in the frontmatter. Background and border transitions take (150ms, ease). Disabled buttons use opacity (.43) and a not-allowed cursor.

Keyboard focus uses an accent outline (2px) offset by (3px), shared with fields, selects and disclosure summaries. Preserve accessible names for icon-only buttons. The existing implementation does not add a separate pressed-state animation.

### Status chips and tags

Status chips pair text with a small current-color dot. Use the actual runtime state to choose pending, checking, ready or error. Neutral tags convey context such as a profile country or dated information and are not interactive filters.

### Panels and evidence tables

Settings panels group sections with dividers and end in a save row. Environment panels use compact label/value pairs. Diagnostic tables keep configured, observed and evidence columns distinct, show missing readings explicitly, and warn when retained readings are no longer current. Provider tables use restrained headers, row separators and named external-link actions.

### Inputs and location choices

Fields use dark inset surfaces, visible labels, native inputs/selects and supporting hints. Hover strengthens the border; focus uses the shared outline. Disabled coordinates fade when location access is blocked. Location options are labelled native radios inside a fieldset with a legend, presented as rectangular choice tiles; selection adds a violet surface and border. Preserve the native keyboard and form behavior.

Saving is explicit. Leaving an edited profile or connection uses the native discard guard, keeping the user's draft decision outside silent navigation changes. Connection verification is disabled while its form has unsaved edits.

### Navigation

The persistent rail contains the profile selector, screen navigation, profile list and local workspace context. Navigation rows are (37px) tall, with muted default text, a graphite hover surface and a subdued violet active state. Long profile names truncate within the rail. Compact desktop mode narrows the rail rather than replacing it with an icon-only or mobile menu.

### Connection-gated browser

The browser frame is the signature component: toolbar, address field, shortcuts, canvas and connection status line share one bordered container. The locked state provides a single next action and a clear explanation. Verification unlocks browsing within the current profile. Profile changes and relevant saves lock it again until the environment is checked. The adjacent environment panel keeps configured preferences and measured connection values distinguishable.

### Transient feedback

Notifications use success or error text and icons, with a labelled dismiss action and status/alert semantics. The help drawer has dialog semantics and keyboard handling. Its entrance takes (220ms) with `cubic-bezier(.16, 1, .3, 1)`. Checking indicators rotate over (900ms, linear). Reduced-motion preferences disable animations and transitions.

## Do's and Don'ts

### Do:

- Do preserve the compact graphite desktop shell and quiet violet action hierarchy.
- Do pair semantic color with explicit labels and retain unknown or not-measured states.
- Do preserve visible labels, native control behavior and the shared keyboard focus outline.
- Do keep saving explicit and protect unsaved edits during navigation.
- Do retain profile context and connection status around the browser.

### Don't:

- Don't imply that a saved regional preference is a measured network result.
- Don't use verified styling to imply hardware masking, genuine SIM service or guaranteed audience reach.
- Don't replace structural borders with decorative shadows on ordinary panels.
- Don't treat live TikTok or provider compatibility as verified without actual evidence.
