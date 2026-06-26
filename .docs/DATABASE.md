# Database

## Overview

The application uses Supabase as its primary database and storage backend. The code makes direct REST requests to Supabase tables and storage endpoints. The repository does not include a migration directory, but a SQL schema summary from Supabase has been added below.

The column type annotations below are inferred from live Supabase row samples and the Supabase schema export.

## Tables and collections referenced by the code

### orders
The main transactional table for glove service requests.

Confirmed fields based on Supabase runtime samples:
- id (uuid)
- timestamp_submitted (timestamptz)
- customer_name (text)
- phone_number (text)
- email_address (text)
- brand_model (text)
- glove_type (text)
- web_type (text)
- services_requested (text)
- primary_lace_color (text)
- secondary_lace_color (text)
- custom_color_request (text)
- drop_off_method (text)
- street_address (text)
- city (text)
- state (text)
- zip_code (text)
- glove_notes (text)
- social_tag (text)
- turnaround_acknowledged (text)
- referral_source (text)
- glove_photos (text nullable; stores a serialized JSON array of image URLs)
- order_number (text)
- status (text)
- date_received (date)
- estimated_completion (date)
- price_quoted (numeric)
- paid (text)
- allow_ship_without_payment (boolean)
- tracking_number (text)
- carrier (text)
- date_completed (date)
- internal_notes (text)
- last_status_emailed (text)
- created_at (timestamptz)
- updated_at (timestamptz)
- customer_notes (text)
- sms_opt_in (boolean)
- last_status_texted (text)
- last_customer_text (text)
- last_customer_text_at (timestamptz)
- customer_approved_at (timestamptz)
- primary_lace_used (numeric)
- secondary_lace_used (numeric)
- shipping_cost (numeric)

Observed usage:
- The intake flow creates a new row with a generated order number and initial status of Received.
- The admin API reads and updates rows by order_number.
- The SMS handler updates the row based on the customer’s phone number and stores inbound text/photo metadata.
- The application stores `orders.glove_photos` as serialized JSON text and parses it into an array when reading the order row.
- The application parsing logic treats `glove_photos` as either an array or a JSON string and JSON.parse's it when necessary.

### lace_inventory
Tracks lace stock levels for customer-facing inventory display and admin inventory management.

Confirmed fields based on Supabase runtime samples:
- id (uuid)
- color (text)
- quantity_on_hand (numeric)
- reorder_at (numeric)
- active (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)

Observed usage:
- The public inventory endpoint queries rows where active is true.
- The admin API lists inventory rows and adjusts quantity_on_hand when order changes consume lace.

### gloves_for_sale
Stores public-facing gloves that are listed for sale.

Confirmed fields based on Supabase runtime samples:
- id (uuid)
- slug (text)
- title (text)
- short_description (text)
- description (text)
- price (numeric)
- brand (text)
- model (text)
- glove_size (text)
- position (text)
- web (text)
- throw_hand (text)
- condition (text)
- status (text)
- featured_image_url (text nullable)
- hover_image_url (text nullable)
- purchase_url (text nullable)
- featured (boolean)
- sort_order (integer)
- created_at (timestamptz)
- updated_at (timestamptz)

Observed usage:
- The public gloves-for-sale endpoint reads rows excluding hidden status and orders them by sort_order and created_at.
- The admin API lists, creates, updates, deletes, and manages photos for these rows.

### glove_sale_photos
Stores one or more photos associated with each glove listing.

Confirmed fields based on Supabase runtime samples:
- id (uuid)
- glove_id (uuid)
- url (text)
- filename (text)
- caption (text nullable)
- sort_order (integer)
- created_at (timestamptz)
- is_primary (boolean)
- is_hover (boolean)

Observed usage:
- The public gloves endpoint joins photos for each glove and chooses primary/hover photos.
- The admin API uploads, lists, sets primary/hover, and deletes photos.

## Storage buckets

### gallery
Used for public gallery images.

Observed usage:
- Admin uploads gallery images through the upload action.
- The admin API stores files under a section-based path such as fielding-gloves/<timestamp>-<filename>.<ext>.
- The admin API lists files from the gallery bucket by section prefix.
- The Supabase UI shows this bucket as public with no bucket-level storage policies configured.

### gloves-for-sale
Used for sale-glove photos.

Observed usage:
- Admin uploads sale-glove photos under a slug-based path such as <slug>/<timestamp>-<filename>.<ext>.
- The public and admin APIs build public URLs from the stored object path.
- The Supabase UI shows this bucket as public with no bucket-level storage policies configured.

### order-photos
Used for inbound SMS media attachments.

Observed usage:
- The SMS handler downloads incoming Twilio media and uploads it to storage.
- The stored path is based on the order number and timestamp.
- The Supabase UI shows this bucket as public with no bucket-level storage policies configured.
- The Supabase `storage` schema contains `buckets` and `objects`, but the project does not expose a `storage.policies` relation, so policy detail is limited to the bucket settings visible in the UI.

## Relationships

The code implies the following relationships:
- orders has many order-related media references through the glove_photos field.
- gloves_for_sale has many glove_sale_photos via glove_id.
- There is no explicit foreign-key enforcement shown in the repository code.

## Data conventions observed in code

- Order numbers are stored as strings and generated as zero-padded numeric values (for example 0080).
- Status values are treated as display strings and normalized in the code (for example Received, Estimate Sent, In Progress, Completed).
- Lace inventory uses color strings as the primary lookup key.
- Gallery sections are restricted to a fixed set: fielding-gloves, catchers-mitts, first-base-mitts, custom-color-relaces, and vintage.

