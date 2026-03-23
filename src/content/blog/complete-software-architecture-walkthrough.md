---
author: Mahmoud Bakr
pubDatetime: 2026-03-23T10:00:00Z
title: The Complete Software Architecture Walkthrough
slug: complete-software-architecture-walkthrough
featured: true
draft: false
tags:
  - architecture
  - system-design
  - backend
  - Rails
description: >
  A complete walkthrough of software architecture design — from understanding requirements to mapping components — using Chatterly, a real-time messaging app, as the working example.
---

Most systems that fail in production don't fail because of bad code. They fail because nobody asked the right questions before writing the first line. Software architecture is the discipline of asking those questions first, and letting the answers drive every technology and design decision that follows.

This article walks through the full architecture design process for **Chatterly** — a real-time team messaging and collaboration platform — using the methodology taught in Memi Lavi's _"The Complete Guide to Becoming a Great Software Architect"_ course. By the end, you'll have a clear picture of how to move from a blank page to a production-ready system design, and more importantly, *why* each decision is made the way it is.

## Table of contents

## Why Architecture Matters Before a Single Line of Code

Skipping architecture is one of the most expensive mistakes a development team can make. When you jump straight to code, you're making architectural decisions anyway — you're just making them blindly, one feature at a time, with no coherent picture of the whole system. The cost of changing a foundational decision at month six is orders of magnitude higher than making it correctly at month zero.

The software architect's job is not to write code. It's to make the decisions that shape the system before code gets written — and to make those decisions based on evidence, not preference. That means starting with one thing above everything else: **requirements**.

> The architect's mindset: understand the problem completely before proposing a solution. Technology choices are outputs of requirements, not inputs.

## What Should the System Do? Functional Requirements

Functional requirements describe the system's capabilities — the concrete things users can do with it. They are the *what*. Before designing anything, you need a complete and agreed-upon list of these.

To identify functional requirements, ask questions like:

- What are the core user actions in the system?
- What data does the system create, read, update, and delete?
- What events does the system need to react to in real time?
- Are there different user roles with different permissions?
- What external integrations or third-party services are required?

For **Chatterly**, the functional requirements are:

- Register and authenticate users securely using JWT-based authentication
- Organize conversations into three types: channels (public), groups (private), and direct messages
- Send and receive real-time messages within conversations
- Support message threading via parent-message references
- Support soft deletion of messages (deleted content hidden, record preserved)
- Allow users to react to messages with emoji reactions
- Track and broadcast user online/offline presence in real time
- Initiate and manage peer-to-peer voice and video calls between users
- Support a full call lifecycle: calling, ringing, active, ended, declined, and missed states
- Expose a REST API for all data mutations and queries
- Broadcast real-time events (messages, presence, call signals) over WebSocket connections

This list tells you *what* the system needs to do. But it tells you almost nothing about *how hard* it needs to work — and that's where the second type of requirements comes in.

## What Should the System Handle? Non-Functional Requirements

Non-functional requirements (NFRs) define the system's operational characteristics — performance, reliability, scale, and availability. They are the *how well*. And unlike functional requirements, NFRs directly drive the architecture. They're what force you to choose Redis over a database, or partitioned tables over a single flat one.

To identify non-functional requirements, ask questions like:

- What's the expected data growth rate in the first year?
- How many concurrent users will the system handle at peak?
- What's the acceptable response latency for each type of operation?
- What's the message or transaction loss tolerance?
- What's the SLA — can the system afford minutes of downtime or must it be near-zero?
- Does the system need to scale horizontally, vertically, or both?

For **Chatterly**, the NFRs were defined based on the product's scale goals:

| Requirement       | Target                                                |
| ----------------- | ----------------------------------------------------- |
| REST API reads    | < 50ms (Redis cache hit)                              |
| REST API writes   | < 100ms (PostgreSQL write + Redis pub/sub)            |
| WebSocket delivery| < 30ms (Redis O(1) fan-out)                           |
| Auth check        | < 5ms (Redis GET for JWT denylist)                    |
| Throughput        | ~50,000 requests/second (horizontal Puma scaling)     |
| Concurrent WS     | ~1,000,000 connections (Redis pub/sub, Puma threads)  |
| Message loss      | 0% (PostgreSQL ACID transactions)                     |
| SLA               | Platinum — high availability, zero data loss          |
| Data volume       | Hundreds of millions of rows (partitioned table)      |

