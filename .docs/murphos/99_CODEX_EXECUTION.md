# MurphOS Codex Execution Plan

**Version:** 1.0
**Status:** Draft
**Last Updated:** June 2026

---

# Why This Exists

This document defines how Codex should implement the MurphOS redesign for Murph's Mitts.

The purpose is control.

MurphOS already defines the philosophy, brand, interface rules, design system, copywriting standards, photography standards, component library, and website audit.

Codex should not invent a new design direction.

Codex should execute the approved system.

This document turns MurphOS into a phased implementation plan so changes can be reviewed, tested, and deployed safely.

---

# Source Documents

Codex should reference these documents before making changes:

* `.docs/murphos/01_DESIGN_LANGUAGE.md`
* `.docs/murphos/02_BRAND.md`
* `.docs/murphos/03_HUMAN_INTERFACE_GUIDELINES.md`
* `.docs/murphos/04_DESIGN_SYSTEM.md`
* `.docs/murphos/05_COPYWRITING.md`
* `.docs/murphos/06_PHOTOGRAPHY.md`
* `.docs/murphos/07_COMPONENT_LIBRARY.md`
* `.docs/murphos/08_WEBSITE_AUDIT.md`

If a code change conflicts with these documents, the documents win unless Brett explicitly approves a change.

---

# Execution Philosophy

Codex should work in small, reviewable phases.

Do not redesign the entire site in one pass.

Do not make broad visual changes without a clear phase goal.

Do not invent new colors, spacing values, typography scales, button styles, card treatments, or components unless the current MurphOS system cannot support the need.

Every change should support at least one of these goals:

* Reduce friction.
* Build trust.
* Showcase craftsmanship.
* Support a customer decision.
* Improve admin speed.
* Improve consistency.
* Improve maintainability.

If a change does none of those things, do not make it.

---

# Non-Negotiables

## Do Not Break Existing Functionality

Preserve existing working functionality unless the phase specifically replaces it.

This includes:

* Mobile menu.
* Header behavior.
* Gallery loading.
* Gallery/lightbox behavior.
* Services lace inventory loading.
* Contact tabs.
* Service request form.
* Conditional shipping fields.
* `/api/intake` submission.
* SMS opt-in field.
* Gloves For Sale listings.
* For Sale detail page.
* Footer legal links after they are corrected.
* Existing admin functionality unless explicitly included.

If a refactor risks breaking functionality, keep the change smaller.

---

## Do Not Touch Secrets

Do not print, expose, move, or hardcode secrets.

Do not copy environment values into client-side code.

Do not commit `.env`, `supabase.env`, service role keys, Cloudflare tokens, Twilio auth tokens, or private credentials.

Public anon keys may exist in frontend config only if already intended for public browser use.

Service-role keys never belong in the public repo.

---

## Keep the Site Personal

MurphOS should make the site cleaner, calmer, and more premium.

It should not make the site corporate.

Preserve:

* Brett’s voice.
* Small-business trust.
* Local Surf City / Hampstead feel.
* Marine background.
* Real glove proof.
* Honest glove-care language.
* Warmth and personality where appropriate.

Do not turn Murph’s Mitts into a faceless repair-company template.

The goal is better structure around Brett, not less Brett.

---

## Use Approved Language

Avoid brand-written claims that overpromise.

Do not describe Murph’s Mitts as making gloves:

* brand new
* like new
* factory new
* perfectly restored
* fully restored
* museum restored

Preferred language:

* relacing
* cleaning
* conditioning
* glove care
* bring back to life
* revive
* restore feel
* restore structure
* preserve character
* ready for more seasons

Customer quotes may include their own wording, but brand-written copy should stay accurate.

---

## Red Is Not a Primary CTA

Red is reserved for:

* destructive actions
* warning states
* urgent states
* rare emphasis

Primary customer actions should use navy.

Secondary actions should be quiet.

No giant red CTA festival.

Civilization has endured enough.

---

# Files Most Likely Affected

Primary public site files:

* `index.html`
* `services/index.html`
* `process/index.html`
* `gallery/index.html`
* `baseball-glove-relacing/index.html`
* `about/index.html`
* `contact/index.html`
* `for-sale/index.html`
* `for-sale/glove.html`

Includes and layouts:

* `_includes/header.html`
* `_includes/footer.html`
* `_layouts/default.html`

