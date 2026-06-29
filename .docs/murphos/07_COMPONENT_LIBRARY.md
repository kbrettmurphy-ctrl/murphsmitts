# MurphOS Component Library

**Version:** 1.0
**Status:** Draft
**Last Updated:** June 2026

---

# Why This Exists

The MurphOS Component Library defines the reusable interface pieces used across Murph's Mitts.

The Design System defines the visual rules.

The Component Library defines how those rules become actual interface patterns.

Components should make the site and admin tools easier to build, easier to maintain, and easier to improve without reinventing the same button, card, form field, or status badge every time something changes.

MurphOS should feel consistent because the same approved components are reused with purpose.

Not copied randomly.

Not redesigned every week.

Not improvised by whatever CSS mood happens to be passing through the room.

---

# Component Philosophy

## Reuse Before Inventing

Before creating a new component, check whether an existing component can solve the problem.

New components should only be created when an existing pattern does not fit the need.

Every new component adds maintenance.

Every unnecessary variation adds visual noise.

Consistency is part of trust.

---

## Components Should Reduce Friction

A component exists to help the user understand something or do something.

Every component should support at least one of these goals:

* Reduce friction.
* Build trust.
* Showcase craftsmanship.
* Support a customer decision.
* Improve admin speed.
* Clarify status.
* Make the next step obvious.

If a component does none of those things, it probably does not need to exist.

---

## Quiet by Default

MurphOS components should be visually quiet unless the situation demands emphasis.

A component should not compete with the glove, the task, or the next step.

Most components should feel calm, structured, and intentional.

The louder a component is, the stronger the reason should be.

---

## Customer-Facing and Admin Components Have Different Jobs

Customer-facing components should feel:

* Calm.
* Premium.
* Warm.
* Spacious.
* Trust-building.
* Easy to scan.

Admin components should feel:

* Fast.
* Dense when useful.
* Clear.
* Efficient.
* Designed for repeated use.

Both should feel like MurphOS.

They should not feel like two different products duct-taped together because, tragically, that is how many software products are born.

---

# Global Component Rules

All components should follow these rules unless there is a specific reason not to.

## Visual Rules

* Use MurphOS color tokens.
* Use MurphOS spacing tokens.
* Use MurphOS radius tokens.
* Use approved typography roles.
* Avoid one-off colors.
* Avoid one-off spacing.
* Avoid unnecessary shadows.
* Avoid heavy borders.
* Avoid oversized typography.
* Avoid loud red unless the action is destructive, urgent, or clearly important.

---

## Interaction Rules

Interactive components should:

* Have clear hover states.
* Have clear focus states.
* Have clear active or selected states when needed.
* Be usable on mobile.
* Have comfortable tap targets.
* Respond quickly.
* Communicate what happened after interaction.

No dead clicks.

No mystery states.

No “did that work?” moments.

The customer already has enough uncertainty in life, like youth baseball strike zones.

---

## Accessibility Rules

Components should:

* Use readable contrast.
* Avoid relying only on color.
* Support keyboard focus when interactive.
* Use clear labels.
* Use semantic structure when possible.
* Keep tap targets at least 44px when practical.
* Provide useful alt text for meaningful images.

Accessibility is not an add-on.

It is part of the component.

---

# Component Inventory

MurphOS includes the following approved component categories:

## Global Components

* Header
* Footer
* Navigation
* Buttons
* Text links
* Section containers
* Content blocks
* Cards
* Badges
* Dividers
* Media blocks
* Modals
* Lightbox
* Loading states
* Empty states
* Error states

## Customer-Facing Components

* Hero section
* Service block
* Process step
* Lace color swatch
* Lace color grid
* Gallery grid
* Before and after block
* Testimonial
* Call-to-action section
* FAQ item
* Contact block
* Form section
* Form field
* Service request form
* For-sale glove card
* For-sale detail gallery

## Admin Components