> **Never start designing the architecture without a solid understanding of both requirement types.** FRs tell you what to build. NFRs tell you how hard it has to work. The NFRs are what determine whether you need Redis or a simple database cache, whether you need WebSockets or polling, and whether you need table partitioning or a flat schema. Get these wrong and the architecture will fail under real-world conditions no matter how clean the code is.

## Mapping the Architecture: From Requirements to Components

Once the requirements are locked, the architecture emerges from them — not from personal preference or familiarity with a specific tool. Each component in Chatterly's architecture exists because a specific requirement demanded it.

### The Big Picture

Here is the overall system architecture:

```
                     ┌─────────────────────────┐
                     │   Browser (Next.js)      │
                     │   REST + WebSocket Client │
                     └──────────┬───────────────┘
                                │
            REST API / HTTP     │     WebSocket
           ┌────────────────────┴──────────────────────┐
           │                                           │
           ▼                                           ▼
┌───────────────────────┐               ┌───────────────────────┐
│      Rails API        │               │     Action Cable      │
│  (REST, Port 3001)    │──────────────►│  (WebSocket Server)   │
└──────────┬────────────┘    Pub/Sub    └──────────┬────────────┘
           │                Broadcast              │
           │ SQL                                   │ Pub/Sub
           ▼                                       ▼
┌───────────────────────┐               ┌───────────────────────┐
│      PostgreSQL       │               │         Redis         │
│  (Primary Data Store) │               │  (Pub/Sub, JWT,       │
│                       │               │   Presence, Cache,    │
└──────────▲────────────┘               │   Rate Limiting)      │
           │                            └──────────┬────────────┘
           │ SQL                                   │ Queue
           │                                       │
┌──────────┴────────────┐                          │
│        Sidekiq        │◄─────────────────────────┘
│  (Background Jobs)    │
└───────────────────────┘

All services ──► Sentry (Error Tracking & Logging)
```

Three architectural principles are visible immediately from this diagram:

**Loose Coupling** — The Rails API never directly contacts WebSocket clients. It writes to Redis, Action Cable reads from Redis, and each component only knows about the message format, not about the other component. Swap out Rails API and Action Cable is unaffected. This is what loose coupling looks like in practice.

**Stateless Services** — No service holds session state in memory. JWT tokens are stored in Redis with a TTL denylist, user presence is tracked in Redis with auto-expiry, and all persistent data lives in PostgreSQL. This means any process can be terminated or replaced without data loss, which is the prerequisite for horizontal scaling.

**Separation of Concerns** — Each component has a single, clearly bounded job: Rails API handles data mutations, Action Cable handles push delivery, Sidekiq handles async work, PostgreSQL stores data, Redis handles ephemeral state. No component reaches outside its boundary.

### Rails API — The REST Service

**Role**

The Rails API is the single entry point for all HTTP requests. It handles authentication, conversation management, message creation, reactions, and call session lifecycle. It is the only component that writes to the database. After every write, it publishes an event to Redis — it doesn't push to clients directly, it just fires the signal and moves on.

This separation is intentional: the Rails API must remain fast and predictable. Coupling it to WebSocket delivery would mean its response time depends on the health of client connections, which is unacceptable.

**Technology Stack**

- **Rails 8.1 (API mode) + Ruby 3.4.4** — Convention over configuration, mature ActiveRecord ORM, built-in ecosystem for auth and serialization
- **PostgreSQL 17** — ACID compliance, native time-based table partitioning for the messages table, CP system in CAP theorem terms (zero message loss)
- **Devise 4.9 + devise-jwt 0.13** — JWT tokens in headers, stateless auth, compatible with cross-origin Next.js frontend
- **Pundit 2.5** — Policy Objects pattern, one policy class per model (`ConversationPolicy`, `MessagePolicy`, `CallSessionPolicy`), authorization logic fully out of controllers
- **Blueprinter** — Serializer that controls exactly what fields are exposed to the client; the same serializer is reused in both HTTP responses and WebSocket broadcasts
- **PgBouncer** (via Supabase) — Connection pooler, keeps live PostgreSQL connections bounded under horizontal Puma scaling

**Architecture**

```
┌───────────────────────────────────────┐ ┌─────────────┐
│          Service Interface            │ │             │
│  (Controllers, Routes, Rack::Cors,    │ │             │
│   Devise-JWT middleware)              │ │             │
├───────────────────────────────────────┤ │   Logging   │
│           Business Logic              │ │   (Sentry)  │
│  (ActiveRecord Models, Pundit         │ │             │
│   Policies, Callbacks, Validations)   │ │             │
├───────────────────────────────────────┤ │             │
│            Data Access                │ │             │
│  (ActiveRecord queries, Blueprinter   │ │             │
│   Serializers, Redis cache layer)     │ │             │
└───────────────────────────────────────┘ └─────────────┘
                    │
              [PostgreSQL]
```

