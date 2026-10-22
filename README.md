# CivicCare

A mobile-friendly civic reporting and neighbourhood support application built from the concepts in the supplied CivicCare review paper. This is a working local prototype with persistent data, not a deployed municipal or emergency service.

## Run the project

Install **Node.js 22.13 or newer** (Node 24 recommended). No npm dependencies or separate database installation are required.

```powershell
cd C:\Users\ihars\OneDrive\Desktop\DE_Civic_Care
npm start
```

Open **http://localhost:3000**. Use `npm run dev` for automatic server restart during development. Use `npm test` to run the API integration suite against a separate temporary database.

If PowerShell blocks `npm.ps1`, use `npm.cmd start`, or simply `node server.js`.

## Sample accounts

The welcome screen launches isolated practice personas without a password. The saved workspace also retains the original sample accounts below; sign in with their email and the password `CivicCare123!` to access those saved records.

| Account | Email | Access |
| --- | --- | --- |
| Resident | resident@civiccare.local | Reports, confirmations, requests, discussions |
| Volunteer | volunteer@civiccare.local | Same access, with volunteering enabled |
| Coordinator | admin@civiccare.local | Same access, plus issue status updates |

All names and seed records are fictional examples centred on Pune. New users register as residents; enabling volunteer availability allows them to help with matching requests. Coordinator access cannot be selected during registration. Change or remove the sample accounts before any deployment.

## Working features

### Refreshed UI and practice demo

Use the design button in the header to choose **City Pulse** (blue/orange editorial overview), **Map First** (location-led overview), or **Community Board** (warm, conversation-led overview). Your choice is saved in this browser; the feature set stays the same.

**Launch practice demo** on the welcome screen, or **Enter practice demo** in a saved workspace, opens a separate in-memory practice database. It does not modify `data/civiccare.sqlite`. Demo records last up to four hours and are cleared when the server restarts. All tabs in the same browser profile share its current demo and role; separate browser profiles have separate demos.

- **Quick introduction:** five concise spotlight steps with Next, Back, Skip and Escape. Background content is blurred outside the highlighted area. Opens automatically on the first demo launch in this browser. Highlighted controls remain usable; opening a form hides the coach until the form closes.
- **Demo role:** switch between Aarav (resident), Meera (volunteer), Rohan (second independent neighbour) and Coordinator without passwords.
- **Try a scenario:** run a five-step report-to-resolution workflow or a three-step request-to-completion workflow using real API actions. Scenario progress is retained across reloads in the same tab.
- **Reset demo:** restores the original fictional reports, people, points and requests in this practice workspace only.
- **Exit:** leaves demo mode and restores your previous saved-account session, if one existed.

### Updating your location

On **The map**, choose **Use my location** to save your device coordinates and immediately recenter the map. Allow location access when your browser asks. You can also search a city or landmark and select the correct result: the app saves its coordinates and recentres your maps. If device location and place search are unavailable, open **My profile**, enter latitude and longitude, check the map preview, and select **Save preferences**. The profile's Use my location button and place-result selection also save coordinates immediately, without requiring a second save. Other edited profile preferences still require Save preferences.

The neighbourhood name is a display label. Changing the name alone does not change the marker; select a search result, use device location, or enter coordinates to move it. Location and label are stored per account on the server. **My saved location** recenters the map after viewing an individual report. Maps and place search need internet access. Seeded practice reports remain fictional Pune examples even when your own marker moves elsewhere.

