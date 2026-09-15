# Architecture and persistence review

Reviewed the main-branch single-file application for individual US investors. Changes preserve direct file opening, offline calculation, and zero runtime dependencies. This is a source review with automated regressions, not a penetration test or certification of every imported field.

## Implemented fixes

| Severity | Problem | Resolution |
| --- | --- | --- |
| High | Imported JSON replaced live state without checking types, references, duplicate values, or finite money. Malformed data could crash views or silently distort allocations. | Validate before assignment: core collections, safe identifiers, account/holding references, snapshot dates, unique snapshot values, nonnegative finite numeric balances, selected nested settings, and simulation path limits. Invalid imports preserve the current portfolio. |
| High | Saving awaited browser IO, then always cleared the unsaved flag. Edits made during that wait were never written and lost their unload warning. | Compare the current serialization with the saved payload; retain dirty state for intervening edits and preserve a subsequently opened portfolio's handle. Commit a Save As handle only after successful close. |
| Medium | User text exported to CSV could become an executable spreadsheet formula. Carriage returns were not quoted. | Prefix formula-like text with an apostrophe, preserve actual numeric negative values, and quote both CR and LF. |
| Medium | Migration mutated its input and aliased default metadata before merging, dropping default drift bands. | Clone validated input and merge into a separate object. |
| Medium | Hosted startup fetched a sibling portfolio file despite the no-network product promise. | Remove implicit fetch; reopening uses a previously authorized local file handle. |
| Medium | Invalid JSON selected through the native picker silently reopened another picker, masking the error. | Distinguish selection failures from subsequent file-read/validation failures. Return the actual error. |
| Low | Cancelling the upload fallback left its promise pending and temporary input around. | Handle the native cancel event and remove the input on completion. |

Regression coverage: `node test/persistence.test.js` tests 11 groups including legacy/demo round trips, invalid data, CSV injection, edits during save, switching portfolios during save, failed import preservation, cancellation, and absence of startup network access. The existing tax-engine suite also passes after these changes.

## Current architecture assessment

The dependency-free application is a good distribution format for offline personal use. Financial engines are mostly named functions and file migration already has a version field, giving future extraction a useful starting point. Keep this distribution format.

The source currently mixes reference tables, calculations, storage, mutable application state, HTML templates, and event dispatch in one large script. Several helpers repeatedly scan holdings/accounts and rebuild indexes. Rendering replaces the entire app DOM; model changes can synchronously rerun thousands of Monte Carlo paths on the main thread. This is manageable for ordinary household portfolios, but it limits maintainability, accessibility continuity, and responsiveness as features grow.

A local Node VM performance probe of the reviewed solver took **1,823 ms** for 5,000 Monte Carlo paths over 51 years with a representative $1.42M multi-bucket household. This is one local measurement, not a browser/mobile benchmark, but confirms the main-thread work can be user-visible. Worker extraction is a prioritized follow-up; correctness changes should not be weakened to hide the cost.

The current browser has no account identity, tenant boundaries, subscriptions, server persistence, or server authorization. A hidden button or browser-held subscription flag would not provide paid-feature enforcement. Do not bolt payments directly onto this offline document.

## Staged extension plan

1. **Separate development modules while preserving one-file output.** Extract pure financial engines, versioned data contracts/migrations, file storage, and view components into source modules. A small deterministic build can inline these into the existing downloadable HTML. Tests should import the same source engines that the artifact bundles. Add a CI job that builds the artifact and checks it matches the source.
2. **Strengthen the data boundary.** Adopt a complete versioned JSON Schema with explicit ranges, enums, references, and migration fixtures for historical files. The new validator protects the highest-impact core paths, but is not a complete schema for all financial assumptions or extensions. Preserve unknown extension data deliberately. Define decimal rounding at currency boundaries before introducing persisted transaction ledgers.
3. **Introduce a storage interface.** Use `load`, `save(expectedRevision)`, `list`, and `export` operations with a file adapter first. Centralize state mutations/revisions, remove direct writes scattered through event handlers, and compute per-revision account/holding/snapshot indexes. Keep domain engines independent of user identity and storage.
4. **Move long calculations off the UI thread.** Run Monte Carlo work in a Web Worker, with cancellation and versioned input/output messages so stale results cannot overwrite newer ones. Reuse cached results by the complete assumption signature. Benchmark realistic and large portfolio fixtures on a midrange phone before selecting path counts or more complex rendering.
5. **Add an opt-in hosted product.** A small API and relational database can store users, portfolios, membership, revisioned portfolio snapshots, and subscription entitlements. Enforce ownership on every server operation and test cross-user access explicitly. Use optimistic concurrency to prevent one device overwriting another device's changes. Keep JSON export and the offline artifact as supported escape hatches.
6. **Add billing after identity and persistence.** Use hosted checkout and a customer portal. Verify signed provider webhooks, process events idempotently, and derive server-side entitlements from authoritative subscription state. Handle cancellation, failed payment, event reordering, and grace periods. Define free versus paid limits before implementing checkout; enforce hosted limits on the server.
7. **Set an explicit hosted privacy contract.** Revise the current local-only promise for users who opt into cloud saving. Establish retention/deletion/export behavior, encrypted transport and storage, backups with restore exercises, and logs that exclude portfolio values. Deliver a restrictive hosted CSP and dependencies without third-party trackers. Offline and hosted data handling should be clearly explained at the point where cloud saving is chosen.

## Remaining checks before a paid launch

Add browser integration coverage for file permissions, real download/cancel behavior, keyboard use, and interrupted saves. Add complete schema/fuzz tests and financial golden fixtures reviewed against authoritative tax sources. Run profiling on mobile, an independent security review of authenticated APIs and tenancy, and billing lifecycle tests. Do not describe the current local prototype as subscription-ready until those hosted boundaries exist.
