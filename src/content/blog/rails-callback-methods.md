---
author: Mahmoud Bakr
pubDatetime: 2025-02-08T10:00:00Z
title: Rails Callback Methods
slug: rails-callback-methods
featured: false
draft: false
tags:
  - Rails
  - Ruby
  - ActiveRecord
description: >
  A reference guide to Rails ActiveRecord callback methods including before, after, and around callbacks for create, save, update, destroy, and validation lifecycle events.
---

## Table of contents

## before_create

It gets called on an ActiveRecord entity right before it's created and saved in the database.

```ruby
class User < ApplicationRecord
  before_create :set_default_role

  private

  def set_default_role
    self.role = "user"
  end
end
```

## after_create

It gets called on an ActiveRecord entity right after it's created and saved in the database.

```ruby
class User < ApplicationRecord
  after_create :send_welcome_email

  private

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end
end
```

## before_save

It gets called on an ActiveRecord entity right before it's only saved in the database. This could happen before creating or updating the record.

```ruby
class User < ApplicationRecord
  before_save :downcase_email

  private

  def downcase_email
    self.email = email.downcase
  end
end
```

## after_save

It gets called on an ActiveRecord entity right after it's only saved in the database. This could happen after creating or updating the record.

```ruby
class User < ApplicationRecord
  after_save :log_changes

  private

  def log_changes
    Rails.logger.info "User #{id} was saved"
  end
end
```

## before_destroy

It gets called on an ActiveRecord entity right before it's destroyed and removed from the database.

```ruby
class User < ApplicationRecord
  before_destroy :check_admin

  private

  def check_admin
    throw(:abort) if admin?
  end
end
```

## after_destroy

It gets called on an ActiveRecord entity right after it's destroyed and removed from the database.

```ruby
class User < ApplicationRecord
  after_destroy :notify_admin

  private

  def notify_admin
    AdminMailer.user_deleted(self).deliver_later
  end
end
```

## before_update

It gets called on an ActiveRecord entity right before it's updated and saved in the database.

```ruby
class User < ApplicationRecord
  before_update :archive_old_email

  private

  def archive_old_email
    self.previous_email = email_was if email_changed?
  end
end
```

## after_update

It gets called on an ActiveRecord entity right after it's updated and saved in the database.

```ruby
class User < ApplicationRecord
  after_update :notify_email_change

  private

  def notify_email_change
    UserMailer.email_changed(self).deliver_later if saved_change_to_email?
  end
end
```

## before_validation

This callback is triggered just before the validation process starts. You can use it to modify attributes or perform actions that prepare the object for validation.

```ruby
class User < ApplicationRecord
  before_validation :strip_whitespace

  private

  def strip_whitespace
    self.name = name.strip if name.present?
  end
end
```

## after_validation

This callback is triggered just after the validation process ends.

```ruby
class User < ApplicationRecord
  after_validation :log_errors

  private

  def log_errors
    Rails.logger.warn errors.full_messages.join(", ") if errors.any?
  end
end
```

## around_create

This callback is wrapped around the create action. It's executed before and after the record is created and saved in the database.

```ruby
class User < ApplicationRecord
  around_create :wrap_with_transaction

  private

  def wrap_with_transaction
    ActiveRecord::Base.transaction { yield }
  end
end
```

## around_save

This callback is wrapped around the save action. It's executed before and after the record is created or updated and saved in the database.

```ruby
class User < ApplicationRecord
  around_save :log_save_duration

  private

  def log_save_duration
    start = Time.now
    yield
    Rails.logger.info "Save took #{Time.now - start}s"
  end
end
```

## around_update

This callback is wrapped around the update action. It's executed before and after the record is updated and saved in the database.

```ruby
class User < ApplicationRecord
  around_update :track_update_time

  private

  def track_update_time
    start = Time.now
    yield
    Rails.logger.info "Update took #{Time.now - start}s"
  end
end
```

## around_destroy

This callback is wrapped around the destroy action. It's executed before and after the record is destroyed and removed from the database.

```ruby
class User < ApplicationRecord
  around_destroy :log_destroy

  private

  def log_destroy
    Rails.logger.info "Destroying user #{id}"
    yield
    Rails.logger.info "User #{id} destroyed"
  end
end
```