Assets:

* `assets/css/styles-16.css`
* `assets/js/main.js`
* `for-sale/for-sale.js`

APIs that may be relevant later:

* `functions/api/intake.js`
* `functions/api/lace-inventory.js`
* `functions/api/gloves-for-sale.js`

Docs:

* `.docs/murphos/*`

Do not modify unrelated admin files unless a phase specifically says to.

---

# Phase 0: Repo Safety Cleanup

## Goal

Remove sensitive files from tracking and prevent future secret exposure.

## Tasks

1. Add `supabase.env` to `.gitignore`.
2. Remove `supabase.env` from Git tracking.
3. Do not delete the local file unless explicitly instructed.
4. Do not print or expose secret values.
5. Recommend rotating the Supabase service-role key if the file has ever been pushed.

## Files

* `.gitignore`
* `supabase.env`

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md` first.

Perform Phase 0 only.

Add `supabase.env` to `.gitignore` if it is not already ignored. Remove `supabase.env` from Git tracking without deleting the local file. Do not print, move, copy, or expose any secret values. Do not modify unrelated files.

After changes, summarize exactly what changed and list any manual follow-up needed, including whether the Supabase service-role key should be rotated if this file was ever pushed.
```

## Definition of Done

* `supabase.env` is ignored.
* `supabase.env` is no longer tracked.
* No secrets are printed.
* No unrelated files are changed.

Priority:

**P0**

---

# Phase 1: MurphOS CSS Foundation

## Goal

Implement the MurphOS visual foundation without redesigning individual pages yet.

This phase should update the global design tokens and basic reusable foundations.

## Tasks

1. Replace the current token foundation in `styles-16.css` with MurphOS tokens.
2. Keep backward-compatible aliases if needed during transition.
3. Add approved color tokens.
4. Add approved font tokens.
5. Add approved spacing tokens.
6. Add approved radius tokens.
7. Add approved motion tokens.
8. Switch body/UI text to system font stack.
9. Keep Montserrat for brand moments.
10. Fix invalid CSS values such as `#navy`.
11. Define or remove undefined variables such as `--muted` and `--ink-light`.
12. Update `.btn-primary` to navy.
13. Update `.btn-secondary` to quiet/outline styling.
14. Add a red destructive button style if needed.
15. Do not restructure pages in this phase.

## Files

* `assets/css/styles-16.css`
* `_layouts/default.html` only if font loading changes are needed

## Approved Core Tokens

```css
--mm-bg: #f6efe5;
--mm-bg-soft: #f9f5ee;
--mm-surface: #fffaf3;

--mm-cream-brand: #dacab1;
--mm-navy: #092f4d;
--mm-ink: #020b12;
--mm-red: #921a24;
--mm-white: #ffffff;

--font-brand: "Montserrat", system-ui, sans-serif;
--font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

--text-xs: 12px;
--text-sm: 13px;
--text-base: 15px;
--text-md: 17px;
--text-lg: 20px;
--text-xl: 26px;
--text-2xl: 34px;
--text-hero: clamp(40px, 6vw, 64px);

--radius-sm: 10px;
--radius-md: 14px;
--radius-lg: 18px;
--radius-xl: 24px;

--motion-fast: 120ms;
--motion-base: 180ms;
--motion-slow: 240ms;
```

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 1 only.

Update `assets/css/styles-16.css` to add the MurphOS design tokens, font system, button hierarchy, radius tokens, spacing tokens, and motion tokens from the execution plan. Switch body/UI text to the system font stack while preserving Montserrat for brand/nav/button/label moments. Fix invalid CSS values such as `#navy` and resolve undefined variables such as `--muted` and `--ink-light`.

Do not redesign page layouts. Do not modify page HTML unless absolutely required for font loading. Preserve existing functionality. Summarize changed selectors and any risky areas.
```

## Definition of Done

* Body text uses system UI.
* Montserrat remains available for brand moments.
* Primary buttons are navy.
* Red is no longer the normal primary CTA.
* `#dacab1` is no longer the default full-site background role.
* Invalid CSS values are fixed.
* Undefined variables are resolved.
* Site still loads and navigates.

Priority:

**P0**

---

# Phase 2: Global Layout Components

## Goal

Refactor global header, footer, sections, buttons, cards, and basic component classes into MurphOS-aligned reusable patterns.

