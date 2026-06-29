# MurphOS Website Audit

**Version:** 2.0
**Status:** Source-Based Draft
**Last Updated:** June 2026

---

# Why This Exists

This audit compares the current Murph's Mitts public website source code against the MurphOS standards defined in:

* `01_DESIGN_LANGUAGE.md`
* `02_BRAND.md`
* `03_HUMAN_INTERFACE_GUIDELINES.md`
* `04_DESIGN_SYSTEM.md`
* `05_COPYWRITING.md`
* `06_PHOTOGRAPHY.md`
* `07_COMPONENT_LIBRARY.md`

This version is based on the current repository source, not assumptions.

The purpose is to identify what works, what conflicts with MurphOS, what should change, and what should become part of the Codex execution plan.

This audit should be used before writing `99_CODEX_EXECUTION.md`.

---

# Source Files Reviewed

This audit reviewed the current repository files, including:

* `index.html`
* `services/index.html`
* `process/index.html`
* `gallery/index.html`
* `baseball-glove-relacing/index.html`
* `about/index.html`
* `contact/index.html`
* `for-sale/index.html`
* `for-sale/glove.html`
* `_includes/header.html`
* `_includes/footer.html`
* `_layouts/default.html`
* `assets/css/styles-16.css`
* `assets/js/main.js`
* `for-sale/for-sale.js`

Admin files were present but not the focus of this website audit.

---

# Critical Repo Hygiene Note

The repository includes `supabase.env`.

That file contains a `SUPABASE_SERVICE_ROLE_KEY` variable.

A Supabase service-role key should not be committed to the repository.

The current `.gitignore` includes `.supabase.env`, but not `supabase.env`, which means the actual file name is not ignored.

## Required Fix

Add `supabase.env` to `.gitignore`.

Remove `supabase.env` from tracked files.

Rotate the Supabase service-role key if the file has ever been pushed to GitHub.

This is a P0 issue.

Not because it affects visual design.

Because leaking a service-role key is how a small business website briefly becomes an unplanned public API amusement park.

---

# Audit Summary

The current site is much stronger than the earlier first-pass audit assumed.

The public site already has:

* A real expanded home page.
* Dynamic gallery previews.
* A native service request form.
* Conditional shipping fields.
* Dynamic lace inventory display on the Services page.
* A Gloves For Sale section.
* Legal pages.
* A cleaner mobile menu than expected.

That is good.

The site is not a mess.

It is a working site that has grown in layers.

The biggest issue is not capability.

The biggest issue is system consistency.

MurphOS now needs to turn the current site from a working collection of pages into one intentional customer experience.

The main conflicts are:

* Current CSS tokens do not match the MurphOS design system.
* Red is still used as the primary CTA color.
* `#dacab1` is still the full-page background.
* Montserrat is still used as the full body font.
* Cards are still overused.
* Important styles live inline inside pages.
* Lace colors exist, but are still not fully treated as a decision-support component.
* The service request form is native, which is good, but still uses dropdowns instead of visual swatches.
* Restoration language appears throughout the site and should be softened.
* Some source bugs and stale implementation leftovers need cleanup.

This is a good foundation.

It just needs discipline.

A sentence humanity usually resists until the third redesign.

---

# Top P0 Findings

## 1. Service-Role Key File Is Present

Observed:

* `supabase.env` exists in the repository.
* It contains a `SUPABASE_SERVICE_ROLE_KEY` variable.
* `.gitignore` ignores `.supabase.env`, but not `supabase.env`.

MurphOS issue:

* This is a security and repo hygiene issue.
* Service-role keys should live in Cloudflare environment variables or another secure secrets system, not in committed source.

Recommended change:

* Add `supabase.env` to `.gitignore`.
* Remove the file from Git tracking.
* Rotate the key if it has ever been pushed.

Priority:

**P0**

Files affected:

* `.gitignore`
* `supabase.env`

---

## 2. Design Tokens Do Not Match MurphOS

Observed:

`assets/css/styles-16.css` currently defines:

```css
--bg: #dacab1;
--navy: #092f4d;
--red: #921a24;
--ink: #020b12;
--creamText: #f2eee6;
--max: 1320px;
--radius: 18px;
```

MurphOS issue:

* The current token system is too small.
* It does not include the approved MurphOS background, surface, font, type, spacing, radius, motion, or border tokens.
* `#dacab1` is still the main site background, but MurphOS reclassified it as brand cream/accent, not full-page canvas.

Recommended change:

Replace the current token foundation with the MurphOS token system from `04_DESIGN_SYSTEM.md`.

Priority:

**P0**

Files affected:

* `assets/css/styles-16.css`

Component opportunity:

* Global MurphOS foundation.

---

## 3. Red Is Still the Primary CTA Color

Observed:

`styles-16.css` defines:

```css
.btn-primary {
  background: var(--red);
  color: var(--bg);
}

.btn-secondary {
  background: var(--navy);
  color: var(--bg);
}
```

MurphOS issue:

* This reverses the approved button hierarchy.
* MurphOS primary buttons should use navy.
* Red should be reserved for destructive actions, warnings, urgent states, or rare brand emphasis.

Recommended change:

* Make `.btn-primary` navy with cream text.
* Make `.btn-secondary` transparent, outline, or quiet surface.
* Reserve `.btn-danger` or similar for red.

Priority:

**P0**

Files affected:

* `assets/css/styles-16.css`
* All pages using `.btn-primary` and `.btn-secondary`

