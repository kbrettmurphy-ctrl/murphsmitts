# MurphOS Design System

**Version:** 1.0
**Status:** Locked
**Last Updated:** June 2026

---

# Why This Exists

The MurphOS Design System turns the MurphOS philosophy into reusable visual standards.

This document defines the foundational rules for color, typography, spacing, layout, buttons, cards, forms, media, motion, and responsive behavior across Murph's Mitts customer-facing and internal experiences.

The goal is consistency.

The goal is calm.

The goal is restraint.

MurphOS should feel premium because every detail is intentional, not because the interface is loud.

---

# Design System Summary

MurphOS uses lighter backgrounds, fewer cards, smaller typography, generous whitespace, and restrained color to create a calm, premium experience where the glove remains the focus.

The interface should feel soft, clean, modern, and warm.

It should not feel sterile.

It should not feel busy.

It should not feel like a generic sports website.

---

# Design Tokens

MurphOS should rely on shared design tokens whenever possible.

Do not invent one-off values unless there is a specific reason.

## Spacing Scale

Use the following spacing scale:

```css
4px
8px
12px
16px
24px
32px
48px
64px
96px
128px
```

Avoid random spacing values.

No `37px` unless the universe has collapsed and there is truly no better option.

---

# Color System

MurphOS uses a warm, restrained palette built around cream, navy, ink, and red.

Color should support the experience, not dominate it.

## Core Colors

```css
--mm-bg: #f6efe5;
--mm-bg-soft: #f9f5ee;
--mm-surface: #fffaf3;

--mm-cream-brand: #dacab1;
--mm-navy: #092f4d;
--mm-ink: #020b12;
--mm-red: #921a24;

--mm-white: #ffffff;
```

## Color Roles

### Main Background

Use `--mm-bg` as the primary customer-facing canvas.

It should feel warm, light, and premium.

The original brand cream `#dacab1` is too strong for the full-site background and should no longer carry that role.

---

### Soft Background

Use `--mm-bg-soft` for subtle section changes, quiet panels, or areas needing slight separation.

---

### Surface

Use `--mm-surface` for cards, forms, panels, and elevated content areas.

Surfaces should feel light and breathable.

---

### Brand Cream

Use `--mm-cream-brand` as a controlled brand accent.

Use it for:

* Logo relationship.
* Footer text.
* Subtle accents.
* Warm highlights.
* Selected states.
* Button text on dark backgrounds.
* Packaging and print consistency.

Do not use it as the default full-page canvas.

---

### Navy

Use `--mm-navy` for:

* Headings.
* Primary actions.
* Navigation accents.
* Footer or header moments.
* Strong trust-building structure.

Use navy with restraint.

When navy appears less often, it feels more valuable.

---

### Ink

Use `--mm-ink` for:

* Body text.
* High contrast text.
* Premium contrast.
* Dark interface moments.

---

### Red

Use `--mm-red` rarely.

Red is reserved for:

* Destructive actions.
* Warning states.
* Important emphasis.
* Carefully selected brand moments.

Red should not be a normal call-to-action color.

If everything is red, nothing is urgent. Humanity keeps learning this the hard way.

---

# Typography

MurphOS typography should feel editorial, calm, and refined.

Smaller type with strong spacing usually feels more premium than oversized type.

Typography should guide attention without shouting.

## Font System

MurphOS uses two font roles:

* **Brand Font**
* **Interface Font**

Montserrat remains part of the Murph's Mitts identity, but it should not carry every word of the interface.

The brand should feel recognizable.

The interface should feel effortless.

## Brand Font

Use Montserrat for brand moments.

```css
--font-brand: "Montserrat", system-ui, sans-serif;
```

Use the brand font for:

* Logo-adjacent text.
* Brand lockups.
* Navigation.
* Buttons.
* Small labels.
* Select headings.
* Short, intentional display text.

Montserrat should reinforce identity without making the entire site feel visually heavy.

## Interface Font

Use the system font stack for body copy and most interface text.

