---
author: Mahmoud Bakr
pubDatetime: 2026-04-27T08:00:00Z
title: "Private vs Protected in Ruby: Who's Allowed to Be the Receiver?"
slug: private-vs-protected-ruby
featured: true
draft: false
tags:
  - Ruby
  - OOP
  - language-internals
  - backend
description: >
  Ruby's private and protected keywords look like two flavors of the same idea, but the real distinction lives in one rule: who is allowed to be the receiver. Here's what that means, why it matters, and when to reach for each.
---

When developers first meet Ruby's `private` and `protected` keywords, they often treat them as two flavors of the same idea — "methods you can't call from outside." That's a useful first approximation, but it misses the real distinction.

Both modifiers restrict **where** a method can be called from. The interesting difference is **who is allowed to be the receiver**.

Let's unpack that.

---

## Table of contents

## Private: No Explicit Receiver Allowed

A `private` method can only be called from inside the class that defined it (or its subclasses), **and** it must be called without an explicit receiver.

That second rule is the one that trips people up.

```ruby
class User
  def greet
    puts "Hello, #{full_name}"   # ✅ implicit receiver — works
    # puts "Hello, #{self.full_name}"  # ❌ NoMethodError before Ruby 2.7
  end

  private

  def full_name
    "Mahmoud Bakr"
  end
end

User.new.greet
# => Hello, Mahmoud Bakr

User.new.full_name
# => NoMethodError: private method 'full_name' called for an instance of User
```

A small but important nuance: since **Ruby 2.7**, `self.` is permitted as a receiver for private methods — but only because the parser needed it to disambiguate setters like `self.name = "..."`. The spirit of the rule still holds: don't call private methods through an explicit receiver unless you have to.

---

## Protected: Explicit Receiver Allowed — Within the Family

A `protected` method loosens the receiver rule. It *can* be called with an explicit receiver, but only when the caller is an instance of the same class or a subclass.

This makes `protected` the natural choice when an object needs to peek at another object **of its own kind** — typically for comparisons.

```ruby
class Account
  def initialize(balance)
    @balance = balance
  end

  def richer_than?(other)
    balance > other.balance   # ✅ explicit receiver allowed — same class
  end

  protected

  def balance
    @balance
  end
end

a = Account.new(1_000)
b = Account.new(500)

a.richer_than?(b)   # => true
a.balance           # => NoMethodError: protected method 'balance' called
```

If you tried this with `private`, the `other.balance` line would raise. `protected` is what makes sibling-to-sibling access work cleanly.

---

## Quick Comparison

| Capability | `private` | `protected` |
|---|---|---|
| Call without receiver inside the class | ✅ | ✅ |
| Call with `self.` (setter or Ruby 2.7+) | ✅ (limited) | ✅ |
| Call with explicit receiver of same class | ❌ | ✅ |
| Call from outside the class | ❌ | ❌ |

---

## The Escape Hatch: `send`

Both modifiers can be bypassed with `send`:

```ruby
class User
  private

  def email
    "mahmoud@example.com"
  end
end

user = User.new
user.email          # => NoMethodError
user.send(:email)   # => "mahmoud@example.com"   ⚠️
```

`send` ignores visibility entirely. It works for setters too:

```ruby
user.send(:email=, "new@example.com")
```

This is powerful — and dangerous. It's how metaprogramming, serialization libraries, and test helpers reach into internals. It's also how encapsulation quietly dies in a codebase.

Ruby gives you a safer alternative: **`public_send`**.

```ruby
user.public_send(:email)   # => NoMethodError (respects visibility)
user.public_send(:name)    # => works if `name` is public
```

When you're invoking a method dynamically and the method name comes from anywhere outside your class — user input, configuration, a message bus — reach for `public_send` by default. Use `send` only when you've consciously decided to bypass visibility.

---

## When to Reach for Each

- **`private`** — implementation details. Helpers, internal state transitions, anything you'd be embarrassed to see in a public API.
- **`protected`** — collaboration between objects of the same class. Comparisons, equality checks, internal coordination between siblings.
- **`public`** (the default) — your object's contract with the rest of the world.

The receiver rule is the heart of it. `private` says *"don't even acknowledge me from outside."* `protected` says *"family only."* And `public_send` is the polite way to ask, *"are you sure you want to do that?"*

---

*If you found this useful, I write about Ruby internals, backend architecture, and the design choices behind everyday code.*
