# UX/UI review

## Summary

The existing paper, ink, blue and teal visual direction is coherent and appropriate for a personal-finance tool. The main issues were usability and trust, rather than a need for new decoration. The review preserves the product's functionality while improving mobile layout, keyboard access, readability, and claims.

## Fixed

- **Document standards:** added doctype, English document language, explicit document structure, a main landmark and keyboard skip link. Previously the file rendered in browser quirks mode.
- **Keyboard navigation:** action-only anchors and clickable spans now expose button semantics and respond to Enter/Space. Current navigation and expanded settings state are programmatically indicated.
- **Forms:** labels in shared field components are associated with their controls. Segmented radio controls display keyboard focus.
- **Dialogs:** added named dialog/modal semantics, inert background, initial focus, forward/backward Tab containment, Escape dismissal and restoration to the triggering control.
- **Feedback:** save/error notifications expose a polite live status region; long messages fit the viewport.
- **Responsive layout:** landing hero and dense multi-column panels stack at smaller widths. Desktop-sized landing padding and headings scale down; the illustrative location grid remains readable. Data tables have dedicated horizontally scrollable regions instead of forcing the entire page to overflow. Touch controls receive larger targets and mobile input text avoids automatic iOS zoom.
- **Readability:** secondary ink is darker, numbered navigation labels no longer use reduced opacity, and reduced-motion preferences are honored.
- **Trust and copy:** removed the fabricated HTTP-response-header/network-monitor panel and unsupported browser-network-enforcement claim. Replaced it with an accurate local-file explanation. Marked financial marketing examples as illustrative, removed guarantees about input accuracy and exact completion time, and softened universal claims about proposals and tax outcomes.

## Validation

Automated local Chrome checks at **390 × 844**:

- Landing and demo Overview document widths equal viewport width (390 px), with no whole-page horizontal overflow.
- Browser reports standards mode (`CSS1Compat`).
- Enter activates the demo CTA.
- Account dialog has modal semantics, focuses the correctly labeled Account name input, and makes the background inert.
- Shift+Tab wraps from the first field to the last dialog action.
- Escape closes the modal and restores focus to Add account.
- No JavaScript page errors during these flows.

Full-page mobile landing and demo screenshots were captured for visual inspection. Existing engine suite passed **152 tests, 0 failures** after the initial changes (other review work may expand this suite).

## Remaining opportunities

- A full screen-reader audit with VoiceOver/NVDA, plus Safari/Firefox and print/PDF verification, remains necessary before claiming accessibility conformance.
- Inline table inputs and interactive charts merit a dedicated accessible-name and keyboard-data-exploration pass. The field-label fix covers shared form components, not every possible custom control.
- Some very dense tables deliberately scroll horizontally on mobile; a future per-holding detail view could make phone editing more comfortable.
- Rendering still replaces large DOM regions. Preserving focus and selection across every in-place update would benefit from smaller component updates.
- The landing page is lengthy on a phone. A future content pass could remove repeated examples and keep the main explanation, product preview, privacy explanation and primary actions.
- Before a paid launch, test onboarding with representative investors, including file-save recovery and users unfamiliar with allocation versus asset location. Offline file persistence must remain clear if an optional hosted account model is introduced.
