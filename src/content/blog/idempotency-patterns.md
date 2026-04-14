---
author: Mahmoud Bakr
pubDatetime: 2026-04-14T08:00:00Z
title: "Idempotency in Distributed Systems: 5 Patterns Every Backend Engineer Should Know"
slug: idempotency-patterns
featured: true
draft: false
tags:
  - distributed-systems
  - backend
  - Ruby
  - Rails
  - Redis
  - database
description: >
  Silent duplicates are the hardest bugs in distributed systems. This article breaks down five idempotency patterns — from optimistic locking to the transactional outbox — with practical Rails examples.
---

When a payment fails halfway through — did the charge go through or not? When a background job crashes mid-execution — was the work done or lost? In distributed systems, **the hardest bugs aren't crashes; they're silent duplicates**.

That's where idempotency comes in.

---

## Table of contents

## What Is Idempotency?

Idempotency is the property of an operation that can be applied multiple times without changing the result beyond the initial application. In practical backend terms: **no matter how many times a job fires or a request arrives, the effect on your system happens exactly once**.

This matters because in distributed systems, failure is a given. Networks drop, workers crash, clients retry. The question isn't *whether* duplicates will happen — it's *whether your system is built to handle them*.

The guarantee idempotency gives you is subtle but powerful: **at-least-once delivery, exactly-once effect**.

Let's walk through five patterns to achieve this, from the simplest to the most involved.

---

## Pattern 1: Optimistic Locking

Optimistic locking takes a trust-first approach: let multiple workers attempt the operation, but detect and reject the duplicate after the fact.

In Rails, adding a `lock_version` column to a table activates this automatically. Every time a record is updated, `lock_version` is incremented. If a second worker tries to update the same record with a stale version number, Rails raises an `ActiveRecord::StaleObjectError` before the write lands.

```ruby
def process_order(order_id)
  order = Order.find(order_id)
  return if order.status == "captured"

  order.update!(status: "captured")
  # lock_version increments here — any concurrent duplicate will raise StaleObjectError
end
```

**When to use it:** Low contention scenarios — when duplicate execution is unlikely but you need a safety net. Great for payment state transitions, order processing, and similar finite-state workflows.

**Trade-off:** The first worker wins. Duplicates fail loudly (or silently if you rescue the exception intentionally). This is a feature, not a bug — but make sure your retry logic accounts for it.

---

## Pattern 2: Pessimistic Locking

Where optimistic locking *detects* conflicts, pessimistic locking *prevents* them from the start.

When the first worker acquires the lock, the database issues a `SELECT FOR UPDATE` — blocking any other worker from touching that row until the lock is released. The second worker waits, then reads fresh state and decides whether to proceed.

```ruby
order.order_processor.with_lock do
  # SELECT FOR UPDATE — second worker blocks here until the first commits
  order_processor = order.order_processor.reload

  return if order_processor.revenues_calculated

  order_processor.update!(revenues_calculated: true)
  # ... do the actual work ...
end
# lock released on commit
```

A useful mental model: imagine two people editing the same Google Doc.

- **Optimistic:** both edit freely. On save, one gets told "someone changed this — resolve the conflict."
- **Pessimistic:** the first person to open the doc locks it. The second sees "document is locked, please wait."

**When to use it:** High-contention scenarios — when concurrent access to the same row is genuinely likely and you need a guarantee, not just a detection. The downside is database-level blocking, which increases latency and can become a bottleneck under load.

---

## Pattern 3: Unique Database Constraints

Sometimes the simplest tool is the right one. A unique index on one or more columns at the database level makes duplicate writes structurally impossible — no application code required.

```ruby
# In a Rails migration
add_index :payments, [:order_id, :gateway_reference], unique: true
```

Any attempt to insert a duplicate row raises a database-level constraint violation. The application catches it, and the duplicate is rejected.

**When to use it:** Wherever duplicates are defined by a natural unique key — payment references, external event IDs, third-party webhook tokens. This is your first line of defense and should almost always be present alongside other idempotency mechanisms.

**Trade-off:** It's a hard constraint. If the uniqueness logic is more complex (e.g., "unique within the last 24 hours"), you'll need a different approach.

---

## Pattern 4: Idempotency Keys with Redis TTL

