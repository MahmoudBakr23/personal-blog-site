---
author: Mahmoud Bakr
pubDatetime: 2025-03-08T10:00:00Z
title: Rails Active Support
slug: rails-active-support
featured: false
draft: false
tags:
  - Rails
  - Ruby
  - ActiveSupport
description: >
  An exploration of Rails ActiveSupport framework components including Core Extensions, Concern, Inflector, TimeWithZone, Notifications, and Autoload.
---

ActiveSupport is one of the framework components such as ActiveRecord and ActiveModel, ActionController, etc. This wide library provides us with all the core features of Ruby through utility classes and standard extensions.

## Table of contents

## Core Extensions

Core Extensions is the ability that ActiveSupport provides Ruby on Rails framework by extending Ruby's core classes such as String, Array, Hash, Integer, etc.

This is why we use any method directly anywhere through the RoR application.

```ruby
# String#underscore
"CamelCaseString".underscore
# => "camel_case_string"

# Array#to_sentence
[ "one", "two", "three" ].to_sentence
# => "one, two, and three"
```

## Concern

ActiveSupport::Concern is my code organizer hero. This module is for mixins - reusable code that can be included across the application classes especially when dealing with module dependencies or class methods and callbacks.

If you have multiple models that share the same feature (e.g., soft deletion or events tracking), this module is your optimal solution.

```ruby
module Trackable
  extend ActiveSupport::Concern
  # Hook: This block runs whenever the module is included in another class
  included do
    # This could be a callback, scope, or anything else
    validate :validate_trackable
  end
  # Instance Methods
  def track_event(event)
    puts "Tracking event: #{event}"
  end
  # Class Methods
  class_methods do
    def track_all_events
      # some logic here
      puts "All events tracked"
    end
  end

  private
  def validate_trackable
    # some logic here
  end
end
# app/models/user.rb
class User < ApplicationRecord
  include Trackable
end
User.find(1).track_event("login")
# => "Tracking event: login"
User.track_all_events
# => "All events tracked"
```

## Inflector

ActiveSupport::Inflector allows for inflecting words (e.g., pluralization, singularization, converting between cases).

Thanks to this module, Rails knows automatically when we generate a new User model, it creates a new migration table 'users', and it also handles the associations (e.g., has_many :users)

```ruby
ActiveSupport :: Inflector.pluralize("person")
# => "people"
ActiveSupport :: Inflector.singularize("people")
# => "person"
```

## TimeWithZone

ActiveSupport::TimeWithZone is an amazing class that enables dealing time in different zones very effectively because it's a wrapper around Ruby's Time and DateTime objects.

It comes with many methods such as now, in_time_zone, strftime, and even duration objects (e.g., 3.days, 30.minutes, etc)

```ruby
current_zone_time = Time.zone.now  # Returns current time in the application's configured time zone.
current_server_time = Time.now  # Returns the current server's local time.
next_week = Time.zone.now + 1.weeks  # Or 1.weeks.from_now
```

## Notifications

ActiveSupport::Notifications one is a pub/sub implementation for sending and subscribing to notifications across your application.

It allows responding to events related to file attachments by subscribing to these notifications and even more like tracking user activity or integrating with other services.

```ruby
ActiveSupport::Notifications.subscribe('user.created') do |*args|
  event = ActiveSupport::Notifications::Event.new(*args)
  puts "User created: #{event.payload[:user].id}"
end

ActiveSupport::Notifications.instrument(
  'user.created', user: @user)
```

## Autoload

ActiveSupport::Autoload is the one that manages the automatic loading and reloading of constants during the app's runtime.

It's also used for eager loading by pre-loading the class before the first time of use (e.g., autoload :User)

```ruby
# somewhere in the app.
subscribers = User.where(subscribed: true)
# ActiveSupport::Dependencies auto-loads 'user.rb'
empty_stocks = Product.where(stock_count: 0)
                .select(:name)
                .distinct
# Same with 'product.rb'
```