* Admin shell
* Admin section header
* Order list card
* Order detail panel
* Status badge
* Paid status indicator
* Workflow action group
* Map pin card
* Inventory item
* Inventory alert
* Photo uploader
* Gallery upload item
* Modal confirmation
* Admin filter bar

---

# Global Components

---

# Header

The header provides consistent orientation and access to primary navigation.

It should feel calm, clean, and stable.

## Purpose

The header helps users understand where they are and how to move through the site.

It should not dominate the page.

## Usage

Use the header on all public pages.

The header may visually adapt on the home page hero when needed, but behavior should remain predictable.

## Content

The header may include:

* Logo.
* Primary navigation.
* Contact or service request link if needed.
* Mobile menu trigger.

## Rules

* Keep navigation labels short.
* Keep spacing generous.
* Keep active state clear but quiet.
* Avoid oversized header height.
* Avoid too many links.
* Avoid making Contact visually disconnected from the rest of the menu.
* Do not let the header compete with hero imagery.

## States

The header may have:

* Default state.
* Home hero overlay state.
* Scrolled state.
* Mobile menu state.

The transition between states should feel smooth and subtle.

---

# Footer

The footer provides closure, secondary navigation, and trust information.

It should feel grounded and simple.

## Purpose

The footer helps customers find important secondary information without cluttering the main navigation.

## Content

The footer may include:

* Business name.
* Copyright.
* Contact email.
* Social links.
* Service area reference.
* Privacy and terms links.
* Veteran-owned mark or similar trust cue if used carefully.

## Rules

* Keep it simple.
* Avoid turning the footer into a junk drawer.
* Use navy or dark treatment when appropriate.
* Keep text readable.
* Keep links clear.

The footer should feel like the bottom of a well-built page, not the place where forgotten links go to die.

---

# Navigation

Navigation components guide users through the experience.

## Purpose

Navigation should make movement obvious without demanding attention.

## Types

MurphOS may use:

* Primary nav.
* Mobile nav.
* Footer nav.
* Anchor links.
* Admin section nav.
* Filter nav.

## Rules

* Use clear labels.
* Avoid clever navigation names.
* Show active state.
* Keep mobile navigation easy to open and close.
* Do not rely on anchor links as the only way to surface important decision-support content.

Anchor links are useful.

They are not a substitute for placing information where the customer needs it.

---

# Buttons

Buttons are used for clear actions.

They should invite action without shouting.

## Button Types

### Primary Button

Use for the main action.

Examples:

* Start a Service Request
* Submit Request
* Save Changes
* Continue

Rules:

* One primary action per section when possible.
* Use navy background.
* Use cream text.
* Keep size calm.
* Avoid red for normal primary actions.

---

### Secondary Button

Use for supporting actions.

Examples:

* View Gallery
* Learn More
* Contact Me
* Cancel

Rules:

* Use outline or quiet surface treatment.
* Keep visual weight below the primary action.
* Do not make secondary buttons compete with primary buttons.

---

### Text Button / Text Link

Use for quiet actions.

Examples:

* View available lace colors
* Read FAQ
* Open in Apple Maps
* View details

Rules:

* Use when a full button would be too heavy.
* Make it clearly tappable or clickable.
* Do not hide important actions as vague text.

---

### Destructive Button

Use only for destructive actions.

Examples:

* Delete Order
* Remove Photo
* Delete Listing

Rules:

* Use red carefully.
* Confirm destructive actions when appropriate.
* Do not use red for ordinary calls to action.

---

# Cards

Cards group related information.

They should be used intentionally, not automatically.

## Purpose

Cards help users scan contained items or compare related options.

## Good Uses

Use cards for:

* Service pricing blocks.
* Testimonials.
* For-sale glove listings.
* Gallery items.
* Order list items.
* Form sections.
* Important callouts.
* Choice groups.

## Avoid Cards For

Avoid cards for:

* Every section.
* Simple text.
* Basic page content.
* Anything that can be handled with spacing.
* Decorative framing.

## Card Style

Cards should be:

* Light.
* Calm.
* Softly rounded.
* Lightly bordered.
* Rarely shadowed.
* Spacious enough to breathe.

