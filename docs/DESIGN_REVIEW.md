# Studio marketplace redesign

Reference reviewed: BookMyShow Bengaluru homepage, 31 October 2026, using official page content and the rendered desktop browser. The requested discovery skeleton is retained: search/location/sign-in header, secondary categories, compact promotional carousel, recommended poster cards, service discovery, membership band, and clear booking controls. Brand, copy, images and service content remain the studio platform's own.

## Design system

White header and panels, neutral #f5f5f5 page background, #e73152 primary buttons (darker than the reference pink for legibility), #2b3148 membership band. Inter/Arial sans-serif throughout. Maximum content width 1232px, desktop 24px container padding, mobile 18px. Rounded 8px media, 5px controls. Lucide outline icons. Reduced-motion support inherited and image hover transition disabled under that preference.

Concept reference: generated design board `exec-c6dd8416-0c62-4cd2-8eee-2c8b6d0c2765.png`. It is a design reference, never shipped as an image of the UI. All controls and text are native HTML/React.

## Fidelity ledger

| Point           | Concept/reference                                                          | Implemented decision                                                                                                                             |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header          | Brand, wide search, city, sign-in, service navigation                      | Matched; location options and categories come from API. Location selection filters discovery.                                                    |
| Banner          | Compact wide studio image, left aligned sans-serif headline, red CTA, dots | Matched; three manual slides, semantic buttons, original supplied headline. No automatic movement.                                               |
| Recommendations | Three studio photo cards with category and price                           | Matched; cards use database inventory, prices, facilities and capacity. No invented ratings.                                                     |
| Categories      | Three photo tiles, descriptive text and booking links                      | Matched with database categories and starting prices.                                                                                            |
| Membership      | Navy band with two light plans                                             | Matched with real database plan prices/benefits rather than the concept's illustrative figures.                                                  |
| Booking         | Date chips, green available slots, red selection, right summary            | Matched; live API availability, service/duration controls, separate date input for later dates, server-authoritative final pricing.              |
| Images          | Distinct photo, film and podcast spaces                                    | Generated concept assets; film fixture has its own optimized WebP. All fixture data remains visibly identified.                                  |
| Responsive      | Horizontal mobile rails and stacked booking summary                        | Implemented responsive CSS; this browser's fixed viewport prevents a true mobile viewport screenshot. Device-browser acceptance remains pending. |

Intentional deviations: retain the exact user-supplied hero copy and database prices/benefits. Keep fixture identity and honest tax/hold messaging. Use current available studio photos rather than inventing real client locations or adding unverified photo counts. Retain equipment, hours, policy and portfolio sections required by the full project. Existing authenticated dashboards retain their workflows with the new shared typography/accent.

Above-the-fold copy: supplied headline and supporting description retained; studio-specific search and navigation replace cinema terminology. No movie titles, BookMyShow logos, ratings or customer claims are copied.

## Verification

Production build, frontend/backend typecheck and 28 tests pass; external PostgreSQL concurrency test remains skipped without its test URL. Added HTTP integration assertions cover studio/service/category search, case-insensitive matching, no-match results, location listing and search/location intersection. Playwright source covers search/category navigation and date shortcuts; the automated suite was not run through a separate browser engine in this managed environment.

Cloud-browser checks: carousel next/reset; location dialog/select; podcast search returning The Conversation; date shortcut loading actual slots; slot selection; unauthenticated reserve displaying sign-in requirement; FAQ expand/collapse. Review uses the generated concept and saved browser screenshot through view_image. No provider-backed sign-in/payment acceptance is claimed.

The separately hosted preview is an explicitly labelled static catalogue preview. Its local browsing filters, search, carousel and FAQ work without pretending that authentication, live availability or checkout are deployed. The full Next/Nest application remains in the GitHub repository.