Every HTTP request flows top to bottom. The **Service Interface** layer receives the request, checks CORS headers, decodes the JWT, and routes to the correct controller — which contains as little logic as possible. The **Business Logic** layer is where validations, Pundit policy checks, and `after_create_commit` callbacks live — the callback is what fires the Redis broadcast after a write. The **Data Access** layer runs the ActiveRecord query and passes results through a Blueprinter serializer before returning them.

**Logging** (Sentry) is a cross-cutting concern — it's accessible by all layers and captures every exception automatically.

> **Principle in focus — Caching:** The Data Access layer includes a Redis cache. Read operations that would otherwise hit PostgreSQL are served from Redis at < 50ms. The cache is populated on write and invalidated when the underlying data changes. This is what makes the < 50ms read SLA achievable without a read replica.

**Development Instructions**

- Controllers must contain no business logic — their only jobs are authenticate, authorize, call the model, and render the serialized result
- Use `authorize @resource` (Pundit) in every action that touches a resource — no exceptions
- Use Blueprinter serializers consistently — never call `.to_json` directly on an ActiveRecord object
- Trigger broadcasts from model callbacks (`after_create_commit`), not from controllers
- Use `prepared_statements: false` and `advisory_locks: false` when connecting through PgBouncer (transaction pooling mode does not support these features)

---

### Action Cable — The Real-Time Push Layer

**Role**

Action Cable's job is delivery, nothing more. It maintains persistent WebSocket connections with clients and pushes events to them the moment they occur. It never writes to the database. It never makes business logic decisions.

When the Rails API publishes an event to Redis after a write, Action Cable receives it via pub/sub and forwards it to all subscribed clients on the appropriate channel. This architecture enables real-time fan-out across thousands of connected clients without any polling. The client never has to ask — the server just tells it.

**Technology Stack**

- **Action Cable** (built into Rails) — no third-party WebSocket library needed
- **Redis adapter** (logical database /0) — chosen over Solid Cable (PostgreSQL-based) because Redis pub/sub fan-out is O(1) regardless of subscriber count; Solid Cable uses polling and becomes a bottleneck above ~10,000 concurrent WebSocket connections. At the 1M concurrent connections target, there is no alternative.
- **devise-jwt** — the same JWT auth used by the REST API is reused here; only authenticated users can establish a WebSocket connection

**Architecture**

```
┌───────────────────────────────────────┐ ┌─────────────┐
│             Connection                │ │             │
│  (JWT auth, current_user identity,    │ │             │
│   reject_unauthorized_connection)     │ │             │
├───────────────────────────────────────┤ │   Logging   │
│              Channels                 │ │   (Sentry)  │
│  (ConversationChannel — messages,     │ │             │
│   PresenceChannel — online/offline,   │ │             │
│   CallChannel — WebRTC signaling)     │ │             │
├───────────────────────────────────────┤ │             │
│        Redis Pub/Sub Handler          │ │             │
│  (stream_from, broadcast_to,          │ │             │
│   Redis INCR rate limiting)           │ │             │
└───────────────────────────────────────┘ └─────────────┘
                    │
                 [Redis]
```

The **Connection** layer authenticates every WebSocket handshake — decoding the JWT, checking the Redis denylist, setting `current_user`. If auth fails, the connection is rejected before any subscription is allowed. The **Channels** layer is where the three channel classes live: `ConversationChannel` streams message events per conversation, `PresenceChannel` broadcasts online/offline state globally, `CallChannel` relays WebRTC signaling (SDP offers, answers, ICE candidates) between specific users. The **Redis Pub/Sub Handler** manages stream subscriptions and rate limiting via Redis `INCR` + TTL.

> **Principle in focus — Pub/Sub Messaging:** The Rails API and Action Cable are completely decoupled. When Rails API publishes to a Redis channel, it doesn't know Action Cable exists. When Action Cable subscribes to that channel, it doesn't know Rails API exists. They communicate only through the message format they've agreed on. This means either side can be redeployed, restarted, or replaced independently.

**Development Instructions**

