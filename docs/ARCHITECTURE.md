# CivicCare implementation and paper mapping

## Architecture

The browser renders a responsive application and communicates with a Node.js HTTP server using JSON REST endpoints. SQLite stores users, sessions, reports, verifications, timelines, help requests, discussions, replies, notifications and private demo alerts. The server owns authorization, matching, status updates and points; the frontend does not determine permissions.

The initial project is deliberately one service. Separating issue reporting, volunteering, discussions and notifications into services should follow measured scaling needs rather than add infrastructure to a local prototype.

## Practice sandbox and presentation layer

Practice mode creates a separate in-memory SQLite database with the same schema and seed data. An unguessable HttpOnly cookie selects the sandbox, and a second cookie identifies its current persona. `AsyncLocalStorage` keeps database access scoped to each request, including requests whose JSON bodies are read asynchronously. Normal-account cookies and the on-disk database remain separate. Reset replaces only the selected practice database; expired or replaced databases are closed after pending requests finish. Up to 50 sandboxes are retained for four hours or until the process exits.

`public/experience.js` provides the three overview layouts, UI design picker, a concise five-step introduction and two interactive multi-role scenarios. The tour coach uses real DOM targets, blurs content outside the spotlight, repositions on scroll/resize, allows highlighted controls to be used, and yields to normal form dialogs. Polling pauses during the introduction. Scenario step progress is saved per practice workspace in the current tab's session storage; it cannot authorize API operations.

`PATCH /api/location` saves the authenticated user's coordinates and neighbourhood label independently of other profile preferences. Device-location actions and selected search results save immediately; manual coordinate edits show a preview before profile submission. Map iframes use the returned account coordinates, and My saved location restores the user's marker after a report is selected. The users-table migration adds a display-only area label without replacing existing records. Labels alone do not change coordinates.

`POST /api/places/search` is an authenticated, user-triggered place search. `lib/geocoding.js` proxies Photon using a configurable endpoint, validates point coordinates, normalizes longitude/latitude into API fields, caches results for one day, and spaces provider requests by at least 1.1 seconds. Provider failures return a fallback message; no location is selected implicitly, and device coordinates are not sent in search queries. The frontend credits Photon and OpenStreetMap.

Demo endpoints: `POST /api/demo/start`, `/api/demo/role`, `/api/demo/reset`, and `/api/demo/exit`. Only start/exit can run outside an authenticated practice workspace. Role selection is restricted to the four fictional personas and cannot elevate a saved resident account.

## Mapping the review paper to this build

| Paper concept | Implementation | Remaining work |
| --- | --- | --- |
| Civic reporting and transparent tracking | Geotagged reports, photos, statuses and event timeline | Municipal API delivery and acknowledgement |
| Community corroboration | Unique resident confirmations, two-confirmation threshold, duplicate proximity warning | Reputation, moderation, evidence review, text similarity |
| Nearby volunteering | Radius, category and availability matching, acceptance and completion | Identity checks, private coordination, safeguarding |
| Gamification | Server-awarded points and threshold recognition | Evaluate incentives and abuse patterns |
| SOS within 500 metres | Explicitly labelled private demo record only | Verified responders, consent, delivery guarantees, escalation and field validation |
| Older adult inclusion | Easy mode, large controls, labelled forms, optional dictation | Real user usability testing, translations, family setup |
| Spatial analysis | Per-report OpenStreetMap location, category filters and aggregate charts | PostGIS grids, heatmaps and privacy-preserving municipal analytics |
| Push notifications | Persistent in-app notifications with polling | Firebase Cloud Messaging and device token lifecycle |
| React Native frontend | Responsive web interface | Native navigation, permissions, camera and push |
| PostgreSQL/PostGIS | Local SQLite persistence and Haversine matching | Production migration and indexed spatial queries |

## Data and access

Reports, photos, discussions and support requests are shared with signed-in users. Password hashes, session tokens and private emergency contact notes are excluded from community APIs. Only the authenticated user's private profile and demo SOS history are returned. Coordinator permissions are checked on the backend.

For a pilot, distinguish public/coarse coordinates from precise private coordinates. Do not share home locations or sensitive requests publicly. Add scoped neighbourhood membership and moderation so people only see the communities they are authorized to access. Emergency contact notes are stored locally and are never used for messaging in this build.

## API overview

| Endpoint | Method | Purpose |
| --- | --- | --- |
| /api/register, /api/login | POST | Account creation and session login |
| /api/me, /api/dashboard | GET | Session and app data |
| /api/logout | POST | Revoke user's sessions |
| /api/profile | PATCH | Profile and volunteer preferences |
| /api/issues | POST | Create report or receive duplicate warning |
| /api/issues/:id | GET | Report details and timeline |
| /api/issues/:id/verify | POST | Unique independent confirmation |
| /api/issues/:id/status | PATCH | Coordinator status update |
| /api/issues/:id/comments | POST | Timeline comment |
| /api/requests | POST | Create support request |
| /api/requests/:id/accept | POST | Match and accept open request |
| /api/requests/:id/complete | POST | Requester confirms completion |
| /api/requests/:id/cancel | POST | Requester cancels request |
| /api/posts | POST | Start discussion |
| /api/posts/:id | GET | Discussion replies |
| /api/posts/:id/like | POST | Toggle appreciation |
| /api/posts/:id/replies | POST | Reply to discussion |
| /api/notifications/read | POST | Mark user's notifications read |
| /api/sos | POST | Explicit demo alert only |
| /api/sos/:id/cancel | POST | Cancel own active demo alert |

## Migration to the proposed production stack

1. Extract database access behind repositories. Migrate records into PostgreSQL and add `geography(Point,4326)` columns with GiST indexes. Replace Haversine scans with `ST_DWithin` and indexed distance ordering. Add schema migrations, transactions for all multi-record workflows, pagination and database backups.
2. Reuse the API from React Native. Replace cookie sessions with appropriately scoped mobile tokens if necessary; use refresh rotation and secure platform storage. Add camera, location permission flows and accessibility testing on actual devices.
3. Add a durable notification outbox and worker. Integrate Firebase with permission-aware device enrolment, delivery retries and idempotency. Protect private request details in notifications.
4. Implement verified volunteer enrolment, moderation queues, report escalation and neighbourhood membership. Add municipal integration adapters rather than imply the local report has already been filed officially.
5. Develop SOS separately with professional review: consented contacts, verified responders, 500-metre matching, cancellation windows, delivery monitoring, fallback paths and clear emergency escalation. A successful API response alone cannot prove anyone received or acted on an emergency.
6. Implement aggregation using grid zones and time ranges with minimum-count suppression and coordinate coarsening. Evaluate acknowledgement time, resolution time, confirmation quality, volunteer completion rates and older users' task completion with actual communities.

## Technical limits

Synchronous SQLite and in-memory login throttling are suitable for one local process, not a distributed deployment. Photo data URLs keep setup simple but are not a production media pipeline. Move images to object storage with validation, resizing and metadata stripping. Apply stricter per-route limits, audit logging, account recovery, record deletion, secure headers, HTTPS, access reviews and penetration testing before deployment.

OpenStreetMap is loaded as an embedded third-party map, which may receive the viewed coordinates and normal browser network metadata. The UI contains no third-party scripts and does not automatically request GPS access. Browser speech recognition is optional and may use the browser vendor's speech service.
