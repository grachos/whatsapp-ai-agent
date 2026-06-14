# WhatsApp AI Hotel & Cabin Reservation Agent

A production-ready, bilingual (Spanish/English) WhatsApp AI agent for hotel and cabin reservations, backed by Google Sheets + Google Calendar as the source of truth.

---

## Features

- Bilingual AI agent (ES/EN) via WhatsApp
- Real-time availability checking from Google Sheets
- Google Calendar synchronization
- Double-booking prevention with atomic locking
- React management dashboard
- Configurable AI model via OpenRouter (GPT-4o Mini, Claude, Gemini, etc.)
- Live system prompt editing without restart
- AI / Human mode toggle
- Sync validation with auto-repair

---

## Prerequisites

- Node.js 20+
- A Google Cloud project with:
  - Sheets API enabled
  - Calendar API enabled
  - A Service Account with JSON key
- An OpenRouter API key
- Docker & Docker Compose (for production)

---

## Google Sheets Setup

Create a Google Spreadsheet with **3 sheets**:

### Sheet 1 — `Inventory`

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| accommodation_id | name | type | status | max_guests | bedrooms | bathrooms | price_per_night | cleaning_fee | taxes_pct | amenities | description | images | min_stay | max_stay |

Example row:
```
CAB-001 | Cabaña El Pino | cabin | Active | 6 | 3 | 2 | 150 | 40 | 15 | WiFi, Jacuzzi, BBQ | Hermosa cabaña con vista al lago | https://... | 2 | 14
```

### Sheet 2 — `Reservations`

| A | B | C | D | E | F | G | H | I | J | K | L | M | N |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reservation_id | guest_name | phone | email | accommodation_id | accommodation_name | accommodation_type | checkin_date | checkout_date | num_guests | status | calendar_event_id | created_at | updated_at |

Leave this sheet empty — the agent manages it automatically.

### Sheet 3 — `Config`

| A | B | C |
|---|---|---|
| config_key | config_value | description |

Example rows:
```
checkin_time | 3:00 PM | Standard check-in time
checkout_time | 11:00 AM | Standard check-out time
cancellation_policy | 48 hours notice required for full refund | Policy text
```

**Important:** Share the spreadsheet with your service account email (`agent@project.iam.gserviceaccount.com`) giving it **Editor** access.

---

## Google Calendar Setup