## Rules

* Do not nest cards unless necessary.
* Avoid heavy shadows.
* Avoid loud borders.
* Avoid making every card visually equal when one item matters more.

Cards are tools.

Not wallpaper.

---

# Badges

Badges communicate short status or category information.

## Purpose

Badges make status scannable.

## Usage

Use badges for:

* Order status.
* Paid status.
* In stock / low stock / out of stock.
* Featured listings.
* Sold listings.
* Service labels.
* Admin filters.

## Rules

* Keep badge text short.
* Use consistent colors.
* Do not rely on color alone.
* Avoid badge overload.
* Use red only for warning, destructive, or urgent states.

## Examples

Good badge labels:

* Received
* In Progress
* Ready to Go
* Paid
* Unpaid
* In Stock
* Low
* Out
* Sold

Bad badge labels:

* This one is super important
* Customer probably needs contacted maybe
* Payment situation unclear
* Big yikes

Apparently badges should not become tiny novels. Tragic.

---

# Dividers

Dividers separate content when spacing alone is not enough.

## Rules

* Use lightly.
* Use thin borders.
* Prefer whitespace first.
* Avoid stacking dividers with cards and shadows unless absolutely needed.

A divider should clarify structure.

It should not decorate the page.

---

# Media Block

A media block pairs image or video with supporting text.

## Purpose

Media blocks help tell the story visually while keeping copy clear.

## Good Uses

Use media blocks for:

* Home page feature sections.
* Services explanation.
* Process explanation.
* About page storytelling.
* Before and after presentation.

## Rules

* Let the image carry visual weight.
* Keep text concise.
* Avoid overcrowding.
* Use consistent image radius.
* Avoid random image sizes.
* On mobile, stack image and text cleanly.

---

# Modal

A modal interrupts the current view for focused information or action.

## Purpose

Use modals only when the user needs to complete or confirm something without losing context.

## Good Uses

Use modals for:

* Confirm delete.
* View larger photo.
* Edit compact details.
* Show focused map/order info.
* Mobile-friendly temporary actions.

## Rules

* Keep modals focused.
* Make close action obvious.
* Do not use modals for normal page content.
* Avoid long scrolling modals when a page would work better.
* Confirm destructive actions.
* Return the user to their previous context.

Modals are interruptions.

Use them like interruptions, not as a lifestyle.

---

# Lightbox

A lightbox displays photos at larger size.

## Purpose

The lightbox helps users inspect glove photos without leaving the page.

## Rules

* Tap or click outside to close.
* Provide obvious close control.
* Support next and previous navigation.
* Prevent accidental photo changes while zooming.
* Preserve zoom state only when it helps.
* Avoid glitchy gestures.
* Keep controls minimal and clear.
* Make mobile behavior feel native.

The lightbox should feel like viewing photos, not wrestling a raccoon through a touchscreen.

---

# Loading State

Loading states communicate that work is happening.

## Purpose

They prevent uncertainty.

## Rules

* Show loading feedback quickly.
* Use calm language.
* Avoid overly playful loading copy.
* Avoid leaving blank areas with no explanation.
* Use skeletons or subtle spinners where useful.
* Do not use loading states to hide unnecessary slowness.

Good loading copy:

* Loading orders…
* Uploading photos…
* Saving changes…
* Loading lace colors…

Bad loading copy:

* Please wait while magic happens.
* Doing stuff.
* Hang tight, champ.

---

# Empty State

Empty states explain why nothing is shown and what the user can do next.

## Purpose

They turn absence into guidance.

## Rules

* Keep copy short.
* Explain the empty state.
* Provide a next action when useful.
* Avoid making empty states feel broken.

Examples:

* No gloves are available right now.
* No matching orders found.
* No photos have been uploaded yet.
* No lace colors are marked low.

---

# Error State

Error states explain what went wrong and what to do next.

## Purpose

Errors should reduce panic and help recovery.

## Rules