Component opportunity:

* `mm-button`
* `mm-button-primary`
* `mm-button-secondary`
* `mm-button-danger`

---

## 4. Body Font Still Uses Montserrat Everywhere

Observed:

`styles-16.css` sets body font to Montserrat:

```css
font-family: "Montserrat", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
```

`_layouts/default.html` also loads Montserrat from Google Fonts.

MurphOS issue:

* MurphOS now defines Montserrat as the brand font, not the primary body/interface font.
* Body copy and UI should use the system font stack.

Recommended change:

* Add `--font-brand`.
* Add `--font-ui`.
* Set `body` to `--font-ui`.
* Use Montserrat for nav, buttons, small labels, select headings, and brand moments.

Priority:

**P0**

Files affected:

* `assets/css/styles-16.css`
* `_layouts/default.html`

Component opportunity:

* Typography token foundation.

---

## 5. Invalid / Undefined CSS Values Exist

Observed:

`styles-16.css` includes invalid color values:

```css
color: #navy;
```

This appears in brand text styles.

The CSS also references undefined variables:

```css
var(--muted)
var(--ink-light)
```

MurphOS issue:

* Invalid CSS weakens maintainability.
* Undefined variables create unpredictable visual fallbacks.
* MurphOS needs deliberate tokens, not accidental browser forgiveness.

Recommended change:

* Replace `#navy` with `var(--mm-navy)`.
* Define or remove `--muted`.
* Define or remove `--ink-light`.
* Audit CSS for stale variables and invalid values.

Priority:

**P0**

Files affected:

* `assets/css/styles-16.css`

Component opportunity:

* Global design token cleanup.

---

# Global Architecture Audit

## What Works

The site uses a clean Jekyll-style structure:

* `_layouts/default.html`
* `_includes/header.html`
* `_includes/footer.html`
* page folders with `index.html`
* centralized `assets/css/styles-16.css`
* centralized `assets/js/main.js`

This is a good foundation.

The site also already includes MurphOS docs inside `.docs/murphos`, which is excellent.

The structure is understandable and does not need a full architectural rewrite.

## Issues

Several pages contain inline styles or page-level style blocks.

Examples:

* `services/index.html`
* `process/index.html`
* `gallery/index.html`
* `baseball-glove-relacing/index.html`
* `about/index.html`
* `contact/index.html`

The largest case is `contact/index.html`, which contains a large embedded style block for the native service request form.

MurphOS issue:

* Styles are split between global CSS and page-level CSS.
* Reusable patterns cannot be enforced cleanly.
* Codex will have a harder time making consistent changes if page-specific CSS remains scattered.

Recommended change:

* Move page-level styles into `styles-16.css` during the foundation phase.
* Convert repeated patterns into named MurphOS components.
* Remove inline styles except for truly dynamic values.

Priority:

**P0**

Component opportunity:

* `mm-section`
* `mm-card`
* `mm-form-section`
* `mm-form-field`
* `mm-lace-swatch`
* `mm-gallery-grid`

---

# Header / Navigation Audit

## Observed Implementation

`_includes/header.html` includes:

* Logo.
* Desktop nav.
* Mobile menu trigger.
* Mobile full-screen menu.

Current nav order:

* Home
* Gallery
* Services
* Process
* Gloves For Sale
* FAQ
* About
* Contact

FAQ links to:

```html
/baseball-glove-relacing/#faq
```

There are invalid closing tags in the brand text:

```html
<br>MAINTENANCE</br>
```

## What Works

* Header is centralized.
* Mobile menu exists.
* Contact is now with the rest of the menu, which matches the recent direction.
* Gloves For Sale is included in navigation.
* Nav labels are simple and understandable.

## Issues

* Invalid `<br>` usage should be fixed.
* FAQ is an anchor inside the relacing page but appears like a top-level page.
* FAQ does not receive an active nav state.
* Gallery appears before Services, which may not match the ideal customer journey.
* Header uses fixed positioning and custom hero-overlap logic.
* Header comments still reference “Squarespace-ish,” which should be removed during cleanup.

## MurphOS Direction

Recommended public nav order:

1. Home
2. Services
3. Process
4. Gallery
5. Gloves For Sale
6. FAQ
7. About
8. Contact

FAQ can remain an anchor temporarily, but the long-term solution should be either:

* a dedicated FAQ page, or
* a clearly named Help / FAQ section that does not pretend to be a separate page.

Header states should be formalized:

* Default page header.
* Home hero overlay header.
* Scrolled header.
* Mobile menu header.

## Priority

**P1**

Files affected:

* `_includes/header.html`
* `assets/css/styles-16.css`
* `assets/js/main.js`

Component opportunity:

* `mm-header`
* `mm-nav`
* `mm-mobile-menu`

---

# Footer Audit

## Observed Implementation

`_includes/footer.html` includes:

* Copyright.
* Privacy Policy link.
* Terms & Conditions link.
* Social icons.
* Veteran-owned badge.
* Three personality taglines.

Legal links currently point to:

```html
/privacy-policy/
/terms-and-conditions/
```

But the repo contains:

```text
privacy-policy.html
terms-and-conditions.html
```

## What Works

* Footer is centralized.
* Legal links exist.
* Social links exist.
* Veteran-owned trust cue exists.
* Footer has personality.

## Issues