- Every channel action must call `rate_limit!` before processing — this prevents clients from flooding channels
- Membership/authorization must be checked in `subscribed` before `stream_from` — a non-member must never receive another conversation's events
- Do not query the database inside relay actions (e.g., `send_signal` in `CallChannel`) — these are hot paths; relay data directly from client to target stream without a DB round-trip
- Refactor channel membership guards to delegate to Pundit policies once they are built: `ConversationChannel#member?` → `ConversationPolicy`, `CallChannel#participant?` → `CallSessionPolicy`

---

### Sidekiq — The Background Processor

**Role**

Sidekiq handles work that cannot happen synchronously in the request-response cycle. It polls a Redis-backed job queue and processes jobs asynchronously. It does not expose an API — it listens.

The primary use case in Chatterly is the **missed call job**. When a call is initiated and the callee doesn't respond within 30 seconds, Sidekiq transitions the call session from `ringing` to `missed`. This logic is time-delayed — it can't live in an HTTP request cycle because no request triggered it. It must be scheduled at call creation time and executed independently.

This pattern keeps the Rails API non-blocking while ensuring time-sensitive state transitions happen reliably.

**Technology Stack**

- **Sidekiq 7** — Redis-backed job queue; chosen over Rails 8's built-in Solid Queue because it uses the same Redis infrastructure already in the stack, and provides better throughput at scale
- **Redis logical database /1** — dedicated to Sidekiq job queues, isolated from Action Cable pub/sub (/0), cache (/2), and JWT+presence (/3)
- Runs as a separate process (`bundle exec sidekiq`), independent from the Rails API process

**Architecture**

```
┌───────────────────────────────────────┐ ┌─────────────┐
│              Polling                  │ │             │
│  (Sidekiq process polls Redis queue   │ │             │
│   for enqueued jobs continuously)     │ │             │
├───────────────────────────────────────┤ │   Logging   │
│           Business Logic              │ │   (Sentry)  │
│  (Job classes: MissedCallJob,         │ │             │
│   future notification jobs, etc.)     │ │             │
├───────────────────────────────────────┤ │             │
│            Data Access                │ │             │
│  (ActiveRecord — reads and updates    │ │             │
│   CallSession and related models)     │ │             │
└───────────────────────────────────────┘ └─────────────┘
                    │
              [PostgreSQL]
```

The **Polling** layer is managed by Sidekiq itself — it continuously dequeues jobs and dispatches them to the appropriate worker class. Sidekiq handles concurrency, automatic retries on failure, and dead-letter queuing for jobs that exhaust their retries. The **Business Logic** layer contains the job classes, each with a single `perform` method. The **Data Access** layer uses ActiveRecord to read and write to PostgreSQL.

> **Principle in focus — Async Messaging via Queue:** The Rails API enqueues the `MissedCallJob` with `perform_in(30.seconds, call_session_id)` and immediately returns a response to the client. The job sits in the Redis queue until 30 seconds pass, then Sidekiq picks it up. If Sidekiq restarts before the job runs, the job survives in Redis and is processed when Sidekiq comes back up. The queue provides durability that a simple `sleep` or in-memory timer cannot.

**Development Instructions**

- Job arguments must be scalar types (strings, integers) — never pass ActiveRecord objects; serialize to an ID and reload inside `perform`
- Always guard state before mutating — `MissedCallJob` must confirm the call session is still `ringing` before transitioning; the call may have already been answered or declined by the time the job runs
- Schedule with `perform_in(30.seconds, call_session_id)` at the moment the call session is created with `ringing` status
- Log every step — there is no request context or UI for background jobs; logging is the only way to trace what happened

---

### Next.js Client — The Frontend

**Role**

The Next.js Client is the only component the end user directly interacts with. It renders the UI, manages client-side state, communicates with the Rails API over HTTP, maintains a real-time WebSocket connection to Action Cable, and handles peer-to-peer WebRTC connections for voice and video calls.

The client holds no persistent business data. Its state is ephemeral — rebuilt from the Rails API on each session. This is the client-side expression of the stateless principle.

**Technology Stack**

- **Next.js (App Router)** — file-based routing, server components for fast initial loads, TypeScript out of the box
- **Zustand** — minimal state management; no Provider wrappers, no boilerplate; components access the store with a single hook
- **Tailwind CSS** — utility-first styling directly in JSX; no context-switching between component and stylesheet files
- **Axios** — configured HTTP client with a JWT interceptor that attaches the token to every request
- **Action Cable JS** — official Rails WebSocket client; a singleton consumer created once in `lib/cable.ts` and shared across all channel subscriptions
- **WebRTC (browser-native)** — peer-to-peer audio and video; Action Cable handles signaling, but the media streams flow directly between browsers, never through the server

**Architecture**

