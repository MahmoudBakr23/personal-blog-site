---
author: Mahmoud Bakr
pubDatetime: 2026-04-21T08:00:00Z
title: "Composite Indexes in PostgreSQL: The Small Change With a Big Impact"
slug: composite-indexes-postgresql
featured: true
draft: false
tags:
  - database
  - PostgreSQL
  - Rails
  - performance
  - backend
description: >
  Most developers add indexes and move on. But a single misunderstood rule about composite indexes leads to redundant indexes that silently cost you at write time, at query time, and at scale. Here's how to get them right — and how to add them safely in production.
---

Nearly every production application sits on top of a relational database. Most developers know indexes exist and add them when queries are slow. Fewer understand the rule that separates a well-indexed schema from one full of redundant overhead — a rule that requires no new dependencies, no architecture changes, and sometimes just removing a single line from your migration.

---

## Table of contents

## How PostgreSQL Actually Reads Your Data

Before indexes make sense, you need to understand what PostgreSQL does *without* them.

When you run a query like `SELECT * FROM payments WHERE user_id = 42`, PostgreSQL needs to find all matching rows. Without an index, it performs a **Sequential Scan**: it reads every single page of the table from disk into memory, examines every row, and keeps the ones that match. Start to finish, no shortcuts, regardless of how many rows you actually need.

For a table with a few hundred rows, this is fine. For a `payments` table with 50 million rows, this is the difference between a 2ms response and a query that locks your app for seconds.

An index changes the equation. The default index type in PostgreSQL is a **B-tree** — a self-balancing tree structure that organizes column values in sorted order, with each leaf node storing a pointer to the actual row on disk. When a query filters on an indexed column, PostgreSQL traverses the tree in O(log n) time to find matching entries, then fetches only those rows directly. It skips everything else.

Think of it like the index at the back of a textbook. Instead of reading every page to find "connection pooling," you go to the index, spot it immediately, and jump to page 347. The database does the same — except the cost of skipping to the right page at scale is the difference between a performant app and an incident.

---

## What an Index Looks Like in Rails

In a Rails migration, adding an index is one line:

```ruby
class AddIndexToPayments < ActiveRecord::Migration[7.1]
  def change
    add_index :payments, :user_id
  end
end
```

This tells PostgreSQL: maintain a B-tree on the `user_id` column of the `payments` table. Any query filtering by `user_id` can now use this index instead of scanning the entire table.

---

## Composite Indexes — Same Idea, Multiple Columns

A **composite index** (also called a multi-column index) is an index defined on more than one column together. The syntax in Rails is straightforward:

```ruby
add_index :payments, [:user_id, :status]
```

PostgreSQL builds a single B-tree that sorts and organizes records by `user_id` first, then by `status` within each `user_id` group. A query that filters on both columns — `WHERE user_id = 42 AND status = 'pending'` — can use this index to narrow results precisely, without touching unrelated rows.

This is particularly valuable for queries that are central to your app's domain. If your dashboard query is always "show me all pending payments for this user," a composite index on `(user_id, status)` is far more efficient than separate single-column indexes on each.

---

## The Leftmost Prefix Rule

Here's the rule that most developers either don't know or underestimate.

A composite index on `(user_id, status)` does **not** only help queries that filter on both columns. It also helps queries that filter on `user_id` alone — because `user_id` is the leftmost column in the index. PostgreSQL can use any **leftmost prefix** of a composite index.

Extending the example to three columns makes this clearer:

```ruby
add_index :payments, [:user_id, :status, :created_at]
```

With this single composite index in place:

| Query filters on | Index usable? |
|---|---|
| `user_id` | ✓ Leftmost prefix — full benefit |
| `user_id, status` | ✓ Leftmost prefix — full benefit |
| `user_id, status, created_at` | ✓ All three columns — full benefit |
| `status` | ✗ Not a leftmost prefix |
| `created_at` | ✗ Not a leftmost prefix |
| `status, created_at` | ✗ Middle columns only — no benefit |

The index can only be entered from the left. PostgreSQL has no way to skip to the middle of the tree because the tree is sorted by `user_id` first. Querying only on `status` is like trying to use a phone book sorted by last name to find everyone named "Ahmed" — the structure doesn't help you.