* Use plain language.
* Do not blame the user.
* Do not expose technical detail unless useful for admin.
* Say whether the action completed.
* Provide a retry path when possible.

Examples:

* Something went wrong while submitting your request. Please try again.
* Photos could not be uploaded. Try again or select fewer files.
* This order could not be saved. Your changes may not have been applied.

---

# Customer-Facing Components

---

# Hero Section

The hero section introduces a page.

It should create immediate orientation and trust.

## Purpose

The hero tells the customer what the page is about and what matters most.

## Content

A hero may include:

* Short eyebrow label.
* Strong headline.
* Brief supporting text.
* One primary action.
* One secondary action if needed.
* Hero image or video.

## Rules

* Keep copy short.
* Use one clear focal point.
* Avoid too many CTAs.
* Avoid huge type that competes with imagery.
* Avoid busy text over busy images.
* Use photography intentionally.

## Good Hero Behavior

The customer should understand the page in a few seconds.

No scavenger hunt.

No dramatic marketing fog machine.

---

# Section Container

A section container gives structure to page content.

## Purpose

It creates consistent spacing, width, and rhythm.

## Rules

* Use consistent max-widths.
* Use generous vertical spacing.
* Avoid placing every section inside a card.
* Use background shifts sparingly.
* Keep each section focused on one idea.

## Types

MurphOS may use:

* Standard section.
* Narrow reading section.
* Wide media section.
* Soft background section.
* CTA section.

---

# Service Block

A service block explains a specific service.

## Purpose

It helps customers understand what a service does and whether they need it.

## Content

A service block may include:

* Service title.
* Short description.
* Starting price or pricing note.
* What it includes.
* Related image.
* CTA.
* Supporting link.

## Rules

* Keep service language honest.
* Avoid overpromising.
* Use photos only when helpful.
* Surface related decision-support content nearby.

For relacing, lace colors should be close by.

Not buried three scrolls later like a tax deduction nobody remembers.

---

# Process Step

A process step explains how the order process works.

## Purpose

It reduces uncertainty.

## Content

A process step may include:

* Step number.
* Short title.
* Brief explanation.
* Optional icon or image.
* Related action.

## Rules

* Keep steps short.
* Use consistent structure.
* Avoid too many steps.
* Make the next action clear.
* Use plain language.

Good process steps help the customer think:

“I know what happens next.”

That is the whole job.

---

# Lace Color Swatch

A lace color swatch shows one available or requestable lace color.

## Purpose

It helps customers choose lace confidently.

This is a decision-support component, not decoration.

## Content

A swatch should include:

* Lace photo or accurate color representation.
* Color name.
* Availability status when useful.
* Optional low stock or out of stock note.

## Rules

* Use consistent image crop.
* Use consistent lighting.
* Use consistent labels.
* Do not rely on color alone.
* Do not mix overlay labels with below-image labels randomly.
* Show availability clearly.
* Keep swatches easy to compare.
* Make selected state obvious when used in a form.

## States

A lace swatch may have:

* Default.
* Hover.
* Focus.
* Selected.
* Low stock.
* Out of stock.
* Disabled.
* Special order available.

## Selected State

Selected swatches should use a clear border or ring.

The state should be obvious without becoming visually loud.

## Unavailable State

Unavailable swatches may remain visible if the customer can still request the color.

Unavailable status should be clear.

Do not hide useful options unless they truly should not be requested.

---

# Lace Color Grid

A lace color grid displays multiple lace swatches together.

## Purpose

It helps customers scan and compare lace color options.

## Usage

Use the lace color grid:

* Near relacing service content.
* In the service request flow.
* In a dedicated lace color section.
* Anywhere customers choose primary or secondary lace.

## Rules

* Prefer grid layout on desktop.
* Use clean horizontal scrolling only when space requires it.
* Make overflow obvious if scrolling is used.
* Keep labels visible.
* Keep photos consistent.
* Avoid burying the grid below unrelated content.
* Keep the grid close to the decision it supports.

The existing `/services/#lace-colors` anchor is useful.

