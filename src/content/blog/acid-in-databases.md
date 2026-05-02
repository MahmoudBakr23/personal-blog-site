---
author: Mahmoud Bakr
pubDatetime: 2026-05-02T08:00:00Z
title: "ACID in Databases: What PostgreSQL Guarantees and What It Doesn't"
slug: acid-in-databases
featured: true
draft: false
tags:
  - database
  - PostgreSQL
  - Rails
  - backend
  - architecture
description: >
  PostgreSQL is fully ACID-compliant — but ACID is a shared responsibility, not a free guarantee. Here's what the database enforces on its own, what you have to ask for, and where the traps are in Rails.
---

Most developers know ACID exists. Fewer understand exactly where PostgreSQL's responsibility ends and theirs begins — and that gap is where race conditions, orphaned records, and silent data corruption quietly happen in production.

ACID isn't a single switch you flip by choosing PostgreSQL. It's four separate properties, each with different enforcement mechanics, and each placing different obligations on you.

---

## Table of contents

## The Four Properties

**Atomicity** — a transaction is all or nothing. If any part fails, the entire transaction rolls back. No partial writes, no half-committed state.

**Consistency** — a transaction moves the database from one valid state to another. Every constraint — foreign keys, unique indexes, check constraints — must hold before and after. A transaction that would violate a constraint is rejected entirely.

**Isolation** — concurrent transactions don't interfere with each other. The result should be as if they ran one at a time, even when they're actually running in parallel.

**Durability** — once a transaction commits, it stays committed. A server crash immediately after the commit doesn't lose the data. PostgreSQL achieves this through the WAL (Write-Ahead Log): changes are written to disk before the commit is acknowledged.

These four properties are what "reliable transaction processing" actually means. Now let's talk about which ones come free and which ones you have to earn.

---

## Atomicity: Free, But You Have to Ask for It

PostgreSQL guarantees atomicity only within a transaction. Without one, each statement is its own auto-committed transaction.

```ruby
# NOT atomic — two separate auto-commits
account_from.update!(balance: account_from.balance - 100)
account_to.update!(balance: account_to.balance + 100)
# If the second line fails, the first is already committed
```

```ruby
# Atomic — both succeed or both roll back
ActiveRecord::Base.transaction do
  account_from.update!(balance: account_from.balance - 100)
  account_to.update!(balance: account_to.balance + 100)
end
```

The engine supports it. But you have to request it. Rails makes this easy, but the decision is still yours.

One Rails-specific gotcha worth knowing: `after_save` runs *inside* the transaction — it can still be rolled back. `after_commit` runs only after the transaction successfully flushes to disk. If you're enqueuing a Sidekiq job from a callback, use `after_commit`. Enqueuing from `after_save` risks dispatching a job that references a record which ends up rolled back.

---

## Consistency: Almost Entirely On You

This is the property people most consistently get wrong — and the one where PostgreSQL can only do what you tell it to.

PostgreSQL enforces the constraints you define. Nothing more. A common Rails pattern that looks safe but isn't:

```ruby
# Migration
create_table :orders do |t|
  t.integer :user_id   # no foreign key, no NOT NULL
  t.string :status     # no check constraint
end

# Model
class Order < ApplicationRecord
  belongs_to :user
  validates :status, inclusion: { in: %w[pending paid shipped] }
end
```

The model validations look fine. But they're enforced at the application layer. A raw SQL `INSERT` from a migration, a `update_all` call in a Sidekiq job, or a second service writing to the same database bypasses ActiveRecord entirely. You'll end up with orphaned `user_id` values pointing to deleted users, or a `status` column containing whatever someone typed into a psql session.

Real consistency requires constraints at the database level:

```ruby
create_table :orders do |t|
  t.references :user, null: false, foreign_key: true
  t.string :status, null: false
end

add_check_constraint :orders, "status IN ('pending', 'paid', 'shipped')", name: "valid_status"
```

Now PostgreSQL itself rejects bad data regardless of who's writing it. Model validations are still useful — they give you better error messages and catch issues before hitting the database. But they're the first line of defense, not the last. The constraint is what closes the gap.

---

## Isolation: You Choose the Tradeoff

PostgreSQL defaults to **Read Committed** isolation. This prevents dirty reads — you won't see uncommitted data from another transaction — but it doesn't prevent non-repeatable reads or phantom reads. In practical terms: you can absolutely write code with race conditions in a "fully ACID" database.

The classic example is the lost update:

```ruby
def increment_views
  post = Post.find(params[:id])
  post.update!(views: post.views + 1)  # race condition
end
```

Two requests hit this simultaneously. Both read `views = 100`. Both write `views = 101`. You lost a view. PostgreSQL didn't violate ACID — Read Committed allows this. The fix depends on what you're optimizing for:

```ruby
# Atomic SQL — no lock needed for simple increments
Post.where(id: id).update_all("views = views + 1")

# Pessimistic lock — explicit row lock, blocks concurrent reads
Post.transaction { Post.lock.find(id).increment!(:views) }

# Serializable isolation — strictest, retry on conflict
ActiveRecord::Base.transaction(isolation: :serializable) { ... }
```

Race conditions under concurrent access are a pattern that comes up across more than just increment counters — they appear in payment processing, inventory management, and anywhere two requests can act on the same record simultaneously. If you want to go deeper on the patterns for handling them safely, [the idempotency article](https://bakrblog.netlify.app/posts/idempotency-patterns) covers several of them directly.

---

## Durability: Mostly Automatic, Deliberately Configurable

This is the one property that's closest to "free." PostgreSQL fsyncs the WAL to disk before acknowledging a commit. Once you get confirmation, the data survives a crash.

But durability is configurable, and people sometimes turn it down:

```sql
-- Faster commits, but you can lose the last few transactions on crash
SET synchronous_commit = off;

-- Effectively no durability guarantees — test environments only
SET fsync = off;
```

In replicated setups, "durable" gets more nuanced. Durable on the primary doesn't mean the replica has it yet — that's the synchronous vs. asynchronous replication tradeoff. But for a standard single-node setup with default configuration, durability is handled for you.

---

## The Rails Transaction Trap

One more thing worth flagging because it catches experienced engineers: `ActiveRecord::Base.transaction` blocks handle exceptions differently depending on what you raise.

Raising any standard exception inside a transaction rolls back *and* re-raises — the exception propagates to the caller. But `raise ActiveRecord::Rollback` rolls back silently, without propagating. It's designed for this, but it means if you're relying on catching an exception to know the transaction failed, you won't see it.

```ruby
ActiveRecord::Base.transaction do
  order.update!(status: "paid")
  raise ActiveRecord::Rollback if some_condition  # rolls back, swallowed
end
# Execution continues here as if nothing happened
```

If you need the caller to know the transaction didn't commit, raise a different exception — one that propagates.

---

## The Mental Model

PostgreSQL is a partner, not a guardian. It gives you a well-built set of tools — and ACID is achievable with all of them. But the database can only enforce what you configure:

- **Atomicity** requires you to wrap multi-step operations in transactions
- **Consistency** requires you to define constraints at the database level, not just the model
- **Isolation** requires you to understand the default isolation level and use locking when concurrency matters
- **Durability** requires you to leave the default configuration alone (or understand exactly what you're trading away)

The database protects you from data corruption. It doesn't protect you from logic errors. Atomicity won't save you if you wrote the wrong business logic inside the transaction. Isolation won't save you if you didn't think about concurrent access. The machinery is there — using it correctly is the engineering work.
