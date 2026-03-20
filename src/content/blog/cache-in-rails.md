---
author: Mahmoud Bakr
pubDatetime: 2025-01-25T10:00:00Z
title: Cache In Rails
slug: cache-in-rails
featured: true
draft: false
tags:
  - Rails
  - Ruby
  - Caching
description: >
  An overview of caching strategies in Rails including page, action, fragment caching, cache expiration, and different cache stores like Redis, in-memory, and file store.
---

## Table of contents

## Page Caching

Cache entire responses for endpoints with static content. It's simple but powerful when the data doesn't change often.

```ruby
# config/environments/production.rb
config.action_controller.perform_caching = true
config.action_controller.page_cache_directory = "#{Rails.root.to_s}/public/deploy"
```

## Action Caching

Cache responses while still running essential filters like authentication. This is great for authenticated APIs that return data frequently.

```ruby
class ProductsController < ApplicationController
  before_action :authenticate_user!

  caches_action :index, cache_path: Proc.new { |c| c.params }

  def index
    @products = Product.all
    render json: @products
  end
end
```

## Fragment Caching

Cache specific parts of the response, such as product details that don't change often, while allowing other parts, like user data, to remain dynamic.

```ruby
class ProductsController < ApplicationController
  def show
    @product = Product.find(params[:id])
    @user = current_user

    render json: {
      product: Rails.cache.fetch(
        "product/#{@product.id}"
      ) { @product.as_json },
      user: @user.as_json
    }
  end
end
```

## Cache Expiration

Ensure your API serves fresh data by expiring caches when the underlying data changes. For example, invalidate the product cache when a product is updated.

```ruby
class ProductsController < ApplicationController
  def update
    @product = Product.find(params[:id])
    if @product.update(product_params)
      Rails.cache.delete("product/#{@product.id}")
      render json: @product
    else
      render json: @product.errors, status: :unprocessable_entity
    end
  end
end
```

## Redis Store

For more robust caching, especially in production environments, consider using Redis or Memcached.

```ruby
# config/environments/production.rb
config.cache_store = :redis_cache_store, { url: ENV['REDIS_URL'] }

# Example usage in a controller
Rails.cache.fetch("product/#{product.id}", expires_in: 12.hours) do
  product.to_json
end
```

## In-Memory Store

Location: The cache is stored in the server's memory (RAM)

Use case: This is the default in development environments because it's simple and fast but not persistent and will be cleared when the server restarts.

```ruby
# config/environments/development.rb
config.cache_store = :memory_store
```

## File Store

Location: The cache is stored as files on the disk, typically in your Rails application's tmp/cache directory.

Use case: Useful for small-scale applications or for a simple, persistent caching mechanism.

```ruby
# config/environments/development.rb
config.cache_store = :file_store, "#{Rails.root.to_s}/tmp/cache/"
```

## Monitor & Debug

Keep an eye on cache hits and misses in your logs to fine-tune your strategy.

```ruby
# config/environments/production.rb
config.log_tags = [:cache]
```