This pattern extends idempotency beyond your internal workers and all the way to the client. It's the approach used by payment gateways like Stripe, and for good reason — it's elegant, time-bounded, and places the responsibility of deduplication on a shared, fast store.

The flow:

1. The client generates a unique `Idempotency-Key` and attaches it to the request header.
2. Your API receives the request and checks Redis for that key.
3. If the key exists → return the cached result. Operation already happened.
4. If the key doesn't exist → execute the operation, store the result in Redis with a TTL (e.g., 24 hours), and return the result.

```ruby
def create_charge(idempotency_key:, amount:, customer_id:)
  cached = $redis.get("idem:#{idempotency_key}")
  return JSON.parse(cached) if cached

  charge = PaymentGateway.charge(amount: amount, customer_id: customer_id)

  $redis.setex("idem:#{idempotency_key}", 24.hours.to_i, charge.to_json)
  charge
end
```

**When to use it:** API endpoints that accept client-initiated requests — especially anything financial. The TTL makes the cache self-cleaning. The key lives only as long as a retry is reasonable.

**Trade-off:** Requires Redis (or equivalent). The TTL is a design decision: too short and legitimate retries get rejected; too long and your cache grows stale.

---

## Pattern 5: Transactional Outbox

The most architecturally involved of the five — but also the most reliable for mission-critical workflows where **you cannot afford to lose a job, and you cannot afford to run it twice**.

The core problem this solves: what happens if a job is picked up, partially executed, and then the worker crashes? The job might have been half-done. A naive retry runs it again from the start.

The outbox pattern solves this by decoupling *intent* from *execution*:

1. When a business operation needs to trigger a background job, instead of enqueuing it directly, write a row to an `outbox_events` table inside the same database transaction as the business operation. The row stores the job details and a `processed: false` flag.
2. A separate poller (e.g., a scheduled job running every 5 seconds) queries for unprocessed outbox entries and executes them.
3. On successful execution, the row is marked `processed: true`.

```ruby
# Inside the business transaction
ActiveRecord::Base.transaction do
  order.update!(status: "confirmed")
  OutboxEvent.create!(
    event_type: "order_confirmed",
    payload: { order_id: order.id }.to_json,
    processed: false
  )
end

# In the poller (runs every ~5s)
OutboxEvent.where(processed: false).find_each do |event|
  OrderConfirmedJob.perform_now(JSON.parse(event.payload))
  event.update!(processed: true)
end
```

The magic here is atomicity: the business operation and the intent to process are committed together. If the worker crashes before the poller runs, the outbox row remains unprocessed — and the poller picks it up on the next cycle. Nothing is lost.

**When to use it:** Workflows where job loss is unacceptable and eventual consistency is acceptable. Think: revenue calculations, invoice generation, audit logs, event-driven microservice triggers.

**Trade-off:** Not immediate — the poller introduces latency. Operationally more complex: you're maintaining an extra table and a scheduler. But for truly critical operations, this trade-off is worth it.

---

## Choosing the Right Pattern

No single pattern wins in all cases. Here's a quick reference:

| Pattern | Scope | DB Cost | Latency | Best For |
|---|---|---|---|---|
| Optimistic Locking | Row-level | Low | Low | Low-contention state transitions |
| Pessimistic Locking | Row-level | Medium | Medium | High-contention critical sections |
| Unique Constraints | Table-level | Very Low | Very Low | Natural unique keys, first line of defense |
| Redis Idempotency Keys | API / Service | Low | Low | Client-facing endpoints, payment flows |
| Transactional Outbox | System-level | Medium | Medium+ | Mission-critical, loss-intolerant jobs |

In practice, you'll often combine them. A payment flow might use a Redis idempotency key at the API boundary, a unique constraint on the `payments` table, and pessimistic locking inside the job that processes the charge. Defense in depth applies to correctness, not just security.

---

## Final Thought

Idempotency isn't a single checkbox — it's a design mindset. Every time you write a background job, define an API endpoint, or touch a financial record, the question worth asking is: *what happens if this runs twice?*

If your answer is "nothing bad," you're building resilient systems. If the answer is "we'd charge the customer again," you have work to do.

The patterns above are your toolkit. Use them deliberately.