* Legal link paths may not resolve correctly depending on deployment behavior.
* Footer has multiple tagline lines, which may be too much personality for a utility area.
* Contact email is not visible in the footer.
* Footer utility is weaker than footer personality.
* Footer has three visual columns but does not yet feel like a refined MurphOS footer.

## MurphOS Direction

Footer should prioritize:

* Business name.
* Email.
* Social links.
* Service area.
* Privacy Policy.
* Terms & Conditions.
* Optional veteran-owned mark.
* One restrained brand line, not three competing ones.

Recommended legal link fix:

Either change links to:

```text
/privacy-policy.html
/terms-and-conditions.html
```

or move legal files into folders:

```text
privacy-policy/index.html
terms-and-conditions/index.html
```

## Priority

**P1**

Files affected:

* `_includes/footer.html`
* `privacy-policy.html`
* `terms-and-conditions.html`
* `assets/css/styles-16.css`

Component opportunity:

* `mm-footer`

---

# Layout / CSS Foundation Audit

## Observed Implementation

Current global CSS includes:

* `--bg` using brand cream.
* Fixed header.
* `.container`.
* `.btn`.
* `.card`.
* gallery styles.
* process gallery styles.
* lace strip styles.
* contact/form styles.
* footer styles.
* mobile menu styles.
* home section styles.
* review styles.

## What Works

* There is a centralized stylesheet.
* Existing CSS already has section comments.
* Current site is organized enough to refactor.
* The CSS is not hopeless. A rare mercy from the web gods.

## Issues

* Design tokens are incomplete.
* Old comments and stale implementation notes remain.
* Inline styles bypass the system.
* Button hierarchy conflicts with MurphOS.
* Form styles are split between global CSS and page-level CSS.
* Card styling is too globally dominant.
* `.gallery-strip` and `.lace-strip` share structure, but gallery photos and lace swatches have different jobs.
* Old iframe styles remain even though the service request is now native.

## MurphOS Direction

Phase 1 should create a clean foundation:

* new tokens
* new font roles
* new button system
* new section containers
* new card system
* new form system
* new lace swatch system
* removal of stale CSS

## Priority

**P0**

Files affected:

* `assets/css/styles-16.css`
* page files with inline styles

---

# Home Page Audit

## Observed Implementation

`index.html` includes:

* Full hero.
* Trust strip.
* Before & After dynamic gallery preview.
* Services overview.
* Process preview.
* Reviews.
* Lightbox markup.

This is stronger than the first-pass audit assumed.

## What Works

* Home page has real content after the hero.
* Dynamic gallery preview adds proof.
* Trust strip is useful.
* Services overview exists.
* Reviews are included.
* CTAs appear throughout the page.

## Issues

* Hero headline says “Professional Glove Relacing & Restoration.”
* Supporting copy says “relacing and restoration.”
* Services include “Full Relace & Restoration.”
* Process preview says “The Restoration Process.”
* Dynamic gallery alt text says “restoration photo.”
* Home services use cards for all service items.
* Red primary CTAs are used.
* Home sections still use the old darker background.
* Reviews contain “brand new” language from customer quotes.

## MurphOS Direction

Home should keep its structure but refine the language and presentation.

Recommended changes:

* Replace “Restoration” with “Care,” “Relacing,” “Revival,” or “Bring Back to Life” language where appropriate.
* Convert service cards into quieter service blocks or editorial feature rows.
* Keep the gallery preview but ensure it uses the approved lightbox and image component.
* Use navy primary CTAs.
* Use lighter MurphOS background.
* Curate review excerpts.

Recommended hero language direction:

```text
Professional Glove Relacing & Care
```

or

```text
Bring Your Glove Back to Life
```

## Priority

**P1**

Files affected:

* `index.html`
* `assets/css/styles-16.css`
* `assets/js/main.js`

Component opportunity:

* `mm-hero`
* `mm-trust-strip`
* `mm-gallery-preview`
* `mm-service-block`
* `mm-review-card`
* `mm-cta`

---

# Services Page Audit

## Observed Implementation

`services/index.html` includes:

* Page title.
* Intro copy.
* Pricing note.
* Craftsman Certified Relacer card.
* Price grid with multiple service cards.
* Reviews section.
* Lace Colors section.
* Dynamic lace inventory stock display.
* Page actions.
* Inline JavaScript for stock display.

## What Works

* Pricing is clear.
* Services are practical.
* Certification adds trust.
* Reviews are strong proof.
* Lace color section exists.
* `/services/#Lace-Colors` exists.
* Lace stock display fetches `/api/lace-inventory`.
* Out-of-stock threshold is currently set to `3`, matching the inventory philosophy.

## Issues

### Typo

Page title says:

```text
Cutom Glove Services
```

Should be:

```text
Custom Glove Services
```

### Language

Current heading says:

```text
Baseball Glove Relacing, Repair & Restoration Services
```

This conflicts with the refined brand position.

### Over-carded Layout

The page uses many card blocks:

* certification card
* service price cards
* review cards

Cards are useful here, but the page feels boxed.

### Certification Placement

Certification appears before the service list.

This delays the customer from seeing the services they came for.

Certification may work better as a smaller trust block after the main services or near the relacing section.

### Copy Issues

Examples:

* “The Craftman's Works” appears with a typo.
* Some service descriptions use “we” instead of the preferred one-man-shop voice.
* “repair” and “restoration” appear where “relacing,” “care,” or “revival” would be more accurate.

### Lace Colors

Lace colors are still low on the page after reviews.

They use `.lace-strip` and `.lace-item`, which behave more like a horizontal gallery than a structured swatch component.

