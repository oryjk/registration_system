# Match Registration Window Integrity Design

## Goal

Make match registration windows survive every create/update path and enforce the same window rules in the Go backend, mini app, Go admin console, and mini mock runtime.

## Rules

- `registration_start_at` and `registration_end_at` remain independently nullable for legacy compatibility.
- When both bounds exist, the end must be later than the start.
- A missing start means registration is open from the beginning; a missing end means no explicit deadline.
- The registration interval is half-open: `registration_start_at <= now < registration_end_at`. Each operation reads the clock once and checks the locked match inside its transaction.
- User registration create/update/delete and pending team application create/withdraw are allowed only while the match is registering and the current time is inside every configured bound.
- Host/admin selection of a team application remains available after the application window so operators can decide after submissions close.
- A selected team application can still be rolled back after the deadline, because this is an operational correction rather than a new submission.
- Match update timestamps have three-state semantics: omitted preserves the current bound, JSON `null` clears it, and a timestamp replaces it.
- In the Go admin form, changing the match start time always resets `registration_end_at` to two hours before the new start time. This applies to both create and edit flows by product requirement; an existing registration deadline is intentionally replaced.
- The Go admin form edits match time at minute precision. Seconds and milliseconds are not business data that the form must preserve.

## Architecture

The match domain owns window validation and the `RegistrationOpenAt` policy. Application services call that policy before mutable user operations. HTTP and persistence adapters continue to transport nullable timestamps without duplicating business rules.

The Go admin console exposes two independent optional Ant Design `DatePicker` controls so partial legacy windows can be viewed and preserved unless the administrator changes the match start time, which intentionally applies the two-hour deadline rule. The mini app derives a three-state window (`not_started`, `open`, `closed`) for interaction gating. Before opening it counts down to the start; while open it counts down to an end when present or shows registration in progress; after closing it shows the deadline state. Its mock backend mirrors submitted timestamps and enforces the same user-facing mutations, while the Go backend remains authoritative.

The mini window state is shared by match registration and team application entry points so list/detail navigation cannot advertise actions that the backend will reject.

## Verification

- Domain tests cover timestamp preservation, partial bounds, invalid ordering, and boundary semantics.
- Application tests cover registration and team application mutations before, inside, and after the window.
- Admin payload and handler tests cover round-tripping, partial bounds, omission, and explicit clearing.
- Mini tests cover payload/mock preservation, pre-open/closed UI state, the hall's reactive clock boundary, and one-clock-per-mock-operation behavior.
- Full Go, mini, and admin quality commands must pass.
