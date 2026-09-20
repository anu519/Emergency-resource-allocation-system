# Uyir Care — Backend

Node/Express + PostgreSQL (Prisma) + Socket.io backend for the Uyir Care frontend:
hospital/doctor discovery, appointment booking, emergency symptom search,
live ambulance tracking (simulated or real GPS), video consult signaling,
and Care Plan (subscription, vitals, prescriptions, messaging).

## 1. Setup

```bash
cd uyir-care-backend
npm install
cp .env.example .env        # then edit DATABASE_URL, JWT_SECRET
```

Create the database (Postgres must be running locally or point `DATABASE_URL`
at a hosted instance):

```bash
npx prisma migrate dev --name init
npm run seed
npm run dev                 # starts on http://localhost:4000
```

## 2. Ambulance tracking modes

Controlled by `AMBULANCE_TRACKING_MODE` in `.env`:

- **`simulated`** (default) — when `/api/emergency/call-ambulance` is called, the
  server starts an interpolation loop (`src/jobs/ambulanceSimulator.js`) that
  moves the ambulance from the hospital's coordinates to the patient's
  coordinates over the computed ETA, writing a position every ~2.5s and
  emitting it over Socket.io.
- **`device`** — the same trip record is created, but no server-side movement
  happens. A driver app/device is expected to `POST /api/trips/:id/position`
  with real GPS coordinates, which get relayed the same way.

Either way, the frontend subscribes the same way:

```js
socket.emit("trip:subscribe", tripId);
socket.on("position_update", ({ lat, lng, progress }) => { /* move marker */ });
socket.on("trip_arrived", () => { /* show "arrived" state */ });
```

This means you can ship with `simulated` today and switch to `device` later
by (a) flipping the env var and (b) building a tiny driver-side app that
posts to `/api/trips/:id/position` — no frontend changes required.

## 3. Key endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` / `/login` | JWT auth |
| GET | `/api/hospitals/search?specialty=&lat=&lng=` | Ranked hospital list |
| GET | `/api/causes` | 12-item icon-grid data for the booking flow |
| GET | `/api/doctors?causeSlug=knee-joint-pain` | Doctors for a cause, hospital attached |
| GET | `/api/doctors/:id/slots` | Open future slots for a doctor |
| POST | `/api/appointments` | Books a slot transactionally |
| POST | `/api/emergency/search` | Symptom text/quick-tap → ranked hospitals + logs request |
| POST | `/api/emergency/call-ambulance` | Creates + (if simulated) starts a trip |
| GET | `/api/trips/:id` | Trip status + latest position |
| POST | `/api/trips/:id/position` | Device-mode GPS ingestion |
| POST/GET | `/api/care-plans/*` | Subscription, vitals, prescriptions |
| GET/POST | `/api/messages` | Doctor chat history + send |
| POST | `/api/video/start` | Issues a WebRTC signaling room id |

## 4. Socket.io events

| Event (client → server) | Payload |
|---|---|
| `trip:subscribe` | `tripId` |
| `chat:join` | `{ userId, doctorId }` |
| `chat:message` | `{ userId, doctorId, sender, text }` |
| `video:join` / `video:signal` / `video:leave` | `roomId`, WebRTC signal payload |

| Event (server → client) | Payload |
|---|---|
| `position_update` | `{ tripId, lat, lng, progress, recordedAt }` |
| `trip_arrived` | `{ tripId }` |
| `chat:message` | `{ sender, text, createdAt }` |
| `video:signal` | `{ signal, from }` |

## 5. Folder structure

```
src/
  config/db.js          Prisma client singleton
  middleware/            auth (JWT), error handler
  utils/                 ranking.js (hospital scoring), symptom.js (specialty detection)
  controllers/            one file per feature area
  routes/                 thin Express routers -> controllers
  sockets/                Socket.io wiring + a small registry so jobs/controllers can emit
  jobs/ambulanceSimulator.js   simulated GPS interpolation engine
  server.js               entrypoint
prisma/
  schema.prisma           full data model
  seed.js                 loads hospitals/doctors/causes from the frontend's demo data
```