---

## The Redundancy Trap

This is where schemas accumulate silent overhead.

Consider this migration history, written by a team that incrementally added indexes as queries slowed down:

```ruby
# Migration 1 — index added when user dashboard was slow
add_index :payments, :user_id

# Migration 2 — index added when filtered queries were slow
add_index :payments, [:user_id, :status]
```

No errors. No warnings. Both indexes exist side by side, and the app runs fine. But the first index — `user_id` alone — is now **completely redundant**.

Because `user_id` is the leftmost column in the composite index `(user_id, status)`, PostgreSQL can already use that composite index for any query that filters on `user_id` alone. The single-column index provides zero additional query benefit.

What it does provide is overhead. Every time a row is inserted, updated, or deleted in the `payments` table, PostgreSQL must update **all** indexes on that table to keep them consistent. A redundant index means extra write work on every single mutation, extra storage on disk, and extra memory pressure in the buffer cache — with nothing to show for it on the read side.

The fix is simple:

```ruby
# Remove the redundant single-column index
remove_index :payments, :user_id

# The composite index already covers this
# add_index :payments, [:user_id, :status]  ← keep this
```

A useful mental model: **any column that appears alone as a single index is redundant if it also appears as the leftmost column in a composite index on the same table.** That single-column index can be dropped entirely.

---

## Adding Indexes Safely in Production: `:algorithm => :concurrently`

Here's where a lot of teams make a costly mistake. They write the migration locally, it works fine, they deploy — and their production database locks up for several minutes while PostgreSQL builds the index.

By default, `CREATE INDEX` in PostgreSQL acquires a **ShareLock** on the table for the entire duration of the build. This lock blocks all concurrent writes — INSERTs, UPDATEs, DELETEs — until the index is fully built. On a large table in production, that can be minutes. On a high-traffic app, that's an incident.

PostgreSQL offers a solution: `CREATE INDEX CONCURRENTLY`. Instead of locking the table once, it performs multiple passes over the data, allowing writes to proceed throughout the build. The index takes longer to build overall, but the table stays fully available the entire time.

In Rails:

```ruby
class AddCompositeIndexToPayments < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def change
    add_index :payments, [:user_id, :status], algorithm: :concurrently
  end
end
```

The `disable_ddl_transaction!` line at the top is **not optional**. Rails wraps all migrations in a database transaction by default, and `CREATE INDEX CONCURRENTLY` cannot run inside a transaction — PostgreSQL will raise an error. `disable_ddl_transaction!` tells Rails to skip the transaction wrapper for this migration.

What you get with `:concurrently`:

- No write locks on the table during the build
- Zero downtime for production deploys, even on tables with millions of rows
- The index becomes active atomically once the build completes

What you give up:

- The build takes longer (sometimes 2-3x) compared to a standard index build
- If the build fails midway, the index is left in an `INVALID` state and needs to be cleaned up manually before you can retry

For any table that sees meaningful write traffic in production, `:concurrently` is the right default. The longer build time is a cost you absorb quietly; the write lock is a cost your users feel immediately.

---

## Putting It Together

Here's what a clean migration looks like for a payments table — building a composite index in production without redundancy and without downtime:

```ruby
class OptimizePaymentsIndexes < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def up
    # Remove the redundant single-column index first
    remove_index :payments, :user_id, if_exists: true

    # Add the composite index without locking the table
    add_index :payments, [:user_id, :status],
              algorithm: :concurrently,
              if_not_exists: true
  end

  def down
    remove_index :payments, [:user_id, :status], if_exists: true
    add_index :payments, :user_id, algorithm: :concurrently
  end
end
```

---

## Final Thought

Composite indexes are one of the few places in backend engineering where a tiny schema change — sometimes literally removing a line — has a measurable, lasting impact on performance at scale.

The rule itself is simple: **any column that is the leftmost entry in a composite index already behaves as a standalone single-column index.** Adding both is redundant overhead with no benefit. Once you internalize this, you'll start spotting these patterns in every schema you touch.

And when you do add indexes to a live database, reach for `:algorithm => :concurrently` first. It costs you build time in silence. The alternative costs your users downtime in production.