Place searches are user-triggered through a cached backend proxy to [Photon](https://github.com/komoot/photon), using OpenStreetMap data. No search requests are sent while typing. Only the search phrase is sent to the provider, not your device coordinates. Requests are limited and cached for one day. The public provider may be unavailable or throttle requests; device location and manual coordinates remain available. Use `PHOTON_URL` to configure your own Photon API endpoint for a larger deployment.

Default text is larger throughout the app for residents of every age. Easy mode offers further enlargement. Navigation, chips, buttons and icons include hover and keyboard-focus feedback; animations respect reduced-motion preferences.

SOS remains demo-only in every design. Practice actions never contact municipal systems, emergency services or real neighbours.

### Core functionality

- Registration and login with scrypt password hashes, expiring random sessions, HttpOnly cookies, and server-enforced coordinator permissions.
- Civic reports with categories, priority, coordinates, optional photo evidence, and transparent status timelines.
- Independent resident confirmations. A report becomes Verified after two confirmations. Reporters cannot confirm their own reports, and users cannot confirm twice.
- Duplicate warning for unresolved reports of the same category within 100 metres; residents may explicitly confirm that their new report describes a separate issue.
- Coordinator status updates and resident timeline comments.
- Volunteer requests matched by service category, availability, and Haversine distance within the volunteer’s configured radius. The requester confirms completion and the volunteer earns points once.
- Neighbourhood discussions with replies and appreciation toggles.
- Persistent in-app notifications, refreshed every 30 seconds while browsing. No background push notifications.
- OpenStreetMap view centred on saved coordinates, with category/status/search filters and a Locate action for individual reports. Map imagery needs internet access.
- Live report counts, category charts, resolution summaries, volunteer recognition, and CSV export with spreadsheet formula escaping.
- Easy mode with larger text and controls, keyboard-accessible dialogs, labelled forms, responsive layouts, and browser dictation where supported.
- Private demo SOS creation/cancellation with explicit acknowledgment. No real alerts, emergency calls, SMS, volunteer dispatch, or push delivery.

## Suggested demonstration

1. Sign in as a resident, create a civic report, and view its timeline.
2. Sign in as a volunteer and confirm the report. Create another resident account for a second independent confirmation.
3. Sign in as the coordinator and move the report to In progress, then Resolved.
4. Create an Errands help request as the resident. Accept it as the volunteer, then confirm completion as the requester.
5. Post a discussion and reply from another account. Inspect notifications and analytics.
6. Enable easy mode, check the layout on a phone-sized screen, and try the labelled SOS demo.

## Structure

```text
server.js                 Node HTTP API, authentication, SQLite schema and seed
public/index.html         Accessible application shell
public/app.js             UI views, forms, filters and API client
public/style.css          Responsive design and easy mode
public/experience.js      Design choices, tours and demo scenarios
public/experience.css     City Pulse, Map First and Community Board layouts
public/icon.svg           CivicCare mark
public/manifest.webmanifest  Standalone display metadata
tests/api.test.js         End-to-end API integration tests
tests/demo.test.js        Sandbox isolation, role journeys, reset and recovery
docs/ARCHITECTURE.md      Design, paper mapping and deployment roadmap
data/civiccare.sqlite     Generated persistent database (ignored by Git)
```

Database records and images are stored in `data/civiccare.sqlite`. Restarting the server preserves them. To start fresh, stop the server and move the `data` directory to a backup location, then start again. Seed data is created only when the users table is empty.

Configuration uses environment variables: `PORT` (default 3000), `DATA_DIR` (default project `data` directory), and `COOKIE_SECURE=1` for HTTPS deployment. The local server intentionally binds to 127.0.0.1. Do not expose this demo directly on a public network.

## Scope and next steps

The paper proposes React Native, Node.js, PostgreSQL/PostGIS, JWT and Firebase push messaging. This initial implementation uses a browser frontend, Node.js, SQLite, and opaque server sessions so the entire project runs locally without accounts, API keys or additional services. See `docs/ARCHITECTURE.md` for a path to the proposed stack.

Features that still require separate implementation include native mobile apps, PostgreSQL spatial queries and grid heatmaps, verified responder enrolment, Firebase/background push, municipal complaint integrations, moderation tooling, password recovery, multilingual interfaces, offline write queues, family-managed accounts, and real emergency delivery. The app has manifest metadata but no service worker or offline cache. Volunteer profiles are demonstration records and have no identity verification.

This prototype has not been field-tested. Report corroborations and points do not establish truth, trustworthiness, or proven civic outcomes. Before a pilot, add privacy controls, record retention/deletion, moderation and abuse prevention, identity verification, backups, accessibility audits and deployment security review. Public report coordinates are exact within the signed-in demo community; a pilot should use coarse public coordinates and limit access to sensitive information.
