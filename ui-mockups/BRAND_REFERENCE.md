# Arihant website identity

Verified against [arihantcars.com](https://www.arihantcars.com/) on 29 October 2026. These are observed website assets and styles, not a new brand specification.

| Element | Original source | Prototype treatment |
| --- | --- | --- |
| Arihant Cars header/footer logo | [Original transparent PNG](https://static.cartradeexchange.com/virtual_bg_images/2427_1748257092_vitual_bg.png) | Original bytes preserved in assets/arihant-logo.png and embedded in the offline HTML. Native 196 × 126. Gallery width 98 px, phone width 76 px; height remains proportional. Black background; no cropping, recolouring, filters, tracing, or invented monogram. |
| Primary red | [Arihant website stylesheet](https://www.arihantcars.com/premium/css/arihantcars.css) | #C72128. Main actions, active journey stops, progress, and selected controls. |
| Black and charcoal | Same website stylesheet | #070707 and #373636. Headers, garage surfaces, and strong contrast. |
| White | Website styles | #FFFFFF. Action labels, light surfaces, and readable text on dark screens. |
| Typography | [Website base stylesheet](https://www.arihantcars.com/premium/css/t3styles.css) | Plus Jakarta Sans. Official Google Fonts copy bundled with its OFL license. System fallback supports Hindi. |
| Moving red car | [Website journey car PNG](https://www.arihantcars.com/premium/t3_images/car-arihant-cars.png) | Original asset embedded as journey-car.png. Position and rotation follow the scroll-driven road. |

Shared tokens are defined in brand-tokens.css. The three concepts vary task arrangement, emphasis, and surface treatment while keeping the same identity. Green and amber are reserved for operational status where used; they are not alternate brand palettes. Status also has text and icons.

The original favicon is a different square photograph containing background content; it is not used as a replacement for the header logo. The original transparent header logo is the clearest verified version available on the website. It is displayed below native dimensions instead of being enlarged or reconstructed.

The road is a workflow exploration inspired by the website’s moving car. Scrolling does not purchase, repair, approve, deliver, or update a vehicle. Application records display their own stage and parallel statuses. Buttons provide direct access to the five road stops. Reduced-motion preference disables automatic scroll following. Controls retain visible text, keyboard focus, and meaningful labels; this is not a claim of completed accessibility certification. Target sizing follows the principle of using generous controls described by [W3C’s target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Packaging matters: index.html and the source scripts are not the delivered offline artifact. Run build-preview.py after changes, then verify preview.html itself. The current asset audit compares the decoded packaged logo with the source PNG byte for byte and confirms no invented logo element remains in the generated DOM. Browser-rendered visual acceptance is still pending.