The grid still needs to appear where the customer naturally needs it.

Both can be true.

Humanity survives nuance.

---

# Gallery Grid

The gallery grid displays completed work.

## Purpose

It provides proof of craftsmanship.

## Content

Gallery items may include:

* Image.
* Category.
* Optional glove type.
* Optional short caption.
* Optional before and after connection.

## Rules

* Curate the gallery.
* Use consistent crops.
* Use strong images.
* Avoid filler.
* Avoid blurry or poorly lit photos.
* Keep the grid visually calm.
* Do not overload each item with text.

The gallery should feel like proof.

Not storage.

---

# Before & After Block

A before and after block shows transformation.

## Purpose

It helps customers understand the difference Murph's Mitts can make.

## Content

A before and after block may include:

* Before image.
* After image.
* Short caption.
* Service performed.
* Optional glove details.

## Rules

* Use similar angles and lighting.
* Avoid misleading edits.
* Keep labels clear.
* Do not exaggerate the transformation.
* Let the work speak.

Before and after blocks should build trust, not feel like an infomercial with better lighting.

---

# Testimonial

A testimonial displays customer feedback.

## Purpose

It builds trust through customer proof.

## Content

A testimonial may include:

* Quote.
* Customer name.
* Location.
* Source.
* Service context if helpful.

## Rules

* Keep quotes readable.
* Avoid giant testimonial cards.
* Do not overcrowd the page.
* Use verified reviews when possible.
* Keep formatting consistent.
* Avoid presenting too many at once.

Testimonials should support the page.

They should not hijack it.

---

# Call-to-Action Section

A CTA section guides the customer toward the next step.

## Purpose

It answers, “What should I do now?”

## Content

A CTA section may include:

* Short headline.
* Brief supporting text.
* Primary button.
* Secondary link or button if needed.

## Rules

* One clear action.
* Keep copy short.
* Avoid urgency gimmicks.
* Avoid red unless the action is urgent or special.
* Use generous whitespace.
* Place CTAs after useful context.

Good CTA:

* Start a Service Request

Bad CTA:

* Order Now Before It’s Too Late!!!

The glove is not a midnight mattress sale.

---

# FAQ Item

An FAQ item answers common customer questions.

## Purpose

It reduces repeated questions and customer uncertainty.

## Content

An FAQ item includes:

* Question.
* Short answer.
* Optional related link.

## Rules

* Use real customer questions.
* Keep answers short.
* Link to deeper info when needed.
* Avoid stuffing entire service pages into accordions.
* Use plain language.

Good FAQ topics:

* How do I get the glove to you?
* How long does it take?
* Can you relace only part of the glove?
* Will my glove look new?
* What lace colors are available?
* Do you work on catcher's mitts?

---

# Contact Block

A contact block gives customers a clear way to reach Murph's Mitts.

## Purpose

It reduces uncertainty when customers need help.

## Content

A contact block may include:

* Email.
* Phone or SMS availability if used.
* Contact form link.
* Service area note.
* Response time expectation.

## Rules

* Keep it simple.
* Do not hide contact info.
* Avoid making contact feel like customer support bureaucracy.
* Provide context for when to use the contact path.

Contact should feel like reaching Brett.

Not opening a ticket in the sadness machine.

---

# Form Section

A form section groups related fields.

## Purpose

It makes forms easier to understand and complete.

## Good Form Sections

* Contact Information
* Glove Information
* Services Requested
* Lace Colors
* Drop-Off or Shipping
* Notes
* Review and Submit

## Rules

* Group related fields.
* Use short explanatory text.
* Avoid too many fields in one visual chunk.
* Show conditional fields only when relevant.
* Keep sections visually calm.

---

# Form Field

A form field collects one piece of information.

## Purpose

It should make the requested input obvious.

## Content

A field may include:

* Label.
* Input.
* Helper text.
* Error message.
* Required indicator when needed.

## Rules

