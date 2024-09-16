---
author: Mahmoud Bakr
pubDatetime: 2024-09-16T01:45:00Z
modDatetime: 2024-09-16T02:12:00Z
title: Single Table Inheritance
slug: single-table-inheritance
featured: false
draft: false
tags:
  - Ruby
  - ActiveRecord
  - Database
  - Schema
description: >
  Understand STI (Single Table Inheritance) in Ruby on Rails and how to implement it with practical examples.
canonicalURL: https://www.linkedin.com/posts/m-bakr_sti-ruby-on-rails-activity-6965721930884616192-pCbS?utm_source=share&utm_medium=member_desktop
---

Single Table Inheritance (STI) is a powerful feature in Ruby on Rails that allows multiple models to share the same database table, reducing redundancy and improving code organization. In this article, we'll explore the concept of STI, walk through a practical example, and discuss when and why you should use it.

## Table of contents
## Introduction
In Rails, Single Table Inheritance (STI) lets multiple models inherit from a parent class while sharing the same database table. This is achieved by adding a `type` column to the table, which tells ActiveRecord which subclass a particular record belongs to. STI helps avoid creating multiple tables for similar models, simplifying your database schema and improving performance.

## STI Example
Imagine we have a `Company` model that manages different types of cars, and we want to categorize these cars into sports cars and luxury cars, all while storing them in the same table. STI makes this possible without the need for multiple tables, allowing us to distinguish between car types using the `type` column.

```ruby
class Company < ApplicationRecord
  has_many :cars
end
```

### Create the `Car` model
Next, we define a parent `Car` model:

```ruby
class Car < ApplicationRecord
	belongs_to :company
end
```

This sets up the basic relationship between companies and cars. However, we still need a way to specify different car types.

### Create subclasses of the `Car` model
We can now create subclasses for different types of cars, like sports cars and luxury cars, which will inherit from the `Car` model:

```ruby
# sport_car.rb
class SportsCar < Car
end

# luxury_car.rb
class LuxuryCar < Car
end
```

At this point, both `SportsCar` and `LuxuryCar` models are tied to the `cars` table, and the `type` column will help differentiate between the two.

### Update the `Company` model relationships

```ruby
class Company < ApplicationRecord
	has_many :cars

	has_many :sports_cars
	has_many :luxury_cars
end
```

This structure allows us to easily retrieve all cars of a specific type that belong to a company.

### Schema
After setting up STI, here’s what the database schema will look like:

```ruby
ActiveRecord::Schema[7,0].define(version: some_version_here) do
	create_table "cars", force: :cascade do |t|
		t.string "type" # The 'type' column distinguishes the subclass (e.g., SportsCar, LuxuryCar). You can add as many as you need!
		t.string "name"
		t.string "model"
		t.integer "price"
		t.integer "company_id", null: false
		t.datetime "created_at", null: false
		t.datetime "updated_at", null: false
		t.index ["company_id"], name: "index_cars_on_company_id"
	end

	create_table "companies", force: :cascade do |t|
		t.string "name"
		t.string "location"
		t.datetime "created_at", null: false
		t.datetime "updated_at", null: false
	end

	add_foreign_key "cars", "companies"
end
```

Notice the type column in the cars table—it’s key to implementing STI, as it tells Rails which subclass a particular record belongs to.

### Testing in Rails Console
To see this in action, let's jump into the Rails console. Follow these steps:

- Create a new company record:

`chevrolet = Company.create(name: 'Chevrolet', location: 'Some location')`

- Add a new sports car for the Chevrolet company:

`chevrolet.sports_cars.create(name: 'Corvette', model: 'STINGRAY 2LT COUPE', price: 80000)`

- List all sport cars for Chevrolet:

`chevrolet.sports_cars`

This will return all records where the `type` is `SportsCar`.

- Try listing luxury cars:

`chevrolet.luxury_cars`

This will return an empty array if no luxury cars are associated with Chevrolet.

- Check all cars for Chevrolet, regardless of type:

`chevrolet.cars`

This will return all car records for the company, both sports and luxury.

## When to use STI?
STI is a great solution when:

- All models share the same attributes (columns), and only a few fields, like type, differ between them.
- You want to reduce the complexity of your database schema by avoiding multiple tables for similar models.

However, if the models diverge too much in behavior or fields, STI might not be the best fit.

## Benefits of STI

- **Code simplicity**: Since all models share the same table, your code becomes easier to maintain and understand.
- **DRY principle**: You avoid duplicating code by having shared logic in the parent class.
- **Efficient schema**: You can handle multiple models with a single table, reducing the need for extra migrations.

## Conclusion
Single Table Inheritance (STI) is a powerful tool in Rails that simplifies your schema and helps you write DRY, maintainable code. It’s a great fit when you have models that share the same attributes and can be easily differentiated by type. As with any pattern, use it when it makes sense for your application's data structure.

Thank you for reading, and happy coding!