## Tasks

1. Refine header structure and nav order.
2. Fix invalid `<br>` closing tag in header.
3. Formalize header states:

   * default
   * home hero overlay
   * scrolled
   * mobile menu
4. Update mobile menu `aria-hidden` state in JavaScript if needed.
5. Refine footer utility.
6. Fix legal link paths.
7. Add footer contact email.
8. Reduce footer tagline clutter.
9. Standardize section/container classes.
10. Create or refine reusable:

    * `mm-section`
    * `mm-card`
    * `mm-button`
    * `mm-text-link`
    * `mm-status-message`
11. Do not fully redesign individual pages yet.

## Recommended Nav Order

1. Home
2. Services
3. Process
4. Gallery
5. Gloves For Sale
6. FAQ
7. About
8. Contact

## Files

* `_includes/header.html`
* `_includes/footer.html`
* `assets/css/styles-16.css`
* `assets/js/main.js`

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 2 only.

Refine the global header and footer according to MurphOS. Fix invalid header markup, use the recommended nav order, preserve the mobile menu, update ARIA state if needed, and refine footer utility with contact email, legal links, social links, service area, and a restrained brand line. Add or refine reusable global classes for sections, cards, buttons, text links, and status messages.

Do not redesign individual page content yet. Preserve all existing links unless the audit explicitly identifies a broken path. Summarize changed files and verify mobile menu behavior.
```

## Definition of Done

* Header markup is valid.
* Nav order follows MurphOS.
* Mobile menu still works.
* Footer legal links resolve.
* Footer includes useful contact info.
* Global components are easier to reuse.
* No page-specific redesign has started.

Priority:

**P1**

---

# Phase 3: Services and Lace System

## Goal

Rebuild the Services page around customer decision clarity and convert lace colors into a real reusable MurphOS decision-support component.

## Tasks

1. Fix Services page typo:

   * `Cutom` → `Custom`
2. Reduce overbroad “repair/restoration” language.
3. Rework page hierarchy.
4. Move certification into a quieter trust position.
5. Reduce card overuse.
6. Keep pricing clear.
7. Move lace color support closer to relacing content.
8. Standardize anchor to `#lace-colors`.
9. Preserve old `#Lace-Colors` compatibility if practical.
10. Convert lace display into:

    * `mm-lace-grid`
    * `mm-lace-swatch`
    * `mm-availability-badge`
11. Make lace labels always visible.
12. Replace inline out-of-stock overlay styles with CSS classes.
13. Ensure all swatches have consistent data attributes where inventory applies.
14. Keep dynamic `/api/lace-inventory` behavior working.

## Files

* `services/index.html`
* `assets/css/styles-16.css`
* possibly `assets/js/main.js` if shared behavior is moved there
* `functions/api/lace-inventory.js` only if absolutely needed

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 3 only.

Refactor `services/index.html` and related CSS so the Services page follows MurphOS. Fix the `Cutom` typo, reduce overbroad restoration/repair language, keep pricing clear, reduce card overuse, move lace color support closer to relacing content, and convert the lace color section into reusable `mm-lace-grid`, `mm-lace-swatch`, and `mm-availability-badge` patterns.

Keep `/api/lace-inventory` dynamic stock behavior working. Make lace color labels always visible. Replace inline stock overlay styles with CSS classes. Preserve the existing anchor behavior and support lowercase `#lace-colors`.

