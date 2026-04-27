---
author: Mahmoud Bakr
pubDatetime: 2026-03-10T10:00:00Z
title: "When the Cloud Burns: Why RTO and RPO Aren't Just Buzzwords"
slug: when-the-cloud-burns-rto-and-rpo
featured: false
draft: false
tags:
  - Architecture
  - Cloud
  - AWS
  - Reliability
description: >
  A reflection on what the March 2026 AWS Middle East outage reveals about RTO, RPO, and why non-functional requirements must be foundational — not optional.
canonicalURL: https://mbakr6821.medium.com/when-the-cloud-burns-why-rto-and-rpo-arent-just-buzzwords-59c4fad390bd
---

On March 1st, 2026, drones struck Amazon Web Services data centers in the UAE and Bahrain. Not metaphorically — physically struck them. Sparks. Fire. Emergency crews are cutting power to entire facilities. Dozens of AWS services went dark across the Middle East, and companies that hadn't thought deeply about their architecture were suddenly living their worst nightmare in production.

Abu Dhabi Commercial Bank went offline. Financial institutions scrambled. AWS told its customers to "enact their disaster recovery plans," which is a polite way of saying: *we hope you have one.*

Many didn't. Or at least, not a good one.

This isn't a post about geopolitics. It's about something we as engineers and architects control: **designing systems that survive the things we can't control.**

---

## Table of contents

## Let's Talk About NFRs First

When most teams start building a system, they're laser-focused on the functional requirements — what the system *does*. Login flows, payment processing, order management, you name it. But there's an equally critical (and often ignored) category: **Non-Functional Requirements (NFRs)**.

NFRs answer a different question. Not *what does the system do*, but *how well does it hold up under pressure?* We're talking performance, concurrent users, data volumes, and the one that matters most in crisis moments — **reliability**.

Within NFRs lives the **SLA — Service-Level Agreement**. Think of an SLA as a contract between your system and everyone depending on it. It defines what "working" actually means in measurable terms:

- **Availability** — How much downtime is acceptable per year? The famous "three nines" (99.9%) translates to roughly 8.7 hours of downtime annually. Four nines (99.99%) gives you less than an hour.

- **Latency** — How long does a single operation take from request to response?

- **Throughput** — How many requests can the system handle per second before it starts cracking?

But two numbers within the SLA are the ones that turn abstract promises into concrete engineering decisions: **RTO** and **RPO**.

---

## RTO and RPO — What They Actually Mean

**RTO — Recovery Time Objective.** This is the maximum amount of time your system is allowed to be down after a failure before it must be restored. If your RTO is 1 hour, then when disaster hits, you have 60 minutes to get back online. Not 61.

**RPO — Recovery Point Objective.** This answers a scarier question: *how much data can we afford to lose?* If your RPO is 5 minutes, it means that in the worst case, when the system goes down, you might lose up to 5 minutes' worth of data — but no more. Everything older than 5 minutes should be safely recoverable.

These two numbers aren't just metrics. They're design constraints. And the difference between a company that recovers in 45 minutes versus one that's still down 18 hours later usually comes down to whether these constraints were baked into the architecture from day one — or whether they were an afterthought written into a document nobody read.

---

## What Good Architecture Actually Looks Like for RTO & RPO

Declaring an RTO of 1 hour and an RPO of 5 minutes is easy. Actually achieving them requires specific, intentional engineering choices:

**For RTO (Recovery Time):**

- **Multi-AZ and Multi-Region deployments.** Your system can't recover fast if everything lives in one place. Clients that had workloads spread across multiple AWS Availability Zones barely noticed the March outage — because traffic automatically rerouted. Those running single-zone architectures experienced full-service blackouts.

- **Automated failover.** Recovery within 1 hour is nearly impossible if a human has to wake up, investigate, escalate, and manually trigger failover. The system needs to detect failure and redirect traffic without waiting for anyone's approval.

- **Pre-tested disaster recovery runbooks.** A DR plan that's never been tested is just a document. Teams that recovered quickly from the AWS outage were the ones that had *practiced* failing over — not just written about it.

- **Infrastructure as Code.** When physical infrastructure is damaged, being able to spin up equivalent capacity in another region in minutes (not days) is only possible if your infrastructure is defined in code and reproducible on demand.

**For RPO (Data Loss Tolerance):**

- **Continuous or near-continuous database replication** to a secondary region. If your last backup is 6 hours old when disaster strikes, your RPO is 6 hours — regardless of what your SLA document says.

- **Write-ahead logs and change data capture (CDC).** These ensure that every committed transaction is recorded and can be replayed, minimizing the gap between the primary and the replica.

- **Cross-region backup pipelines.** Backups stored in the same region as the primary are useless when that region is the thing that's on fire.

- **Point-in-time recovery (PITR)** for databases — so you can restore to any moment within your RPO window, not just to the last scheduled snapshot.

The teams that lost 4 to 10 hours of data during the Middle East outage weren't unlucky. Their backups were local. Their replication lag was measured in hours, not seconds. Their RPO was an untested assumption.

---

## The Architecture Conversation Companies Didn't Have

Here's the hard truth: most organizations know these concepts exist. The SLA document exists. Someone, somewhere, defined an RTO and RPO for the system. But at some point during the build phase, those constraints got quietly deprioritized. Multi-region replication was "too expensive." Automated failover was "overkill for our use case." Cross-region backups were "on the roadmap."

Then a drone strikes a data center in Bahrain.

AWS itself advised customers to "enact their disaster recovery plans, recover from remote backups stored in other regions, and update their applications to direct traffic away from the affected regions." That's sound advice — if your architecture was designed to support it. If it wasn't, that advice reads like being handed a parachute manual at 10,000 feet after you've already jumped.

The main lesson, as one analysis put it, is an unglamorous one: if your application isn't designed for multi-AZ operation, an availability zone failure becomes a full service outage. Cross-zone replication, tested failover, and clear degraded-mode behavior matter more than ever when the failure mode is abrupt and external.

Good architecture doesn't assume the happy path. It assumes the worst and builds accordingly. The goal isn't to prevent every possible disaster — drone strikes on data centers aren't something any architect can fully anticipate. But the goal *is* to ensure that when disaster happens, the system degrades gracefully, recovers quickly, and loses as little data as possible.

---

## The Bigger Picture

The Middle East outage is a vivid, concrete reminder of something architects and engineering leads need to be saying louder in every planning meeting: **the NFRs are not optional extras.** They're not things you revisit after launch. They're foundational constraints that shape every technical decision — from database choices to deployment topology to how you write your backup scripts.

The questions you need to answer before you write a single line of infrastructure code:

- What is our RTO, and is our current architecture physically capable of achieving it?

- What is our RPO, and does our replication/backup strategy actually support it?

- Have we *tested* our failover — not just documented it?

- Does our system survive the loss of an entire region, not just a single server?

Companies that had answered these questions were inconvenienced by the AWS outage. Companies that hadn't are still calculating what they lost.

The difference was built long before March 1st — in design sessions, architecture reviews, and the unglamorous work of actually testing the recovery process nobody wanted to spend time on.

Design for failure. Because eventually, failure will come looking for you.