Labels are hidden until hover or tap.

Pink and Japan Tan swatches do not have `data-lace-color`, so dynamic inventory status cannot update them.

The anchor uses uppercase:

```text
#Lace-Colors
```

MurphOS should standardize this to lowercase:

```text
#lace-colors
```

Old links can be supported temporarily.

### Out-of-Stock Overlay

Out-of-stock overlay style is injected inline by JavaScript.

This should become a class-based component state.

## MurphOS Direction

Recommended Services page structure:

1. Page intro.
2. Main services.
3. Relacing section.
4. Lace color preview near relacing.
5. Pricing details.
6. Certification trust cue.
7. Curated reviews.
8. CTA.

The lace color grid should become `mm-lace-grid`.

Each lace color should become `mm-lace-swatch`.

Availability should be handled with classes, not inline style strings.

## Priority

**P0**

Files affected:

* `services/index.html`
* `assets/css/styles-16.css`
* `functions/api/lace-inventory.js`

Component opportunity:

* `mm-service-block`
* `mm-lace-grid`
* `mm-lace-swatch`
* `mm-review-card`
* `mm-trust-block`

---

# Lace Color System Audit

## Observed Implementation

Lace colors are shown in `services/index.html`.

The service request form in `contact/index.html` uses dropdowns for primary and secondary lace colors.

The Services page dynamically checks inventory through `/api/lace-inventory`.

The service form does not currently use the dynamic lace inventory.

## What Works

* Lace photos exist.
* Lace section has an anchor.
* Dynamic inventory is already partially implemented.
* Out-of-stock display exists.
* Contact form includes primary and secondary lace choices.
* Custom color request exists.

## Issues

* Services page and contact form use different lace experiences.
* Services page is visual.
* Contact form is dropdown-only.
* Dropdown options include `Other (Special Order)`, which conflicts with the newer direction to use a custom color request field instead.
* Some form options do not appear in the Services swatch list.
* Some swatches do not have inventory data attributes.
* Labels are hidden on hover/tap.
* Availability is not consistently visible.
* Lace colors are not surfaced directly near the relacing decision on the Services page.

## MurphOS Direction

Lace colors should become a reusable system.

Required behavior:

* Same lace data source across Services and Contact.
* Same color names across public, form, admin, and inventory.
* Visual swatch picker in the service request form.
* Always-visible labels.
* Availability state shown clearly.
* Custom color request remains available for special requests.
* `Other (Special Order)` should be removed as a dropdown option if the custom request field handles that job.

Recommended color source:

* Use `/api/lace-inventory` for both display and form choice support.

## Priority

**P0**

Files affected:

* `services/index.html`
* `contact/index.html`
* `assets/css/styles-16.css`
* `functions/api/lace-inventory.js`

Component opportunity:

* `mm-lace-grid`
* `mm-lace-swatch`
* `mm-lace-picker`
* `mm-availability-badge`

---

# Process Page Audit

## Observed Implementation

`process/index.html` includes:

* Page title.
* Process image strip.
* One card containing three process steps.
* CTA buttons.

## What Works

* Page is short.
* Process images add trust.
* Steps are easy to understand.
* CTA is visible.
* The page mentions estimate, service approval, payment, shipping, and tracking.

## Issues

* Process photo caption says “Restore Leather.”
* Step 2 says “I Restore Your Glove.”
* The process is only three steps, but the real customer journey has more uncertainty around estimate approval and shipping/local handoff.
* The CTA button row uses inline style.
* The page uses one large card when an open step layout may feel calmer.
* Copy says “Tennessee Tannery,” but supplier language should be validated against the actual source name used in MurphOS.

## MurphOS Direction

Process page should answer the customer’s repeated questions before they ask.

Recommended steps:

1. Submit service request.
2. Receive estimate.
3. Approve estimate.
4. Get the glove to Murph’s Mitts.
5. Work begins.
6. Glove is finished.
7. Pickup, shipping, and payment are coordinated.

Add a clear section:

```text
How do I get the glove to you?
```

Include:

* Local drop-off explanation.
* Shipping explanation.
* Confirmation that instructions are sent after estimate approval.

## Priority

**P1**

Files affected:

* `process/index.html`
* `assets/css/styles-16.css`

Component opportunity:

* `mm-process-step`
* `mm-process-timeline`
* `mm-media-strip`
* `mm-cta`

---

# Gallery Page Audit

## Observed Implementation

`gallery/index.html` dynamically loads gallery photos from `/api/orders` using the `listGalleryPhotos` action.

It creates sections for:

* Fielding Gloves
* Catcher’s Mitts
* First Base Mitts
* Custom Color Relaces
* Vintage

It uses a custom inline lightbox implementation.

## What Works

* Gallery is dynamic.
* Gallery photos are categorized.
* Lazy loading is used.
* Empty state exists.
* Lightbox exists.
* The page is simple and proof-focused.

## Issues

* Page description says “Glove restoration before and after photos.”
* Page lede says gloves “showed up hopeless,” which may be a little more dramatic than MurphOS needs.
* Inline JavaScript duplicates lightbox responsibilities instead of using a reusable component.
* Gallery lightbox differs from the home gallery lightbox.
* Some unused zoom/pan variables appear in the gallery script.
* Images have generic alt text.
* No captions or service context are shown.
* Gallery is category-based but not story-based.
* There is no CTA after the proof.

## MurphOS Direction

Gallery should become curated proof.