Do not change the contact form in this phase. Summarize before/after page structure and any data attribute fixes.
```

## Definition of Done

* Services typo is fixed.
* Services page feels clearer and less boxed-in.
* Lace colors are closer to relacing decisions.
* Lace labels are always visible.
* Inventory status still works.
* No form behavior is broken.

Priority:

**P0**

---

# Phase 4: Contact and Service Request Form

## Goal

Turn the native service request form into a MurphOS-aligned customer flow.

The current native form is a strong foundation. This phase should refine it, not replace it with an iframe or third-party form.

## Tasks

1. Move page-level form CSS from `contact/index.html` into `assets/css/styles-16.css`.
2. Convert form sections into reusable component classes.
3. Standardize inputs, selects, textareas, labels, helper text, errors, and success states.
4. Keep question tab and service request tab working.
5. Keep `/api/intake` submission working.
6. Keep SMS opt-in field and disclosure.
7. Keep conditional shipping/local field behavior.
8. Replace lace dropdowns with visual lace picker if feasible in this phase.
9. If full swatch picker is too much for one pass, prepare structure without breaking dropdowns.
10. Remove `Other (Special Order)` dropdown option if custom color request field handles special requests.
11. Improve success message so it answers what happens next.

## Success State Should Answer

* Request received.
* Order number if available.
* Confirmation email sent if true.
* Brett will review the request.
* Estimate comes next.
* No work starts until approval.
* Photos may be requested if needed.

## Files

* `contact/index.html`
* `assets/css/styles-16.css`
* possibly `assets/js/main.js`
* `functions/api/intake.js` only if payload changes are required
* `functions/api/lace-inventory.js` if lace picker becomes dynamic

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 4 only.

Refactor the Contact and Service Request page to follow MurphOS. Move page-level form CSS from `contact/index.html` into `assets/css/styles-16.css`, create reusable form section/field/status styles, preserve the question tab, service request tab, `/api/intake` submission, SMS opt-in, validation, and conditional shipping fields.

Improve the success message so customers know what happens next. If implementing the lace swatch picker is too large, do not force it in this pass; instead, keep the dropdowns working and prepare clean component structure. Remove `Other (Special Order)` only if the custom color request field fully covers that path.

Do not break form submission. Summarize what was tested.
```

## Definition of Done

* Contact form styling is no longer trapped in a giant page-level style block.
* Form still submits.
* Shipping fields still conditionally appear.
* SMS opt-in remains intact.
* Success state is clearer.
* Lace field path is cleaner or prepared for visual picker.
* No customer intake behavior is lost.

Priority:

**P0**

---

# Phase 5: Home Page Refinement

## Goal

Refine the home page so it better reflects MurphOS while preserving the existing strong structure.

## Tasks

1. Replace broad restoration wording with approved language.
2. Refine hero copy.
3. Use approved button hierarchy.
4. Reduce service card heaviness.
5. Keep dynamic gallery preview working.
6. Keep reviews, but consider shorter curated excerpts.
7. Make sections feel lighter, calmer, and more intentional.
8. Ensure final CTA is clear.

## Files

* `index.html`
* `assets/css/styles-16.css`
* `assets/js/main.js`

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 5 only.

Refine `index.html` to better match MurphOS. Replace overbroad restoration language with approved relacing/care/revival language, update CTAs to use the approved button hierarchy, reduce service card heaviness where practical, and preserve the dynamic gallery preview and lightbox behavior.

Do not rewrite the entire home page from scratch. Keep the current useful structure and make it calmer, lighter, and more intentional. Summarize all copy changes.
```

## Definition of Done

* Home copy matches MurphOS.
* Red CTAs are gone from normal primary actions.
* Gallery preview still works.
* Page feels calmer without losing personality.
* No homepage dynamic behavior is broken.

Priority:

**P1**

---

# Phase 6: Process Page Refinement

## Goal

Make the Process page answer the customer’s real questions clearly.

## Tasks

1. Replace “restore” language where needed.
2. Expand process from three broad steps into clearer customer journey.
3. Add a “How do I get the glove to you?” section.
4. Explain local drop-off vs shipping.
5. Explain estimate approval before work begins.
6. Mention that shipping instructions are sent after approval for shipped orders.
7. Reduce card heaviness.
8. Keep process images but align captions with approved language.

## Files

* `process/index.html`
* `assets/css/styles-16.css`

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 6 only.

Refine `process/index.html` so it clearly explains the customer journey. Replace overbroad restore/restoration wording, add a clear section explaining how customers get the glove to Murph’s Mitts, distinguish local drop-off from shipped orders, and mention that shipping instructions are sent after estimate approval for shipped orders.

Reduce card heaviness and use MurphOS process step components where practical. Preserve existing CTAs and images unless changing captions. Summarize the revised page flow.
```

## Definition of Done

* Process page answers “what happens next?”
* Shipping/local handoff is clearer.
* Overbroad restoration language is reduced.
* Page feels more reassuring and less instruction-heavy.

Priority:

**P1**

---

# Phase 7: Gallery and Lightbox Unification

## Goal

Create one approved MurphOS lightbox behavior and make gallery proof feel more intentional.

