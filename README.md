# WasteLoop — Academic Prototype

WasteLoop is a **college academic prototype** of a government-style waste management and
recycling portal. It demonstrates waste pickup requests, live collection tracking, smart
waste disposal guidance, environmental impact reporting, grievance redressal, and digital
recycling certificates.

> **Prototype disclaimer.** WasteLoop is **not** a Government of India service and is not
> affiliated with any government body, ministry, or municipal authority. It is a student
> project built for academic demonstration using synthetic data only.

## Technology

Built deliberately with no third-party runtime dependencies:

| Layer | Technology |
| --- | --- |
| Server | Node.js core modules only (`http`, `fs`, `path`, `url`, `crypto`, `events`) |
| Storage | Local JSON files under `data/` (atomic writes, no database) |
| Client | Vanilla JavaScript (ES5-style), native `fetch()`, no framework |
| Styling | Plain CSS, no preprocessor or framework |
| Mapping | Hand-drawn SVG route simulation, no map SDK |

There is nothing to install — no `npm install` step is required.

## Requirements

- Node.js **18 or newer** (tested on Node 24)
- A modern browser with `fetch()` support

## Getting Started

```bash
npm start
```

Then open <http://127.0.0.1:3000/>.

The server prints the booking policy and data folder on startup. On first run it creates
and seeds the JSON files in `data/`. Press `Ctrl+C` to stop.

To run the automated test suite:

```bash
npm test
```

The suite starts the server on a free port, exercises every API endpoint, and reports
a pass/fail summary. It writes to the real `data/*.json` files, so back them up first if
you want to keep a pristine demo dataset.

## Project Structure

```
WasteLoop/
├── server.js            # HTTP server, static file serving, API dispatch
├── lib/
│   ├── routes.js        # All API route handlers
│   ├── domain.js        # Business rules: assignment, status flow, impact, rewards
│   ├── dates.js         # Future-date-only validation using UTC day numbers
│   ├── events.js        # EventEmitter bus
│   ├── workflows.js     # Event-driven pickup / reward / grievance / certificate flows
│   ├── store.js         # Atomic JSON persistence and ID generation
│   ├── seed.js          # Synthetic prototype dataset
│   └── waste-guide.js   # Waste item disposal knowledge base
├── js/                  # Browser modules (one per page, shared helpers)
├── pages/               # Portal pages
├── css/                 # style.css (base theme) and portal.css (new features)
├── data/                # JSON storage (auto-created and seeded)
└── tests/api-test.js    # 150-assertion integration suite
```

## Pickup Date Policy

Pickup bookings are **future dates only**; the earliest selectable date is **tomorrow**
and the limit moves forward with the real calendar.

- The browser computes tomorrow from the current date, sets it as the input's `min`
  attribute, and blocks manual typing of any earlier date.
- The frontend reconciles against `GET /api/meta` so the client and server always agree.
- The server re-validates independently and cannot be bypassed.
- Picking today or a past date produces exactly this message on both sides:

  > Pickup date must be a future date. Please select tomorrow or a later date.

Validation compares UTC **day numbers** rather than timestamps, so a date cannot be
rejected or accepted because of the time of day.

### Timezone handling

Clients send `clientTimezoneOffset` (from `Date.getTimezoneOffset()`) with the request. When
that offset would place the client on a **different calendar day** than the server, the
server uses the client's own local day as the reference. This prevents a legitimate citizen
near the date boundary from being blocked, and works regardless of the server's own
timezone.

## API Reference

All responses use a consistent envelope: `{ ok: true, ... }` on success and
`{ ok: false, error: { code, message, field } }` on failure.

### Metadata

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/meta?tz=<offset>` | Server date, minimum pickup date, booking policy, service area |
| `GET` | `/api/notifications` | Recent prototype activity feed |

`/api/meta` accepts an optional `tz` query parameter carrying the browser's
`Date.getTimezoneOffset()`. When present, `minimumPickupDate` is computed for that visitor's
own calendar day — the exact date `POST /api/pickups` will accept from them — and
`clientOffsetApplied` reports whether it was used. Without `tz` the server returns its own
minimum.

### Pickups

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/pickups` | Request a pickup; assigns a collector and returns the receipt |
| `GET` | `/api/pickups` | List pickups (filterable) |
| `GET` | `/api/pickups/:id` | Fetch one pickup |
| `POST` | `/api/pickups/:id/status` | Advance the pickup through its status flow |
| `GET` | `/api/pickups/:id/certificate` | Certificate linked to a pickup |

**Pickup request fields:** `citizenName`, `mobile`, `email`, `address`, `city`, `pincode`,
`wasteCategory`, `weight`, `pickupDate`, and optional `remarks` plus `clientTimezoneOffset`.

**Status flow:** `Pending` → `Collector Assigned` → `On the Way` → `Arriving` →
`Collected` → `Completed`. Transitions only move forward; moving backwards is rejected.

Example:

```bash
curl -X POST http://127.0.0.1:3000/api/pickups \
  -H "Content-Type: application/json" \
  -d '{"citizenName":"Aarav Sharma","mobile":"9876500011","address":"Model Town",
       "city":"Ludhiana","pincode":"141001","wasteCategory":"Plastic Waste",
       "weight":12.5,"pickupDate":"2026-10-07"}'
```

### Grievances

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/grievances` | Register a complaint; returns a tracking reference |
| `GET` | `/api/grievances` | List grievances |
| `GET` | `/api/grievances/:id` | Track one grievance with full status history |
| `POST` | `/api/grievances/:id/status` | Advance the redressal status |

**Redressal flow:** `Submitted` → `Under Review` → `Assigned` → `Resolved`.

### Impact, Guide, Certificates

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/impact` | Environmental impact totals, category breakdown, methodology |
| `GET` | `/api/waste-guide?q=` | Search waste items by partial keyword match |
| `POST` | `/api/certificates` | Issue a certificate (completed pickups only) |
| `GET` | `/api/certificates` | List issued certificates |
| `GET` | `/api/certificates/:id` | Fetch one certificate |

Environmental impact is calculated from **completed pickups only**, so the figures always
reflect real prototype activity rather than hardcoded numbers. Waste diversion and CO₂
saved are derived per category and reconciled against the totals.

## Portal Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Home with live statistics from the API |
| `pages/pickup.html` | Book a pickup with the future-date-only calendar |
| `pages/track.html` | Animated collection vehicle, distance, ETA, and status |
| `pages/waste-guide.html` | Search a waste item for the correct disposal method |
| `pages/dashboard.html` | Environmental impact, Green Points, certificate history |
| `pages/grievance.html` | Submit and track a grievance through redressal |
| `pages/certificate.html` | Printable digital recycling certificate |
| `pages/leaderboard.html` | Citizen leaderboard ranked by Green Points |
| `pages/login.html` | Citizen login |
| `pages/services.html`, `pages/about.html`, `pages/contact.html` | Supporting pages |

Certificates are reached contextually from a completed pickup on the tracking, dashboard,
or receipt views rather than from the main navigation.

## Notes and Limitations

- Prototype data is synthetic. There is no real payment, SMS, email, or map integration.
- The map is a simulated SVG route, and the collection vehicle animation runs in the
  browser rather than from live vehicle telemetry.
- JSON files are suitable for a single-process demo, not for concurrent production use.
- Deleting the contents of `data/` restores the seeded dataset on the next start.