* Always use visible labels.
* Do not rely on placeholder text alone.
* Keep helper text short.
* Use clear error messages.
* Use proper keyboard types on mobile when applicable.
* Do not ask for the same information twice.

---

# Service Request Form

The service request form is one of the most important customer-facing components.

## Purpose

It collects the information needed to start a glove service request without overwhelming the customer.

## Rules

* Make the form feel guided.
* Keep sections clear.
* Show only relevant shipping/local fields.
* Use lace swatches when possible.
* Confirm what happens after submission.
* Avoid unnecessary required fields.
* Provide clear success and error states.

## Success State

After submission, the customer should understand:

* The request was received.
* What happens next.
* Whether photos are needed.
* Whether an estimate will follow.
* Whether any action is required.

A form success state should not simply say:

“Submitted.”

That is technically information, in the same way a rock is technically furniture.

---

# For-Sale Glove Card

A for-sale glove card displays a glove available for purchase.

## Purpose

It helps customers quickly evaluate a listing.

## Content

A card may include:

* Primary photo.
* Hover photo.
* Title.
* Price.
* Short description.
* Status badge.
* Key specs if useful.

## Rules

* Use strong primary image.
* Keep text short.
* Make sold status clear.
* Do not hide price.
* Use consistent card layout.
* Avoid cluttering cards with every spec.

The card should create interest.

The detail page can provide depth.

---

# For-Sale Detail Gallery

The for-sale detail gallery displays listing photos.

## Purpose

It helps customers inspect the glove before buying.

## Rules

* Show full front and back views.
* Show pocket, web, palm, heel, lace, and wear.
* Keep image order logical.
* Make notable flaws visible.
* Use consistent lightbox behavior.
* Avoid over-editing.

For-sale photos should reduce mystery.

Mystery belongs in murder shows, not glove listings.

---

# Admin Components

---

# Admin Shell

The admin shell provides the structure for internal tools.

## Purpose

It supports fast, repeated work.

## Content

The admin shell may include:

* Section navigation.
* Orders view.
* Inventory view.
* Upload view.
* Admin actions.
* Modals.
* Filters.

## Rules

* Prioritize speed.
* Keep important tools easy to reach.
* Avoid decorative UI.
* Use dense layouts when density improves work.
* Keep mobile usable, even if desktop is the primary work mode.

---

# Admin Section Header

A section header orients the admin user within a tool.

## Purpose

It quickly explains the current view and key actions.

## Content

May include:

* Section title.
* Count or status summary.
* Primary admin action.
* Filter controls.

## Rules

* Keep title clear.
* Keep actions close to the section they affect.
* Avoid large decorative headings.
* Use compact spacing when appropriate.

---

# Admin Filter Bar

A filter bar lets the admin narrow or switch views.

## Purpose

It helps manage orders, inventory, uploads, or gallery items quickly.

## Rules

* Use clear labels.
* Show active filter.
* Keep filters tappable on mobile.
* Avoid hiding common filters.
* Do not overload the bar with rarely used options.

Examples:

* Current
* Estimate Sent
* In Progress
* Waiting on Lace/Parts
* Ready to Go
* Completed
* Need to Order

---

# Order List Card

An order list card summarizes one order in the admin portal.

## Purpose

It helps the admin scan and act on orders quickly.

## Content

An order card may include:

* Color chip or lace indicator.
* Customer name.
* Order number.
* Status badge.
* Paid status.
* Quick actions.
* Date or timing indicator when useful.

## Rules

* Keep the customer name prominent.
* Keep order number easy to find.
* Keep status visible.
* Keep quick actions consistent.
* Avoid crowding.
* Preserve mobile readability.
* Use paid color carefully and consistently.
* Do not bury the key order identity.

Preferred structure:

* Row 1 left: color chip and customer name.
* Row 1 right: order status.
* Row 2 left: order number and payment indicator.
* Row 2 right: quick actions.

This layout supports scanning without turning every order into a spreadsheet cosplay event.

---

# Order Detail Panel

The order detail panel displays complete order information.

## Purpose

It gives the admin everything needed to understand and manage an order.