## Tasks

1. Audit both current lightbox implementations.
2. Create or consolidate into one shared `mm-lightbox`.
3. Preserve mobile behavior.
4. Prevent accidental photo changes while zooming.
5. Keep outside click close.
6. Keep Escape key close.
7. Keep next/previous navigation.
8. Remove unused zoom/pan variables if truly unused.
9. Improve Gallery page copy.
10. Add optional CTA after gallery.
11. Improve alt text where possible.

## Files

* `gallery/index.html`
* `index.html`
* `assets/js/main.js`
* `assets/css/styles-16.css`
* possibly `for-sale/glove.html`

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 7 only.

Unify the Home and Gallery lightbox behavior into one approved MurphOS lightbox implementation. Preserve current working behavior, including outside click close, Escape key close, and next/previous navigation. Prevent accidental photo changes while zooming or pinching on mobile. Remove truly unused lightbox variables only if safe.

Refine Gallery page copy away from overbroad restoration language and add a quiet CTA after the gallery. Do not change gallery API behavior. Summarize exactly what changed and what mobile gestures should be tested.
```

## Definition of Done

* One shared lightbox pattern exists.
* Home gallery still works.
* Gallery page still loads categories.
* Mobile lightbox behavior is stable.
* Copy aligns with MurphOS.
* No gallery API behavior is broken.

Priority:

**P1**

---

# Phase 8: Baseball Glove Relacing / FAQ Cleanup

## Goal

Clean the SEO relacing page and clarify FAQ handling.

## Tasks

1. Fix typos and grammar.
2. Reduce card overuse.
3. Replace overpromising language.
4. Keep SEO value.
5. Keep FAQ anchor working.
6. Add clearer links to Services, Process, Lace Colors, and Service Request.
7. Consider whether a dedicated FAQ page should be created later, but do not create it unless instructed.

## Files

* `baseball-glove-relacing/index.html`
* `_includes/header.html` only if FAQ nav changes are needed
* `assets/css/styles-16.css`

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 8 only.

Clean up `baseball-glove-relacing/index.html` according to MurphOS. Fix typos and grammar, reduce overbroad restoration/like-new promises, keep SEO value, reduce unnecessary card heaviness, and preserve the FAQ anchor used by navigation. Add clearer contextual links to Services, Process, Lace Colors, and Service Request where useful.

Do not create a new FAQ page in this phase. Summarize all copy changes and any structural changes.
```

## Definition of Done

* Typos are fixed.
* FAQ anchor still works.
* SEO content remains useful.
* Language is honest and aligned.
* Page is less visually heavy.

Priority:

**P1**

---

# Phase 9: For Sale Cleanup

## Goal

Bring Gloves For Sale into MurphOS without overcomplicating it.

## Tasks

1. Replace “Restored” language where needed.
2. Use approved loading and empty states.
3. Use approved button hierarchy.
4. Escape dynamic content in `for-sale.js`.
5. Replace inline event handlers with event listeners where practical.
6. Verify clean detail route behavior.
7. Keep listing hover image behavior.
8. Keep sold state.
9. Keep detail gallery behavior.

## Files

* `for-sale/index.html`
* `for-sale/glove.html`
* `for-sale/for-sale.js`
* `assets/css/styles-16.css`
* possibly `functions/api/gloves-for-sale.js`

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 9 only.

Clean up the Gloves For Sale pages according to MurphOS. Replace overbroad restored/restoration language where appropriate, use approved loading and empty states, apply the approved button hierarchy, escape dynamic listing/detail content in `for-sale/for-sale.js`, and replace inline event handlers with event listeners where practical.

Preserve listing loading, hover photo behavior, sold badges, detail view, and purchase/contact actions. Verify whether `/for-sale/glove?slug=...` works in the current deployment setup and note any route concerns.
```

## Definition of Done

* For Sale still loads listings.
* Detail page still loads by slug.
* Dynamic content is safer.
* Buttons align with MurphOS.
* Empty/loading states are improved.
* No commerce behavior is broken.

Priority:

**P1**

---

# Phase 10: About Page Editorial Pass

## Goal

Preserve Brett’s voice while making the About page more editorial and easier to scan.

## Tasks

1. Reduce dense copy.
2. Keep small-business personality.
3. Keep Marine/baseball background.
4. Replace overbroad restoration language.
5. Move inline styles to CSS.
6. Consider editorial layout instead of heavy card layout.
7. Add a clear CTA.

## Files

* `about/index.html`
* `assets/css/styles-16.css`

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 10 only.

Refine the About page into a more editorial MurphOS layout while preserving Brett’s personality, Marine background, baseball connection, and small-business voice. Reduce dense copy, remove inline styles where practical, replace overbroad restoration language, and add a clear CTA.

Do not make the page corporate. Keep it human. Summarize copy changes.
```