Recommended improvements:

* Use one approved `mm-lightbox` behavior across Home and Gallery.
* Add optional captions or service context.
* Consider featured before/after pairs.
* Use calmer copy.
* Add a quiet CTA after the gallery.
* Keep categories but make them feel intentional.

Recommended lede direction:

```text
A selection of gloves cleaned, conditioned, relaced, and brought back to life.
```

## Priority

**P1**

Files affected:

* `gallery/index.html`
* `assets/js/main.js`
* `assets/css/styles-16.css`

Component opportunity:

* `mm-gallery-grid`
* `mm-gallery-strip`
* `mm-lightbox`
* `mm-before-after`
* `mm-empty-state`

---

# Baseball Glove Relacing / FAQ Page Audit

## Observed Implementation

`baseball-glove-relacing/index.html` is an SEO/service education page with an FAQ section.

Header nav points FAQ to:

```text
/baseball-glove-relacing/#faq
```

## What Works

* Page has useful relacing education.
* FAQ content exists.
* Strong SEO value.
* Explains why full relacing matters.
* Includes before/after images.
* Includes local and mail-in service.

## Issues

* Page uses many cards.
* Several sections use inline style.
* Some copy uses “restore” and “restored.”
* It includes typo-level issues such as awkward or incorrect grammar.
* FAQ is not a standalone experience even though nav treats it like a top-level destination.
* The content overlaps with Services and Process.
* It links to lace colors, but does not visually show them near the relacing decision.

## MurphOS Direction

This page should become either:

1. A polished SEO relacing guide with FAQ as a section, or
2. A proper FAQ/help page with relacing content linked separately.

Short-term:

* Keep the page.
* Clean copy.
* Reduce cards.
* Fix grammar.
* Add clear links to Services, Process, Lace Colors, and Service Request.

Long-term:

* Consider a dedicated FAQ page.

## Priority

**P1**

Files affected:

* `baseball-glove-relacing/index.html`
* `_includes/header.html`
* `assets/css/styles-16.css`

Component opportunity:

* `mm-faq-item`
* `mm-content-section`
* `mm-before-after`
* `mm-cta`

---

# About Page Audit

## Observed Implementation

`about/index.html` includes:

* Custom container width inline style.
* Split layout.
* Long card with Brett’s story.
* About photo card.
* Strong personality and local/small-business tone.

## What Works

* Page has the right personality.
* It feels human.
* Marine background is present.
* Baseball/glove connection is real.
* The tone supports the one-man-shop identity.

## Issues

* Heavy inline styling.
* Two-card layout feels less editorial than MurphOS.
* Copy is dense.
* “Now I restore gloves…” may need softening.
* Page has a strong voice but could use clearer hierarchy.
* Photo treatment should be moved into reusable CSS.

## MurphOS Direction

About page should stay personal.

Do not sterilize it.

Recommended structure:

1. Short intro.
2. Why gloves matter.
3. How Murph’s Mitts started.
4. Brett’s background.
5. What customers can expect.
6. CTA.

Use an editorial layout instead of boxed copy.

Keep Brett’s voice, just shape it better.

## Priority

**P2**

Files affected:

* `about/index.html`
* `assets/css/styles-16.css`

Component opportunity:

* `mm-editorial-section`
* `mm-media-block`
* `mm-cta`

---

# Contact / Service Request Audit

## Observed Implementation

`contact/index.html` is much better than the earlier assumption.

The service request form is native.

It is not a Google Form iframe.

The page includes:

* Question tab.
* Service Request tab.
* FormSubmit general question form.
* Native service request form.
* Contact info.
* Social links.
* SMS opt-in disclosure.
* Glove details.
* Services requested.
* Lace color dropdowns.
* Drop-off method.
* Conditional shipping address fields.
* Final details.
* Client-side validation.
* `/api/intake` submission.

This is a strong operational foundation.

## What Works

* Native service request exists.
* Conditional shipping fields work.
* Local vs shipped logic exists.
* SMS opt-in is included.
* Client-side validation exists.
* Success state exists.
* Service form maps to the actual intake payload.
* The page is already close to MurphOS workflow thinking.

## Issues

* Huge page-level `<style>` block should move to global CSS.
* The outer contact content still sits inside a `.card`.
* Service form sections use a different visual style than the rest of the site.
* Primary and secondary lace color fields are dropdowns, not swatches.
* Lace options are static and may drift from inventory.
* `Other (Special Order)` still appears in lace dropdowns.
* Custom color request already exists, so `Other (Special Order)` is redundant.
* Success message confirms submission but does not fully explain what happens next.
* Question form still uses FormSubmit, which is acceptable short-term but not fully MurphOS.
* Some inline styles remain.
* Form copy says “Got a question? Use the quick form,” which works but could be more polished.

## MurphOS Direction

The service request form should become one of the flagship MurphOS components.

Recommended improvements:

* Move all form styles to `styles-16.css`.
* Convert form sections to `mm-form-section`.
* Convert inputs to `mm-form-field`.
* Replace lace dropdowns with `mm-lace-picker`.
* Load lace options from `/api/lace-inventory`.
* Remove `Other (Special Order)` dropdown option.
* Keep custom color request as the special request path.
* Improve success state.

Recommended success state should answer:

* Request received.
* Order number.
* Confirmation email sent.
* Brett will review the request.
* Estimate comes next.
* Photos may be requested if needed.
* No work starts until estimate approval.

## Priority

**P0**