| table_name        | column_name                | data_type                | is_nullable | column_default    |
| ----------------- | -------------------------- | ------------------------ | ----------- | ----------------- |
| glove_sale_photos | id                         | uuid                     | NO          | gen_random_uuid() |
| glove_sale_photos | glove_id                   | uuid                     | NO          | null              |
| glove_sale_photos | url                        | text                     | NO          | null              |
| glove_sale_photos | filename                   | text                     | YES         | null              |
| glove_sale_photos | caption                    | text                     | YES         | null              |
| glove_sale_photos | sort_order                 | integer                  | NO          | 0                 |
| glove_sale_photos | created_at                 | timestamp with time zone | NO          | now()             |
| glove_sale_photos | is_primary                 | boolean                  | YES         | false             |
| glove_sale_photos | is_hover                   | boolean                  | YES         | false             |
| gloves_for_sale   | id                         | uuid                     | NO          | gen_random_uuid() |
| gloves_for_sale   | slug                       | text                     | NO          | null              |
| gloves_for_sale   | title                      | text                     | NO          | null              |
| gloves_for_sale   | short_description          | text                     | YES         | null              |
| gloves_for_sale   | description                | text                     | YES         | null              |
| gloves_for_sale   | price                      | numeric                  | YES         | null              |
| gloves_for_sale   | brand                      | text                     | YES         | null              |
| gloves_for_sale   | model                      | text                     | YES         | null              |
| gloves_for_sale   | glove_size                 | text                     | YES         | null              |
| gloves_for_sale   | position                   | text                     | YES         | null              |
| gloves_for_sale   | web                        | text                     | YES         | null              |
| gloves_for_sale   | throw_hand                 | text                     | YES         | null              |
| gloves_for_sale   | condition                  | text                     | YES         | null              |
| gloves_for_sale   | status                     | text                     | NO          | 'available'::text |
| gloves_for_sale   | featured_image_url         | text                     | YES         | null              |
| gloves_for_sale   | hover_image_url            | text                     | YES         | null              |
| gloves_for_sale   | purchase_url               | text                     | YES         | null              |
| gloves_for_sale   | featured                   | boolean                  | NO          | false             |
| gloves_for_sale   | sort_order                 | integer                  | NO          | 0                 |
| gloves_for_sale   | created_at                 | timestamp with time zone | NO          | now()             |
| gloves_for_sale   | updated_at                 | timestamp with time zone | NO          | now()             |
| lace_inventory    | id                         | uuid                     | NO          | gen_random_uuid() |
| lace_inventory    | color                      | text                     | NO          | null              |
| lace_inventory    | quantity_on_hand           | numeric                  | NO          | 0                 |
| lace_inventory    | reorder_at                 | numeric                  | NO          | 3                 |
| lace_inventory    | active                     | boolean                  | NO          | true              |
| lace_inventory    | created_at                 | timestamp with time zone | YES         | now()             |
| lace_inventory    | updated_at                 | timestamp with time zone | YES         | now()             |
| orders            | id                         | uuid                     | NO          | gen_random_uuid() |
| orders            | timestamp_submitted        | timestamp with time zone | YES         | null              |
| orders            | customer_name              | text                     | YES         | null              |
| orders            | phone_number               | text                     | YES         | null              |
| orders            | email_address              | text                     | YES         | null              |
| orders            | brand_model                | text                     | YES         | null              |
| orders            | glove_type                 | text                     | YES         | null              |
| orders            | web_type                   | text                     | YES         | null              |
| orders            | services_requested         | text                     | YES         | null              |
| orders            | primary_lace_color         | text                     | YES         | null              |
| orders            | secondary_lace_color       | text                     | YES         | null              |
| orders            | custom_color_request       | text                     | YES         | null              |
| orders            | drop_off_method            | text                     | YES         | null              |
| orders            | street_address             | text                     | YES         | null              |
| orders            | city                       | text                     | YES         | null              |
| orders            | state                      | text                     | YES         | null              |
| orders            | zip_code                   | text                     | YES         | null              |
| orders            | glove_notes                | text                     | YES         | null              |
| orders            | social_tag                 | text                     | YES         | null              |
| orders            | turnaround_acknowledged    | text                     | YES         | null              |
| orders            | referral_source            | text                     | YES         | null              |
| orders            | glove_photos               | text                     | YES         | null              |
| orders            | order_number               | text                     | NO          | null              |
| orders            | status                     | text                     | NO          | 'Received'::text  |
| orders            | date_received              | date                     | YES         | null              |
| orders            | estimated_completion       | date                     | YES         | null              |
| orders            | price_quoted               | numeric                  | YES         | null              |
| orders            | paid                       | text                     | YES         | null              |
| orders            | allow_ship_without_payment | boolean                  | NO          | false             |
| orders            | tracking_number            | text                     | YES         | null              |
| orders            | carrier                    | text                     | YES         | null              |
| orders            | date_completed             | date                     | YES         | null              |
| orders            | internal_notes             | text                     | YES         | null              |
| orders            | last_status_emailed        | text                     | YES         | null              |
| orders            | created_at                 | timestamp with time zone | NO          | now()             |
| orders            | updated_at                 | timestamp with time zone | NO          | now()             |
| orders            | customer_notes             | text                     | YES         | null              |
| orders            | sms_opt_in                 | boolean                  | NO          | false             |
| orders            | last_status_texted         | text                     | YES         | null              |
| orders            | last_customer_text         | text                     | YES         | null              |
| orders            | last_customer_text_at      | timestamp with time zone | YES         | null              |
| orders            | customer_approved_at       | timestamp with time zone | YES         | null              |
| orders            | primary_lace_used          | numeric                  | YES         | null              |
| orders            | secondary_lace_used        | numeric                  | YES         | null              |
| orders            | shipping_cost              | numeric                  | YES         | null              |