## Content

May include:

* Customer name.
* Order number.
* Status.
* Contact information.
* Address.
* Drop-off/shipping method.
* Services requested.
* Lace colors.
* Photos.
* Notes.
* Pricing.
* Paid status.
* Timeline.
* Workflow actions.

## Rules

* Use the customer name as the title.
* Keep order number near the name.
* Make address clickable when present.
* Show lace colors visually.
* Keep actions grouped.
* Keep internal notes visually distinct.
* Avoid unnecessary edit modes.
* Do not make the admin hunt for core order facts.

---

# Workflow Action Group

Workflow actions move an order through status or trigger communication.

## Purpose

They reduce repeated work.

## Examples

* Mark Estimate Sent
* Mark In Progress
* Mark Waiting on Lace/Parts
* Mark Ready to Go
* Mark Completed
* Send Email
* Send SMS
* Mark Paid

## Rules

* Group related actions.
* Make destructive or irreversible actions clear.
* Avoid visually equal treatment for every action if one is primary.
* Confirm actions when needed.
* Provide feedback after action.
* Do not make the admin click through unnecessary steps.

Workflow actions exist because Brett has gloves to work on, not because the interface needs more ceremonies.

---

# Status Badge

A status badge shows current order or inventory state.

## Purpose

It makes state scannable.

## Order Status Examples

* Received
* Estimate Sent
* Pending Response
* In Transit to Me
* In Progress
* Waiting on Lace/Parts
* Ready to Go
* On Hold
* Completed
* Picked Up

## Rules

* Keep status labels consistent.
* Use exact approved status names.
* Avoid creating duplicate near-identical statuses.
* Use color to support, not replace, text.
* Keep badge size compact.

---

# Paid Status Indicator

A paid status indicator shows payment state.

## Purpose

It helps avoid fulfillment mistakes.

## States

* Paid
* Unpaid
* Partial or pending if used later.

## Rules

* Make paid status visible in order list and order detail.
* Keep color consistent.
* Do not rely only on color.
* Keep text short.

Payment status should be unmistakable.

Shipping unpaid gloves because a UI hid the answer would be peak “we designed this in a hurry” nonsense.

---

# Map Pin Card

A map pin card shows order information from a map marker.

## Purpose

It helps the admin connect location and order context quickly.

## Content

May include:

* Customer name.
* Order number.
* Address.
* Status.
* View order action.

## Rules

* Keep it compact.
* Make View Order clear but not oversized.
* Do not use two visually equal buttons if they are not equally important.
* Avoid cluttering the card with secondary information.
* The card should support location awareness, not become a tiny order detail page.

---

# Inventory Item

An inventory item shows lace inventory information.

## Purpose

It helps track lace availability and reorder needs.

## Content

May include:

* Lace color name.
* Quantity on hand.
* Reorder threshold.
* Reorder quantity.
* Supplier code.
* Status badge.
* Quick update action.

## Rules

* Make low and out-of-stock states clear.
* Keep quantity easy to scan.
* Use consistent color names.
* Avoid hiding inactive colors unless intentionally filtered.
* Keep reorder actions close to inventory status.

---

# Inventory Alert

An inventory alert shows lace colors that need attention.

## Purpose

It prevents stock issues.

## Content

May include:

* Color name.
* Current quantity.
* Reorder quantity.
* Status.
* Link to inventory.

## Rules

* Show only meaningful alerts.
* Distinguish low from out.
* Avoid alert fatigue.
* Keep actions clear.

Alerts should be useful.

Not a tiny panic parade.

---

# Photo Uploader

The photo uploader handles image uploads.

## Purpose

It lets the admin add order photos, gallery photos, or for-sale glove photos.

## Rules

* Do not auto-upload immediately on file selection unless specifically intended.
* Show selected files before upload.
* Provide an explicit Upload button.
* Show progress.
* Show success and failure states.
* Support multiple files when appropriate.
* Keep failed uploads clear and retryable.
* Avoid losing selected files without warning.