1. Go to [Google Calendar](https://calendar.google.com)
2. Create a new calendar named "Reservations" (or use "primary")
3. Share it with your service account email with **Make changes to events** permission
4. Copy the calendar ID (e.g., `abc123@group.calendar.google.com`)

---

## Installation (Local Development)

```bash
# Clone and enter project
cd whatsapp-ai-agent

# Install backend dependencies
npm install

# Install dashboard dependencies
cd dashboard && npm install && cd ..

# Copy and fill environment file
cp .env.example .env.local
```

Edit `.env.local`:

```env
PORT=3000
API_KEY=your-secure-dashboard-key

OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini

GOOGLE_SERVICE_ACCOUNT_EMAIL=agent@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_CALENDAR_ID=your-calendar-id
```

Copy the same `API_KEY` to the dashboard:

```bash
echo "VITE_API_KEY=your-secure-dashboard-key" > dashboard/.env.local
```

### Start the agent

```bash
npm run dev
```

On first run, a QR code appears in the terminal. Scan it with WhatsApp on your phone.

### Start the dashboard (development)

```bash
cd dashboard
npm run dev
# Open http://localhost:5173
```

The dashboard QR page at `http://localhost:5173` also shows the QR code for WhatsApp connection.

---

## Production Deployment (Docker)

```bash
# Copy environment file
cp .env.example .env.local
# Fill in all values in .env.local

# Build and start
docker-compose up --build -d

# View logs
docker-compose logs -f agent

# The dashboard is served at http://your-server:3000/dashboard
```

### First-time WhatsApp authentication (Docker)

```bash
# Watch the logs for the QR code
docker-compose logs -f agent

# Or view the QR via the dashboard
open http://your-server:3000/dashboard
```

The `auth/` directory is mounted as a volume. Once authenticated, the session persists across container restarts.

---

## API Reference

All endpoints require `X-Api-Key: your-api-key` header.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (no auth) |
| GET | `/api/whatsapp/status` | Connection status |
| GET | `/api/whatsapp/qr` | QR code (base64 PNG) |
| GET | `/api/agent/mode` | Current mode (ai/human) |
| POST | `/api/agent/mode` | Set mode `{ "mode": "ai" }` |
| GET | `/api/agent/prompt` | Current system prompt |
| PUT | `/api/agent/prompt` | Update system prompt |
| GET | `/api/reservations` | List all reservations |
| POST | `/api/reservations` | Create reservation |
| PATCH | `/api/reservations/:id` | Modify reservation |
| DELETE | `/api/reservations/:id` | Cancel reservation |
| GET | `/api/inventory` | List accommodations |
| POST | `/api/inventory` | Add accommodation |
| PUT | `/api/inventory/:id` | Update accommodation |
| POST | `/api/sync/run` | Run sync validation |
| GET | `/api/sync/report` | Last sync report |
| GET | `/api/events` | SSE stream (real-time messages) |

---

## Switching AI Models

Change `OPENROUTER_MODEL` in `.env.local`:

```env
# GPT-4o Mini (fast, cheap)
OPENROUTER_MODEL=openai/gpt-4o-mini

# Claude Sonnet
OPENROUTER_MODEL=anthropic/claude-sonnet-4-5

# Gemini Flash
OPENROUTER_MODEL=google/gemini-flash-1.5

# Any OpenRouter model
OPENROUTER_MODEL=meta-llama/llama-3.1-70b-instruct
```

Restart the server after changing the model.

---

## Architecture

```
WhatsApp Guest
    ↓ Baileys WebSocket
Express.js API (Node/TypeScript)
    ├── AI Agent (OpenRouter + function calling)
    ├── Lock Service (in-memory, TTL-based)
    ├── Reservation Service (create/modify/cancel + rollback)
    ├── Availability Service (Sheets + overlap detection)
    ├── Pricing Service (nightly + cleaning + taxes)
    ├── Sync Service (cron reconciliation)
    └── REST API (dashboard)
         ↓
Google Sheets (source of truth) + Google Calendar
```

### Double-Booking Prevention

1. Guest requests reservation
2. AI calls `create_reservation` tool
3. Service acquires in-memory lock for the accommodation (30s TTL)
4. Re-validates availability from Sheets (double-check under lock)
5. Inserts row as `Pending`
6. Creates Google Calendar event
7. Updates row to `Confirmed` with calendar event ID
8. Releases lock

If any step fails → row set to `Cancelled` → calendar event deleted → lock released.

---

## Folder Structure

```
whatsapp-ai-agent/
├── src/
│   ├── agents/hotel-agent.ts          # AI orchestrator + tool definitions
│   ├── config/index.ts                # env validation
│   ├── integrations/
│   │   ├── whatsapp/                  # Baileys client + message handler
│   │   ├── openrouter/                # OpenRouter chat completion client
│   │   ├── google-sheets/             # Inventory + Reservations repos
│   │   └── google-calendar/           # Calendar CRUD
│   ├── services/
│   │   ├── lock.service.ts            # Atomic locking
│   │   ├── pricing.service.ts         # Price calculation
│   │   ├── inventory.service.ts       # Cached accommodation data
│   │   ├── availability.service.ts    # Overlap detection
│   │   ├── reservation.service.ts     # Full reservation lifecycle
│   │   ├── recommendation.service.ts  # AI recommendations
│   │   └── sync.service.ts            # Reconciliation
│   ├── api/routes/                    # Express route handlers
│   ├── middleware/                    # Auth, rate limiting, error handler
│   └── utils/                         # Logger, retry, date utils, event emitter
├── dashboard/                         # React + Vite SPA
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