```css
--font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

Use the interface font for:

* Body copy.
* Paragraphs.
* Forms.
* Inputs.
* Help text.
* Long descriptions.
* Admin interface text.
* Customer-facing instructional text.

System fonts feel native, load quickly, and reduce friction. They support the MurphOS goal of making the interface feel effortless.

## Font Usage

Recommended baseline:

```css
body {
  font-family: var(--font-ui);
}

.brand,
.site-nav,
button,
.small-label {
  font-family: var(--font-brand);
}

h1,
h2,
h3 {
  font-family: var(--font-brand);
  font-weight: 400;
}
```

## Font Weight

Use font weight with restraint.

Recommended weights:

```css
--weight-regular: 400;
--weight-medium: 500;
--weight-semibold: 600;
```

Avoid overusing bold text.

Montserrat Light may be used only for large display moments if it remains readable.

Montserrat Condensed should not be used as a primary interface or body font. It may be considered only for rare brand or label moments where a condensed style has a clear purpose.

Readability wins.

Always.


## Type Scale

These values are starting standards and may be tuned visually during implementation.

```css
--text-xs: 12px;
--text-sm: 13px;
--text-base: 15px;
--text-md: 17px;
--text-lg: 20px;
--text-xl: 26px;
--text-2xl: 34px;
--text-hero: clamp(40px, 6vw, 64px);
```

## Type Usage

### Hero Text

Use `--text-hero`.

Hero text should feel confident, not enormous.

Avoid oversized hero type that competes with photography.

---

### Page Titles

Use `--text-2xl`.

Page titles should clearly orient the customer without overwhelming the page.

---

### Section Titles

Use `--text-xl` or `--text-lg`.

Section titles should be smaller than traditional marketing headings.

They should guide, not yell.

---

### Body Text

Use `--text-base`.

Body text should be comfortable, readable, and well-spaced.

Recommended line height:

```css
1.55 - 1.7
```

---

### Supporting Text

Use `--text-sm`.

Supporting copy, notes, metadata, captions, and quiet explanations should feel helpful but not visually dominant.

---

### Labels / Captions

Use `--text-xs` or `--text-sm`.

Labels should be clear, not decorative.

---

## Typography Rules

* Use fewer font sizes.
* Use spacing and weight for hierarchy.
* Avoid excessive bold text.
* Avoid giant all-caps headings.
* Keep line lengths readable.
* Let photography and whitespace do more work.

Typography should whisper.

The glove should speak.

---

# Radius System

MurphOS uses a soft Apple-inspired radius system.

Rounded, but not bubbly.

Soft, but not childish.

```css
--radius-sm: 10px;
--radius-md: 14px;
--radius-lg: 18px;
--radius-xl: 24px;
```

## Radius Usage

### Small Radius

Use `--radius-sm` for:

* Small buttons.
* Tags.
* Chips.
* Compact controls.

---

### Medium Radius

Use `--radius-md` for:

* Standard buttons.
* Inputs.
* Selects.
* Small panels.

---

### Large Radius

Use `--radius-lg` for:

* Cards.
* Images.
* Gallery items.
* Content blocks.

---

### Extra Large Radius

Use `--radius-xl` for:

* Modals.
* Large panels.
* Feature sections.
* Major interface containers.

---

# Layout & Whitespace

Whitespace is one of the primary design tools in MurphOS.

Customer-facing pages should feel open and calm.

Internal tools may be denser when density improves speed.

## Layout Principles

* Use generous section spacing.
* Avoid crowding content.
* Prefer open layouts over boxed layouts.
* Let each section have one clear purpose.
* Avoid visual clutter around primary content.
* Use consistent max-widths.

## Suggested Section Spacing

Customer-facing sections:

```css
64px - 128px
```

Compact customer-facing sections:

```css
48px - 64px
```

Admin/internal sections:

```css
16px - 32px
```

## Page Width

Use a generous but controlled max width.

Suggested values:

```css
--max-page: 1320px;
--max-reading: 760px;
--max-content: 1040px;
```

Long text should not span the full page width.

Readable line length matters. Apparently eyeballs have limits. Who knew.

---

# Buttons

Buttons should invite action.

They should not beg for it.

MurphOS avoids oversized, overly colorful, or visually aggressive buttons.

## Button Types

### Primary Button

Use for the main action on a section or page.

Typical use:

* Start an order.
* Submit a form.
* Save changes.
* Continue.

Recommended style:

```css
background: var(--mm-navy);
color: var(--mm-cream-brand);
border: 1px solid transparent;
border-radius: var(--radius-md);
height: 44px - 48px;
padding: 0 18px;
font-size: 13px - 14px;
font-weight: 600;
```

Primary buttons should be used sparingly.

Most sections should have one primary action at most.

---

### Secondary Button

Use for supporting actions.

Recommended style:

```css
background: transparent;
color: var(--mm-navy);
border: 1px solid rgba(9, 47, 77, 0.24);
border-radius: var(--radius-md);
height: 44px - 48px;
padding: 0 18px;
font-size: 13px - 14px;
font-weight: 600;
```

Secondary buttons should feel available, not loud.

---

### Text Link

Use when a full button would add unnecessary visual weight.

Good for:

* Learn more.
* View gallery.
* Read FAQs.
* Supporting navigation.

Text links should be clear and accessible.

---

### Destructive Button

Use red only for destructive or high-risk actions.

Examples:

* Delete order.
* Remove photo.
* Cancel irreversible action.

Red is not a general CTA color.

---

# Cards

MurphOS should use fewer cards.

Cards are useful, but they should not be the default wrapper for every section.

## Use Cards For

* Pricing blocks.
* Testimonials.
* Form sections.
* Grouped data.
* Gallery items.
* Order/admin items.
* Important callouts.

## Avoid Cards For

* Every paragraph.
* Every section.
* Simple text.
* Content that could stand alone with spacing.
* Layout decoration.

## Card Style

Recommended style:

```css
background: var(--mm-surface);
border: 1px solid rgba(9, 47, 77, 0.12);
border-radius: var(--radius-lg);
padding: 24px - 32px;
box-shadow: none or very subtle;
```

Cards should feel calm and lightly structured.

Avoid heavy borders, heavy shadows, and unnecessary nesting.

---

# Dividers

Use dividers sparingly.

A divider should clarify structure, not decorate the page.

Recommended style:

```css
border-top: 1px solid rgba(9, 47, 77, 0.12);
```

When choosing between a divider and more whitespace, try whitespace first.

---

# Forms

Forms should feel like guided conversations.

They should not feel like paperwork.

## Form Rules

* Every field must earn its place.
* Group related fields together.
* Use visible labels.
* Do not rely on placeholder text alone.
* Avoid asking for the same information twice.
* Avoid unnecessary fields.
* Show clear confirmation after submission.
* Show useful errors when something goes wrong.

## Inputs

Recommended style:

```css
background: var(--mm-surface);
color: var(--mm-ink);
border: 1px solid rgba(9, 47, 77, 0.22);
border-radius: var(--radius-md);
min-height: 44px;
padding: 10px 14px;
font-size: var(--text-base);
```

## Error States

Use clear language.

Do not blame the customer.

Do not expose technical errors unless the user is an admin and the detail is useful.

---

# Navigation

Navigation should feel effortless.

It should be visible, consistent, and easy to use without demanding attention.

## Navigation Rules

* Keep navigation simple.
* Avoid unnecessary menu items.
* Maintain consistent placement.
* Make the active location clear.
* Keep labels short and obvious.
* Do not make customers hunt for the next step.

Customer-facing navigation should be quiet and refined.

Admin navigation may be more direct and functional.

---

# Images & Media

Photography is central to Murph's Mitts.

Photos are not decoration.

They are proof.

## Image Principles

* Let the glove be the focus.
* Show leather texture and patina.
* Do not over-edit.
* Do not erase character.
* Use consistent crops where possible.
* Use consistent radius.
* Avoid chaotic mixed treatments.
* Avoid filters that make gloves look unrealistic.

## Image Treatments

Gallery images:

```css
aspect-ratio: 1 / 1;
object-fit: cover;
border-radius: var(--radius-lg);
```

Editorial images:

```css
aspect-ratio: 4 / 3 or 16 / 10;
object-fit: cover;
border-radius: var(--radius-lg);
```

Hero images:

```css
large scale;
strong composition;
minimal text overlap when possible;
```

Patina should remain visible.

A used glove should not be edited to look unused.

The goal is honest beauty.

---

# Icons

Icons should support comprehension.

They should not decorate the interface without purpose.

## Icon Rules

* Use icons sparingly.
* Keep icon style consistent.
* Avoid mixing filled, outline, and illustrated icon styles randomly.
* Pair icons with text when clarity matters.
* Do not use icons where words are clearer.

Icons should reduce thinking, not add mystery.

---

# Motion

Motion should be subtle, fast, and useful.

## Motion Rules

* Motion should explain change.
* Motion should not delay action.
* Motion should not distract from the glove or task.
* Motion should feel smooth and quiet.
* Remove motion if it adds friction.

## Suggested Durations

```css
--motion-fast: 120ms;
--motion-base: 180ms;
--motion-slow: 240ms;
```

## Suggested Easing

```css
ease-out
```

Use simple easing unless a more specific interaction requires otherwise.

---

# Shadows & Borders

MurphOS should avoid heavy shadows.

Depth should be subtle.

## Border Style

Use light borders for structure:

```css
rgba(9, 47, 77, 0.10 - 0.18)
```

## Shadow Style

Use shadows rarely.

Recommended subtle shadow:

```css
0 10px 30px rgba(2, 11, 18, 0.08)
```

Large dramatic shadows should be avoided.

If the design needs a heavy shadow to feel organized, the layout probably needs work.

---

# Responsive Behavior

MurphOS should feel native on mobile.

Mobile is not a compressed desktop site.

## Mobile Rules

* Prioritize one-column layouts.
* Keep tap targets comfortable.
* Avoid tiny interactive controls.
* Reduce visual density.
* Keep navigation simple.
* Keep forms easy to complete.
* Avoid horizontal scrolling unless the interaction specifically requires it.
* Use enough spacing between tap targets.

Minimum tap target:

```css
44px
```

## Desktop Rules

* Use wider layouts carefully.
* Avoid stretching text too wide.
* Let imagery carry more of the page.
* Use whitespace intentionally.
* Avoid filling space just because it exists.

---

# Customer-Facing vs Admin Design

MurphOS uses the same foundation across public and internal tools, but the expression changes based on purpose.

## Customer-Facing Design

Should feel:

* Calm.
* Premium.
* Open.
* Trustworthy.
* Easy to scan.
* Warm.
* Refined.

Use more whitespace.

Use fewer controls.

Use photography prominently.

---

## Admin Design

Should feel:

* Fast.
* Clear.
* Efficient.
* Organized.
* Designed for repeated use.

Admin tools may use denser layouts when density reduces work.

Do not make admin screens overly spacious if it slows down real tasks.

The public site builds trust.

The admin portal reduces work.

Both must feel intentional.

---

# Do / Don't Rules

## Do

* Use lighter warm backgrounds.
* Use navy with restraint.
* Use red rarely.
* Use fewer cards.
* Use more whitespace.
* Use smaller typography with strong line height.
* Use consistent radius values.
* Let photography carry the page.
* Keep primary actions obvious.
* Make the next step clear.

## Don't

* Use large colored buttons everywhere.
* Put every section inside a card.
* Use `#dacab1` as the main site background.
* Use red as a normal CTA color.
* Add decoration without purpose.
* Overuse icons.
* Overuse shadows.
* Make type huge just to create emphasis.
* Let the interface compete with the glove.
* Create one-off styles unless absolutely necessary.

---

# Implementation Note

This document defines the system.

Actual CSS variables, utility classes, and reusable components should be implemented in the codebase according to these standards.

When implementing or refactoring, Codex and future developers should reference this document before introducing new colors, spacing values, typography sizes, button styles, card treatments, or layout patterns.

If a new visual pattern is needed, it should either fit this system or justify why the system must evolve.

---

# The Standard

MurphOS should feel designed, but not decorated.

Premium, but not sterile.

Warm, but not rustic.

Modern, but not trendy.

Clean, but not empty.

Every element should feel like it belongs.

Every visual decision should reduce friction, build trust, or showcase craftsmanship.

That is the MurphOS Design System.
