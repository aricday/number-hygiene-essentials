# Number Hygiene Essentials

A compliance-focused SMS list scrubbing tool built on Twilio Serverless (Functions & Assets). Before launching a campaign, upload your contact list and the app will validate every number through a multi-stage lookup waterfall — filtering out landlines, inactive numbers, and reassigned numbers — so you only message reachable, consented contacts.

---

## How It Works

Numbers are processed through three sequential stages using the [Twilio Lookup v2 API](https://www.twilio.com/docs/lookup/v2-api). If a number fails any stage, processing stops immediately for that number, saving on API costs.

| Step | Stage | Pass Criteria | Failure |
|------|-------|--------------|---------|
| 1 | **Line Type Intelligence** | `type = mobile` | Remove — Landline / VoIP |
| 2 | **Line Status** | `status = active, reachable, or unknown` | Remove — Inactive / Unreachable |
| 3 | **Reassigned Number** | `is_number_reassigned = false or null` | Remove — Reassigned |

> **Note:** Step 3 requires a "Last Verified Date" — the date you last confirmed consent from the contact. This is set globally in the UI and applied to the entire batch.

---

## Features

- **Single number check** — Quick lookup of one number for testing
- **Batch CSV upload** — Drag-and-drop a CSV file (up to 100 numbers per session)
- **Live dashboard** — Real-time progress bar, pie chart (Approved vs. Removed), and per-reason counters that update as each number is processed
- **Final report** — Summary table showing every number's decision, reason, and timestamp
- **Audit trail export** — One-click CSV download with columns: Phone Number, Decision, Reason, Timestamp

---

## Project Structure

```
Number Hygiene Essentials/
├── package.json                    # Project config; twilio-run dev dependency
├── .env.example                    # Credential template
├── functions/
│   └── lookup.protected.js         # Backend: Lookup v2 waterfall logic
└── assets/
    └── index.html                  # Frontend: single-file SPA
```

### Key files

- **[`functions/lookup.protected.js`](functions/lookup.protected.js)** — Node.js Twilio Function that accepts a phone number and optional last verified date, runs the 3-stage waterfall, and returns a JSON decision. The `.protected` filename infix enforces Twilio webhook signature validation.
- **[`assets/index.html`](assets/index.html)** — Vanilla JS / HTML / CSS single-page app. Uses [PapaParse](https://www.papaparse.com/) for CSV parsing and [Chart.js](https://www.chartjs.org/) for the live pie chart. All session state is held client-side; no database is required.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Twilio account](https://www.twilio.com/try-twilio)
- The following Twilio Lookup v2 add-ons enabled on your account (via the Twilio Console):
  - Line Type Intelligence
  - Line Status
  - Reassigned Number

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure credentials

Copy the example env file and fill in your Twilio credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH_TOKEN=your_auth_token_here
```

Your Account SID and Auth Token are available in the [Twilio Console](https://console.twilio.com/).

> **Never commit your `.env` file.** Add it to `.gitignore` if you are using version control.

---

## Running Locally

```bash
npm start
```

This starts the Twilio Serverless local dev server. Open your browser to:

```
http://localhost:3000
```

The function endpoint is available at `http://localhost:3000/lookup` for direct testing.

### Test the function directly

```bash
# Single number lookup with a last verified date
curl -X POST http://localhost:3000/lookup \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+15005550006", "lastVerifiedDate": "2025-01-15"}'
```

Example response:

```json
{
  "decision": "APPROVE",
  "reason": "Passed all checks",
  "lineType": "mobile",
  "lineStatus": "active",
  "reassigned": false
}
```

---

## Using the App

### Single Number Check

1. (Optional) Set a **Last Verified Date** in the Configuration section.
2. Enter a phone number in E.164 format (e.g. `+15005550006`) in the Single Number Check panel.
3. Click **Check** or press Enter.
4. The result appears inline showing the decision, reason, line type, and status.

> **E.164 auto-format:** The app will automatically prepend `+1` for bare 10-digit US numbers (e.g. `5005550006` → `+15005550006`).

### Batch CSV Upload

1. Set a **Last Verified Date** (required for the Reassigned Number check).
2. Drag and drop a CSV file onto the upload area, or click to browse.
   - Phone numbers must be in the **first column**.
   - A header row is automatically detected and skipped.
   - Maximum **100 numbers** per session (additional rows are truncated).
3. Confirm the preview shows the expected numbers.
4. Click **Process List**.
5. Watch the live dashboard update in real time as each number is checked.
6. When processing is complete, scroll down to the **Final Report** table.
7. Click **Download Audit Trail (CSV)** to export the results.

### CSV Format

Your CSV can be as simple as a single column:

```
phone_number
+15005550006
+12025551234
+18005551234
```

Or part of a larger file — only the first column is read:

```
phone_number,first_name,last_name
+15005550006,Jane,Smith
+12025551234,John,Doe
```

---

## Deploying to Twilio Serverless

```bash
npx twilio-run deploy
```

After deployment, Twilio will print the URLs for your service. The asset URL (ending in `/index.html`) is your live app. Share it with your team or bookmark it for campaign prep.

To list your deployed services:

```bash
npx twilio-run list:services
```

To redeploy after making changes:

```bash
npx twilio-run deploy
```

---

## API Reference

### `POST /lookup`

Runs a phone number through the 3-stage waterfall.

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phoneNumber` | string | Yes | Phone number in E.164 format (e.g. `+15005550006`) |
| `lastVerifiedDate` | string | No | Date of last consent verification in `YYYY-MM-DD` format. Required for the Reassigned Number check. |

**Response (JSON):**

| Field | Type | Description |
|-------|------|-------------|
| `decision` | string | `APPROVE` or `REMOVE` |
| `reason` | string | `Passed all checks`, `Non-Mobile`, `Inactive`, `Reassigned`, `Invalid`, or `Error` |
| `lineType` | string | Line type returned by Lookup (e.g. `mobile`, `landline`, `voip`) |
| `lineStatus` | string | Line status returned by Lookup (e.g. `active`, `inactive`) |
| `reassigned` | boolean | Whether the number was flagged as reassigned |

**Example — number removed at Stage 1:**

```json
{
  "decision": "REMOVE",
  "reason": "Non-Mobile",
  "lineType": "landline"
}
```

---

## Audit Trail CSV Format

The exported CSV contains one row per number:

| Column | Description |
|--------|-------------|
| Phone Number | The number that was checked |
| Decision | `APPROVE` or `REMOVE` |
| Reason | The reason for the decision |
| Timestamp | ISO 8601 UTC timestamp of when the check was performed |

---

## Cost Considerations

Each Lookup v2 package (Line Type Intelligence, Line Status, Reassigned Number) is billed separately per number checked. The waterfall design minimises cost:

- A landline filtered at Step 1 incurs only one Line Type Intelligence charge.
- An inactive mobile filtered at Step 2 incurs Line Type + Line Status charges.
- Only numbers that pass Steps 1 and 2 incur the (more expensive) Reassigned Number charge.

Refer to the [Twilio Lookup pricing page](https://www.twilio.com/en-us/lookup/pricing) for current rates.

---

## Success Criteria

- **Deliverability** — Pre-filtering inactive numbers increases campaign delivery rates.
- **Compliance** — Zero messages sent to reassigned numbers since the provided verification date.
- **Cost management** — Non-mobile numbers are filtered before the expensive Reassigned Number check is performed.
