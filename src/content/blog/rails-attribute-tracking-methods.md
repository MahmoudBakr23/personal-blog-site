---
author: Mahmoud Bakr
pubDatetime: 2025-02-22T10:00:00Z
title: Rails Attribute Tracking Methods
slug: rails-attribute-tracking-methods
featured: false
draft: false
tags:
  - Rails
  - Ruby
  - ActiveRecord
description: >
  An overview of Rails attribute tracking methods for monitoring changes to ActiveRecord model attributes before and after save operations.
---

## Table of contents

## saved_change_to_*?

This method is used to get an attribute's old and new values. If '?' is added at the end of it, it'll return a boolean value on whether or not this attribute has changed and is saved in the database.

```ruby
user = User.find(13421)
user.email
# "old_email@example.com"
user.email = "new_email@example.com"
user.save
user.saved_change_to_email
# [ "old_email@example.com", "new_email@example.com" ]
user.saved_change_to_email?
# true
```

## saved_changes

The saved_changes method is useful for after_filters because it returns a hash of all the saved changes in an attribute. saved_changes? returns a boolean if any attribute has changed or not.

```ruby
user = User.find(13421)
user.email
# "old_email@example.com"
user.email = "new_email@example.com"
user.save
user.saved_changes
# { "email" => [ "old_email@example.com", "new_email@example.com" ] }
user.saved_changes?
# true
```

## changes_to_save

This method is useful for the before_filters. It returns a hash of the old and new values that will be persisted in the next save operation of the record.

```ruby
user = User.find(13421)
user.email
# "old_email@example.com"
user.email = "new_email@example.com"
user.changes_to_save
# { "email" => [ "old_email@example.com", "new_email@example.com" ] }
user.save
user.changes_to_save
# {}
```

## has_changes_to_save?

It's a checker for the changes_to_save method because it checks if the record has any attributes about to be changed in the next save operation.

```ruby
user = User.find(13421)
user.email
# "old_email@example.com"
user.email = "new_email@example.com"
user.has_changes_to_save?
# true
user.save
user.has_changes_to_save?
# false
```

## will_save_change_to_*?

This method is similar to has_changes_to_save? method but for only a specific attribute that's expected to be changed in the next save operation.

```ruby
user = User.find(13421)
user.email
# "old_email@example.com"
user.email = "new_email@example.com"
user.will_save_change_to_email?
# true
user.will_save_change_to_name?
# false
```

## *_change_to_be_saved

It's the relative method to will_save_change_to_*? and it returns the old and new values of an attribute before it's saved.

```ruby
user = User.find(13421)
user.email
# "old_email@example.com"
user.email = "new_email@example.com"
user.email_change_to_be_saved
# [ "old_email@example.com", "new_email@example.com" ]
user.name_change_to_be_saved
# nil
```

## *_in_database

This method gets the value of an attribute that is currently saved in the database. Calling the attribute directly on the instance gets the current value even if it's unsaved (e.g., `user.email`)

```ruby
user = User.find(13421)
user.email_in_database
# "old_email@example.com"

user.email = "new_email@example.com"
user.save

user.email_in_database
# "new_email@example.com"
```

## *_before_last_save

This method gets the previous value of an attribute before the last save operation in the database.

```ruby
user = User.find(13421)
user.email
# "old_email@example.com"

user.email = "new_email@example.com"
user.save

user.email_before_last_save
# "old_email@example.com"
```