```
┌────────────────────────────────────────────────────────┐
│                      UI Layer                          │
│  (Next.js pages, React components: MessageList,        │
│   Sidebar, CallOverlay, IncomingCallModal, Avatar,     │
│   PresenceIndicator, etc.)                             │
├────────────────────────────────────────────────────────┤
│                    State Layer                         │
│  (Zustand stores: authStore, conversationStore,        │
│   callStore — custom hooks: useConversation,           │
│   usePresence, useCall)                                │
├────────────────────────────────────────────────────────┤
│                  API Client Layer                      │
│  (lib/api.ts — Axios instance with JWT interceptor,    │
│   lib/cable.ts — Action Cable consumer singleton,      │
│   lib/webrtc.ts — RTCPeerConnection helpers)           │
└────────────────────────────────────────────────────────┘
         │ REST / HTTP              │ WebSocket + WebRTC
    [Rails API]             [Action Cable + Browser P2P]
```

The **UI Layer** contains all pages and components. Components are pure rendering — they read from Zustand stores and call store actions, with no direct API calls. The **State Layer** contains the stores and custom hooks that bridge the store to the API Client Layer, subscribing to Action Cable channels and updating state when WebSocket events arrive. The **API Client Layer** holds the low-level utilities: the Axios instance, the Action Cable consumer, and WebRTC helpers.

> **Principle in focus — Stateless Client:** The client holds no persistent state between sessions. `authStore`, `conversationStore`, and `callStore` are all in-memory Zustand stores that start empty on page load and are populated entirely from API responses and WebSocket events. This means any tab refresh, any network interruption, any re-login starts from a clean, consistent server state — no stale or conflicting local data.

**Development Instructions**

- UI components must never call the API Client Layer directly — all data operations go through the State Layer (hooks and stores)
- The Action Cable consumer must be a singleton — one consumer, one connection, all channel subscriptions sharing it
- WebRTC peer connections must be created and managed entirely inside the `useCall` hook, not inside components
- JWT tokens must be stored in memory (Zustand) or `httpOnly` cookies — never in `localStorage`, which is accessible to XSS attacks

---

## Architecture Principles in Practice

Looking across the entire system, the same set of principles appears again and again. Here's where each one shows up concretely in Chatterly:

**Loose Coupling** — The Rails API publishes to a Redis channel. Action Cable subscribes to that channel. Neither knows the other exists. Swap either component and the other is unaffected. This is the single most important principle in distributed systems design.

**Stateless Services** — Every Puma worker process is interchangeable. JWT verification uses Redis, not in-memory sessions. Presence tracking uses Redis TTL, not in-process timers. Any process can be killed and replaced without data loss or session interruption.

**Caching** — Redis sits between the Rails API and PostgreSQL for read operations. Hot data (conversations, user profiles, presence) is served from memory at < 50ms without touching the database. The cache is populated on write and invalidated on update.

**Async Messaging via Queue** — The `MissedCallJob` pattern shows why queues exist: when you need something to happen later, reliably, without blocking the current request, a queue is the answer. The Rails API doesn't wait. Sidekiq processes it when the time comes. If Sidekiq goes down, the job survives.

**Separation of Concerns** — Each component has one job, one technology choice, and one scaling axis. Rails API scales horizontally by adding Puma processes. Action Cable scales by adding Redis pub/sub subscribers. Sidekiq scales by adding worker processes. PostgreSQL scales with a read replica. No component's scaling affects another.

**ACID Guarantees** — PostgreSQL enforces transactional integrity on every write. A message creation either fully succeeds or fully rolls back — no partial state, no lost records. This is what the 0% message loss SLA is built on.

**Time-based Partitioning** — The messages table is partitioned by month at the PostgreSQL level. Queries against recent messages only scan the current month's partition, not hundreds of millions of historical rows. This is the difference between a 2ms query and a 2-second query at scale.

## Download the Architecture Document

The full Chatterly architecture document — formatted as a standalone, professional reference — is available as a PDF below. Use it as a template for your own system architecture documentation.

[**Download: Chatterly Architecture Document (PDF)**](/downloads/chatterly-architecture-document.pdf)

## Conclusion

Software architecture is not about choosing the most interesting technology. It's about understanding what the system needs to do and how hard it needs to work, then making the minimum set of decisions that satisfy those constraints reliably. Every component in Chatterly exists because a specific requirement demanded it. Every technology choice has a documented reason. Every architectural principle has a concrete expression in the codebase.

That's what good architecture looks like — not clever, just clear.

Thank you for reading, and happy coding!