## Definition of Done

* About feels cleaner and more readable.
* Brett’s voice remains.
* Inline styling is reduced.
* CTA is clear.
* Page is not sterilized into corporate sadness.

Priority:

**P2**

---

# Phase 11: SEO, Metadata, and Asset Polish

## Goal

Align metadata and supporting assets with MurphOS.

## Tasks

1. Update default meta description.
2. Update page descriptions that overuse restoration.
3. Verify social preview image exists.
4. If missing, add or point to a real image.
5. Fix page titles.
6. Standardize local and mail-in service language.
7. Keep SEO value for relacing and glove care.
8. Do not keyword-stuff.

## Files

* `_layouts/default.html`
* public page front matter
* assets image folder if social preview is added

## Recommended Default Description

```text
Professional baseball and softball glove relacing, cleaning, conditioning, and care. Local drop-off in Surf City, NC and nationwide mail-in service.
```

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 11 only.

Audit and update public site metadata to match MurphOS. Replace overbroad restoration-heavy descriptions with accurate relacing, cleaning, conditioning, and glove care language. Fix page title typos. Verify whether the referenced social preview image exists. If it does not, either point metadata to an existing appropriate image or report what asset is needed.

Do not keyword-stuff. Preserve local and mail-in SEO value. Summarize every metadata change.
```

## Definition of Done

* Metadata is accurate.
* Social preview image path is valid or flagged.
* Titles are typo-free.
* SEO remains useful.
* Brand language stays honest.

Priority:

**P1**

---

# Phase 12: Final Cleanup and Testing

## Goal

Remove leftover code, test the public experience, and prepare for deployment.

## Tasks

1. Remove stale iframe CSS if no longer used.
2. Remove old implementation comments.
3. Remove unused CSS where safe.
4. Remove unused JavaScript where safe.
5. Confirm mobile menu works.
6. Confirm contact form works.
7. Confirm conditional shipping fields work.
8. Confirm gallery loads.
9. Confirm lightbox works on desktop and mobile.
10. Confirm lace inventory loads.
11. Confirm For Sale listings load.
12. Confirm footer legal links work.
13. Confirm accessibility basics.
14. Confirm no secrets are committed.
15. Confirm no console errors on public pages.

## Files

* All public files as needed.

## Example Codex Prompt

```text
Read `.docs/murphos/99_CODEX_EXECUTION.md`, then perform Phase 12 only.

Do a final cleanup pass after the MurphOS redesign phases. Remove stale CSS/JS only when safe, especially unused iframe styles and old implementation comments. Do not remove anything used by admin tools or public functionality unless verified.