Files affected:

* `contact/index.html`
* `assets/css/styles-16.css`
* `functions/api/intake.js`
* `functions/api/lace-inventory.js`

Component opportunity:

* `mm-contact-tabs`
* `mm-form-section`
* `mm-form-field`
* `mm-lace-picker`
* `mm-status-message`
* `mm-success-state`

---

# Gloves For Sale Audit

## Observed Implementation

`for-sale/index.html` loads listings with `for-sale/for-sale.js`.

`for-sale/glove.html` renders a dynamic detail view from the same API.

## What Works

* For-sale feature exists.
* Listing grid is visually simpler and less card-heavy.
* Hover photo support exists.
* Sold badge exists.
* Detail page includes slider, specs, price, description, and action buttons.

## Issues

* Page description uses “Restored.”
* Listing state says “Loading...” instead of an approved loading state.
* Empty state says “No gloves available,” which is okay but could be warmer.
* `for-sale.js` uses inline `onclick`, `onmouseenter`, and `onmouseleave`.
* Listing details are injected with template strings without escaping.
* Detail URL uses `/for-sale/glove?slug=...`, but source file is `for-sale/glove.html`. Verify deployment supports that clean URL.
* CTA says `Buy This Glove`, which may be fine for actual listings but should follow calmer MurphOS action language where possible.
* Detail page buttons still inherit red primary CTA.

## MurphOS Direction

For Sale should become a polished commerce-like section without feeling pushy.

Recommended fixes:

* Escape dynamic content.
* Avoid inline event handlers.
* Use click listeners.
* Verify route path or move detail to `for-sale/glove/index.html`.
* Use `mm-for-sale-card`.
* Use `mm-for-sale-gallery`.
* Use approved button system.
* Replace “Restored” with “Revived,” “Game-ready,” or more accurate condition language when needed.

## Priority

**P1**

Files affected:

* `for-sale/index.html`
* `for-sale/glove.html`
* `for-sale/for-sale.js`
* `assets/css/styles-16.css`
* `functions/api/gloves-for-sale.js`

Component opportunity:

* `mm-sale-card`
* `mm-sale-detail`
* `mm-sale-gallery`
* `mm-status-badge`

---

# Forms Audit

## What Works

* Native service request form exists.
* Conditional logic exists.
* Validation exists.
* Success state exists.
* Form payload aligns with order intake.
* SMS opt-in exists.
* Required fields are clearly marked.

## Issues

* Form styles live mostly inside the Contact page.
* Inputs in global CSS and Contact page CSS conflict philosophically.
* Global `.mm-field input` styles use dark navy backgrounds, while Contact overrides them with white input styles.
* Lace color inputs are dropdowns.
* Shipping fields ask for customer shipping address only when shipped, which works.
* Success state needs better next-step clarity.
* Errors are clear but could be more consistent with MurphOS component language.

## MurphOS Direction

Native form is the right direction.

Do not go back to iframe-based service request.

Next step is componentization.

Recommended improvements:

* One approved form style.
* Visual lace swatches.
* Dynamic lace inventory.
* Cleaner form section rhythm.
* Better success message.
* Possibly separate “question” and “service request” pages later if the tab structure feels too heavy.

## Priority

**P0**

Component opportunity:

* `mm-form`
* `mm-form-section`
* `mm-form-field`
* `mm-choice-list`
* `mm-lace-picker`
* `mm-success-state`
* `mm-error-state`

---

# Photography Audit

## What Works

* Real glove photos are used.
* Home gallery preview is dynamic.
* Gallery page is dynamic.
* Lace photos exist.
* Process photos exist.
* About photo exists.
* For-sale listings support multiple photos.

## Issues

* Photography roles are not separated cleanly in components.
* Lace photos share behavior with gallery strips.
* Gallery photos lack captions or context.
* Home gallery alt text says “restoration photo.”
* Gallery page description says “restoration before and after.”
* Lace labels are hidden on hover/tap.
* Process photos are useful but captions should align with brand language.
* There is no unified image role system in code yet.

## MurphOS Direction

Create separate components for:

* hero image
* gallery proof image
* process image
* before/after image
* lace swatch image
* for-sale listing image

The same image may be used in different places, but the component behavior should match the purpose.

Lace photos are not gallery photos.

They are customer decision tools.

That sentence should haunt the CSS until it behaves.

## Priority

**P1**

Files affected:

* `index.html`
* `gallery/index.html`
* `services/index.html`
* `process/index.html`
* `for-sale/index.html`
* `assets/css/styles-16.css`
* `assets/js/main.js`

---

# Lightbox Audit

## Observed Implementation

There are two lightbox systems:

1. Global `initGalleryLightbox()` in `assets/js/main.js`.
2. Inline Gallery-specific lightbox inside `gallery/index.html`.

Home uses markup with `.lb-track`.

Gallery uses markup with `.lb-card` and `.lb-img`.

## What Works

* Home and gallery both support larger photo viewing.
* Gallery click/tap navigation exists.
* Escape key works.
* Outside click close exists.
* Some prior gesture issues appear to have been addressed.

## Issues

* Lightbox behavior is split across two implementations.
* Gallery JS defines unused zoom/pan variables.
* Home lightbox and Gallery lightbox use different markup.
* This will make future fixes harder.
* The previous pinch/zoom issues make this a sensitive component.

## MurphOS Direction

Create one approved `mm-lightbox`.

Requirements:

* Shared markup.
* Shared JS.
* Works for Home, Gallery, For Sale, and future order/gallery contexts.
* Stable mobile behavior.
* No accidental photo changes while pinch-zooming.
* Clear close/next/previous controls.
* Minimal visual noise.

## Priority

**P1**

Files affected:

* `gallery/index.html`
* `index.html`
* `assets/js/main.js`
* `assets/css/styles-16.css`
* `for-sale/glove.html`

Component opportunity:

* `mm-lightbox`

---

# Copywriting Audit

## What Works

* Voice feels human.
* Site feels like Brett, not a chain.
* Local/small-business feel is strong.
* Copy generally explains what customers need.
* Contact form copy is practical.
* Reviews provide strong trust.

## Issues

Restoration language appears across key files:

* Home hero.
* Home services.
* Process.
* Gallery description.
* Relacing page.
* About page.
* For Sale pages.
* Default meta descriptions.

Some customer review quotes include “brand new.” Those can remain as customer quotes, but MurphOS should not repeat that promise in brand-written copy.

Several small typos or phrase issues exist:

* `Cutom Glove Services`
* `Craftman's`
* inconsistent `Craftsman's`
* “Tennessee Tannery” should be validated.
* “Fielders Glove” may need apostrophe consistency if chosen.
* `Insta` may be changed to `Instagram` for consistency.

## MurphOS Direction

Preferred language:

* Relacing
* Cleaning
* Conditioning
* Glove care
* Bring back to life
* Revive
* Restore feel
* Restore structure
* Preserve character
* Ready for more seasons

Avoid brand-written promises like:

* like new
* brand new
* factory new
* perfect restoration
* full restoration
* museum restoration

## Priority

**P1**

Files affected:

* All public pages.
* `_layouts/default.html`.
* `assets/js/main.js`.

---

# SEO / Metadata Audit

## What Works

* Pages include titles and descriptions.
* Open Graph and Twitter metadata exist.
* SEO-focused relacing page exists.
* Local and mail-in service terms are present.

## Issues

* Default descriptions use “repair” and “restoration.”
* `og:image` and `twitter:image` point to `/assets/img/social-preview.jpg`, but that file was not present in the reviewed asset list.
* Services title has typo.
* Gallery description uses restoration.
* For-sale descriptions use restored.
* FAQ is an anchor, not a full page.

## MurphOS Direction

Update metadata to match refined brand language.

Verify social preview image exists or create it.

Recommended default description direction:

```text
Professional baseball and softball glove relacing, cleaning, conditioning, and care. Local drop-off in Surf City, NC and nationwide mail-in service.
```

## Priority

**P1**

Files affected:

* `_layouts/default.html`
* all page front matter
* assets social preview image

---

# Performance / Friction Audit

## What Works

* Site is mostly static.
* No heavy frontend framework.
* Gallery images lazy-load.
* Public JS is relatively small.
* Home and Gallery dynamically fetch photos.

## Issues

* Google Fonts dependency exists.
* Montserrat is loaded globally even though MurphOS now limits it to brand moments.
* Dynamic gallery calls `/api/orders`.
* Old iframe CSS remains.
* Inline scripts exist in page files.
* Gallery and for-sale dynamic rendering should escape content more consistently.
* Large images should be reviewed for compression and responsive sizing.
* CSS includes stale comments and old implementation notes.

## MurphOS Direction

Performance improvements should include:

* System font for body.
* Load Montserrat only if needed.
* Image optimization pass.
* Remove dead iframe styles.
* Move inline JS/CSS where practical.
* Use shared lightbox component.
* Use consistent loading and empty states.

## Priority

**P1**

---

# Accessibility Audit

## What Works

* Header nav uses aria labels.
* Mobile menu has aria-hidden.
* Buttons have aria-labels in gallery/lightbox.
* Gallery images have alt text.
* Contact form labels exist.
* SMS disclosure exists.

## Issues

* Lace color labels are hidden until hover/tap.
* Lace color choice relies heavily on visual color plus hidden labels.
* Mobile menu aria-hidden does not appear to be updated in JS when opened or closed.
* FAQ nav link lacks active state.
* Lightbox focus trapping is not implemented.
* Dynamic content injected into For Sale should be escaped and structured better.
* Out-of-stock overlay uses an `<a>` without an href, which is not semantically appropriate.

## MurphOS Direction

Accessibility fixes:

* Always-visible lace labels.
* Proper button or div for out-of-stock overlay, not anchor.
* Update mobile menu aria-hidden in JS.
* Add focus handling for mobile menu and lightbox over time.
* Do not rely on color alone for status.
* Use semantic structure for swatches and selected states.

## Priority

**P1**

---

# Component Audit

## Current Patterns That Should Become Components

The site already has early component patterns:

* Header
* Footer
* Buttons
* Cards
* Review cards
* Price cards
* Gallery strip
* Gallery thumb
* Lace item
* Process shot
* Contact tabs
* Service form section
* Form field
* Sale card
* Sale detail gallery
* Lightbox

## Main Component Issues

* Components are not named under a MurphOS system.
* Some components do multiple jobs.
* Gallery and lace share too much structure.
* Buttons conflict with the new hierarchy.
* Cards are too general.
* Form styles are split.
* Lightbox is duplicated.
* Inline styles hide reusable patterns.

## MurphOS Direction

Create these first:

* `mm-button`
* `mm-section`
* `mm-card`
* `mm-header`
* `mm-footer`
* `mm-hero`
* `mm-service-block`
* `mm-review-card`
* `mm-lace-grid`
* `mm-lace-swatch`
* `mm-lace-picker`
* `mm-gallery-strip`
* `mm-gallery-thumb`
* `mm-lightbox`
* `mm-form-section`
* `mm-form-field`
* `mm-status-message`
* `mm-sale-card`

## Priority

**P0**

---

# Priority Summary

## P0: Highest Priority

These should be handled first.

1. Remove `supabase.env` from Git and rotate service-role key if pushed.
2. Replace current CSS tokens with MurphOS tokens.
3. Change button hierarchy so primary is navy, not red.
4. Move body/UI font to system stack.
5. Fix invalid CSS values and undefined variables.
6. Move large contact page CSS into global CSS.
7. Convert lace colors into proper swatch/picker components.
8. Clean Services page structure and typo.
9. Remove stale or conflicting form styles.
10. Establish component naming and reusable classes.

---

## P1: First Redesign Pass

These should happen during the first redesign pass.

1. Refine Home language and layout.
2. Rework Services hierarchy.
3. Improve Process page clarity.
4. Unify lightbox behavior.
5. Improve Gallery curation and CTA.
6. Fix footer utility and legal links.
7. Refine header nav order and FAQ handling.
8. Update metadata and missing social preview image.
9. Clean restoration language.
10. Improve mobile/accessibility states.

---

## P2: Later Refinement

These can follow after the core redesign.

1. Rewrite About page into more editorial layout.
2. Create a dedicated FAQ page.
3. Add richer before/after story blocks.
4. Improve For Sale filtering or listing detail depth.
5. Add advanced gallery filtering.
6. Further tune animations and motion.
7. Add stronger local/community trust sections if useful.

---

# Recommended Execution Order

## Phase 1: Safety and Foundation

* Remove `supabase.env` from Git.
* Rotate service-role key if needed.
* Add MurphOS tokens.
* Add font system.
* Fix invalid CSS.
* Fix undefined variables.
* Fix button hierarchy.
* Clean base CSS comments.

## Phase 2: Global Components

* Header.
* Footer.
* Buttons.
* Sections.
* Cards.
* Forms.
* Status messages.
* Lightbox foundation.

## Phase 3: Services and Lace Flow

* Fix Services page typo.
* Rebuild Services hierarchy.
* Move certification to better trust position.
* Convert lace strip to swatch grid.
* Add lace color preview near relacing.
* Replace inline inventory overlay styles with classes.
* Standardize lace anchor to `#lace-colors`.

## Phase 4: Contact and Service Request

* Move contact styles into CSS.
* Convert form sections to components.
* Replace lace dropdowns with visual swatch picker.
* Load lace inventory dynamically.
* Remove `Other (Special Order)` dropdown option.
* Improve success state.

## Phase 5: Home, Process, Gallery

* Refine home copy.
* Reduce home cards.
* Improve process steps.
* Add “How do I get the glove to you?” section.
* Unify gallery/lightbox.
* Add gallery CTA.

## Phase 6: Copy, SEO, and Polish

* Replace overbroad restoration language.
* Fix metadata.
* Verify social preview image.
* Clean typos.
* Optimize images.
* Test mobile.
* Test accessibility.
* Remove dead CSS and unused JS.

---

# What Should Stay

The redesign should preserve:

* Real small-business tone.
* Brett’s personality.
* Local Surf City / Hampstead trust.
* Marine background.
* Real glove proof.
* Before and after content.
* Customer reviews.
* Local and mail-in service positioning.
* Native service request form.
* SMS opt-in workflow.
* Dynamic gallery.
* Dynamic lace inventory direction.
* Gloves For Sale feature.

The site does not need to become colder.

It needs to become more intentional.

Do not remove the soul while cleaning the garage.

That would be aggressively human.

---

# What Should Change

The redesign should change:

* Full-page `#dacab1` background.
* Red primary buttons.
* Montserrat as full body font.
* Overuse of cards.
* Inline styles.
* Page-level form styles.
* Hidden lace labels.
* Dropdown-only lace selection.
* Duplicated lightbox systems.
* Restoration-heavy language.
* Footer link/utility structure.
* FAQ as a confusing nav anchor.
* Stale iframe styles.
* Invalid CSS values.
* Undefined CSS variables.

---

# What Should Become Reusable Components

The following should be formalized:

* Header
* Footer
* Button
* Section
* Card
* Hero
* Service block
* Trust block
* Review card
* Gallery strip
* Gallery thumb
* Lightbox
* Process step
* Form section
* Form field
* Choice list
* Lace swatch
* Lace picker
* Availability badge
* Status message
* Success state
* Error state
* Sale card
* Sale detail gallery

---

# Final Assessment

The current Murph's Mitts site is not broken.

It is ahead of where the earlier first-pass audit assumed.

The native service request form, dynamic gallery, dynamic lace stock display, Gloves For Sale feature, and documented MurphOS files are all strong signs that the site has already started becoming a real operating system.

The remaining problem is consistency.

MurphOS needs to take what already works and make it systematic.

The highest-value improvements are:

* safer repo hygiene
* cleaner CSS foundation
* proper tokens
* better button hierarchy
* lighter background system
* system UI font
* fewer cards
* stronger lace decision support
* native form polish
* unified lightbox
* cleaner copy
* reusable components

The redesign should not start by throwing everything away.

It should start by giving the current site a spine.

That is the source-based audit.

That is the work.