The user should feel in control.

Selecting a file should not feel like accidentally launching a missile.

---

# Gallery Upload Item

A gallery upload item represents one selected or uploaded photo.

## Purpose

It helps the admin review uploads before and after submission.

## Content

May include:

* Thumbnail.
* File name if useful.
* Category.
* Upload status.
* Error message.
* Remove action.

## Rules

* Keep thumbnails readable.
* Do not show unnecessary file clutter publicly.
* Use file names mainly for admin clarity.
* Show failed status clearly.

---

# Confirmation Modal

A confirmation modal verifies high-impact actions.

## Purpose

It prevents accidental destructive or major changes.

## Use For

* Delete order.
* Delete photo.
* Delete for-sale listing.
* Send important communication.
* Mark major workflow status if needed.

## Rules

* State what will happen.
* Use clear confirm and cancel actions.
* Make destructive confirmation visually distinct.
* Do not overuse confirmation for harmless actions.

Too many confirmations train people to ignore them.

Humanity once again ruins a decent safety mechanism.

---

# Responsive Component Rules

Components must work across screen sizes.

## Mobile

On mobile:

* Stack layouts when needed.
* Use comfortable tap targets.
* Avoid cramped buttons.
* Keep forms simple.
* Avoid hidden critical information.
* Make horizontal scrolling obvious if used.
* Keep modals usable.
* Keep image controls natural.

## Desktop

On desktop:

* Use space intentionally.
* Avoid stretching content too wide.
* Prefer grids when comparison matters.
* Keep important actions visible.
* Avoid filling space just because it exists.

---

# Component Naming Guidance

Component names should be clear and boring.

Boring names are good.

Boring names make maintenance easier.

Suggested naming style:

```text
mm-button
mm-card
mm-badge
mm-section
mm-hero
mm-service-block
mm-lace-swatch
mm-lace-grid
mm-gallery-grid
mm-form-section
mm-order-card
mm-status-badge
mm-map-pin-card
```

Names should describe what the component is.

Avoid clever class names.

Nobody wants to debug `.glove-magic-super-box` six months from now.

---

# Component Creation Checklist

Before creating a new component, ask:

1. Does an approved component already solve this?
2. Is this pattern likely to be reused?
3. Does this reduce friction?
4. Does this build trust?
5. Does this support a customer decision?
6. Does this improve admin speed?
7. Does it follow MurphOS color, spacing, radius, and typography rules?
8. Is it accessible?
9. Does it work on mobile?
10. Can it be simpler?

If the answer to most of these is no, do not create a new component.

Use an existing one.

---

# Do / Don't Rules

## Do

* Reuse approved components.
* Keep components visually quiet.
* Make actions obvious.
* Keep status visible.
* Use consistent labels.
* Use consistent spacing.
* Use visual choice components when options are visual.
* Surface decision-support content where it is needed.
* Design customer components for trust.
* Design admin components for speed.

## Don't

* Invent one-off button styles.
* Turn every section into a card.
* Hide important options at the bottom of unrelated pages.
* Use red as a normal action color.
* Use icons without purpose.
* Create components with unclear names.
* Make components louder than the content.
* Force users to remember information from another page.
* Add confirmation modals to harmless actions.
* Build components that only work on desktop.

---

# Implementation Note

This document defines the approved MurphOS component patterns.

Actual HTML, CSS, and JavaScript should implement these components according to the MurphOS Design System and Human Interface Guidelines.

When Codex or a developer changes the site, they should reuse these patterns before creating new ones.

If a new component is needed, it should be added to this library so the system stays organized.

A component that exists only in code but not in the library is a warning sign.

That is how design systems slowly become archaeology.

---

# The Standard

MurphOS components should feel calm, useful, and intentional.

They should help customers trust the process.

They should help Brett work faster.

They should make the site and admin tools feel like one connected system.

Every component should earn its place.

Every component should reduce friction, build trust, showcase craftsmanship, support a decision, or improve workflow.

That is the MurphOS Component Library standard.