Then provide a testing checklist with pass/fail notes for: mobile menu, contact form, conditional shipping fields, gallery loading, lightbox, lace inventory, For Sale listings, footer legal links, console errors, and secret file hygiene.
```

## Definition of Done

* Public site works.
* No obvious stale styles remain.
* No known console errors.
* No secret files tracked.
* Major workflows pass testing.
* Site is ready for deploy review.

Priority:

**P1**

---

# Commit Strategy

Use small commits.

Each phase should be one commit or a small set of related commits.

Do not combine unrelated changes.

Good commit examples:

```text
chore: remove Supabase env file from tracking
style: add MurphOS design tokens
style: update button and font foundation
refactor: align header and footer with MurphOS
refactor: rebuild services lace swatches
refactor: improve service request form styling
copy: align public site language with MurphOS
fix: unify gallery lightbox behavior
```

Bad commit examples:

```text
update stuff
fix site
changes
murphos
misc
```

Bad commit messages are the junk drawer of software history.

---

# Testing Checklist

Run through this after each major phase.

## Global

* Site loads without blank screen.
* Header appears correctly.
* Mobile menu opens.
* Mobile menu closes.
* Navigation links work.
* Footer links work.
* Legal links work.
* No obvious console errors.

## Home

* Hero displays correctly.
* Buttons work.
* Gallery preview loads.
* Lightbox works.
* Reviews display.
* Mobile layout is readable.

## Services

* Services content displays.
* Lace colors display.
* Lace inventory loads.
* Out-of-stock state works.
* Lace labels are visible.
* Anchor links work.
* CTAs work.

## Process

* Steps are readable.
* Shipping/local explanation is clear.
* CTAs work.
* Mobile layout is readable.

## Gallery

* Categories load.
* Empty states work.
* Images lazy-load.
* Lightbox opens.
* Lightbox closes.
* Next/previous works.
* Mobile gestures do not glitch.

## Contact

* Question tab opens.
* Service Request tab opens.
* Required validation works.
* Local drop-off path works.
* Shipped path shows shipping fields.
* Form submits to `/api/intake`.
* Success state appears.
* SMS opt-in remains visible.
* No customer data is lost unexpectedly.

## For Sale

* Listing grid loads.
* Sold badge works.
* Hover image works.
* Detail page opens.
* Gallery works.
* Purchase/contact action works.
* Empty state works.

## Accessibility Basics

* Text contrast is readable.
* Buttons are keyboard focusable.
* Links are understandable.
* Important status does not rely only on color.
* Form labels are visible.
* Lace swatches have visible labels.
* Images have useful alt text where practical.

## Security / Repo Hygiene

* No `.env` files are tracked.
* `supabase.env` is ignored.
* No service-role keys are in client files.
* No Cloudflare tokens are committed.
* No Twilio secrets are committed.

---

# What Codex Should Not Do

Codex should not:

* Redesign the full site in one prompt.
* Invent a new color palette.
* Invent new fonts.
* Use Montserrat Condensed as a primary font.
* Use red as the default CTA color.
* Remove Brett’s personality.
* Replace native service request with Google Forms.
* Break `/api/intake`.
* Break `/api/lace-inventory`.
* Break gallery loading.
* Break For Sale.
* Modify admin files during public-site phases.
* Expose secrets.
* Add dependencies unless approved.
* Add a framework.
* Create new pages unless instructed.
* Make broad “cleanup” changes without explaining them.
* Remove working code because it “looks unused” without verifying.

Codex should behave like a careful craftsman.

Not like a Roomba with commit access.

---

# Review Rules

After each phase, Codex should report:

1. Files changed.
2. What changed.
3. Why it changed.
4. What was intentionally not changed.
5. What should be tested.
6. Any risks or follow-up items.

Do not accept vague summaries.

A good summary says:

```text
Updated `.btn-primary` from red to navy, added `.btn-danger`, changed body font to system stack, preserved Montserrat for nav/buttons, and added compatibility aliases for old variables.
```

A bad summary says:

```text
Updated styling.
```

That tells us nothing, which is traditionally not ideal.

---

# Definition of Done for the Full MurphOS Redesign

The MurphOS public-site redesign is complete when:

* No sensitive env files are tracked.
* Global CSS uses MurphOS tokens.
* Body/UI text uses system font stack.
* Montserrat is reserved for brand moments.
* Red is no longer the default CTA color.
* `#dacab1` is no longer the full-page background.
* Cards are used intentionally, not everywhere.
* Header and footer are refined.
* Services page is clear and typo-free.
* Lace colors are visible, consistent, and treated as decision support.
* Service request form is native, styled, and clear.
* Contact form still works.
* Conditional shipping fields still work.
* Gallery and lightbox behavior are unified.
* Process page answers how customers get the glove to Brett.
* Overbroad restoration language is cleaned up.
* Metadata is accurate.
* Footer legal links work.
* For Sale still works.
* Mobile experience is clean.
* Accessibility basics are covered.
* No major console errors remain.
* The site feels calmer, lighter, clearer, and more intentional.

Most importantly:

The glove feels more important.

The interface feels quieter.

The customer feels more confident.

That is MurphOS.

---

# Final Instruction to Codex

When in doubt, choose the smaller, safer change.

Follow the MurphOS documents.

Preserve working behavior.

Make every change reviewable.

Do not freestyle design.

Do not invent new systems.

Do not turn the site corporate.

Do not make the customer think harder than necessary.

Execute the system.

That is the job.
