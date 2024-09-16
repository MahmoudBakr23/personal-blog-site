---
author: Mahmoud Bakr
pubDatetime: 2024-09-14T16:22:00Z
modDatetime: 2024-09-15T17:21:00Z
title: Higher Order Functions in Ruby
slug: higher-order-functions-in-ruby
featured: false
draft: false
tags:
  - Ruby
description: >
  A simple article to understand higher-order functions in Ruby, covering blocks, procs, and lambdas with practical examples.
canonicalURL: https://www.linkedin.com/posts/m-bakr_higher-order-functions-activity-6993110708833947648-kiRf?utm_source=share&utm_medium=member_desktop
---

Higher-order functions (also referred to as higher-order methods in Ruby) are essential concepts that allow you to write flexible, reusable code. These functions can accept other functions as arguments or return them as a result. In Ruby, blocks, procs, and lambdas are central to implementing higher-order functions. This article provides a step-by-step explanation of each, helping you master how to use them effectively in your code.

## Table of contents
## Introduction
Higher-order functions (or methods) allow us to pass functions as arguments or return them from other functions. In Ruby, this functionality is mainly implemented through blocks, procs, and lambdas, each with its own unique behavior. Let's walk through these concepts, with examples to illustrate how they work.

## Blocks
Blocks in Ruby are nameless methods that can be passed to other methods as a parameter. While blocks are not objects in Ruby (unlike everything else), they play a significant role in defining higher-order methods. Here’s what you should know:

- Blocks can't be saved in variables, but they can be passed to methods.
- Inside a method, we use the `yield` keyword to call a block.

```ruby
def some_method(a, *rest)
  yield(a, rest)
end

print some_method(1, 1,2,3,4,5) 
{ # Block starts here
  |a, rest| rest.include?(a) ? true : false
} # Block ends here

# Output: true
```

In the example above, `some_method` takes an argument a and a splat parameter `*rest`, which collects additional arguments into an array. The block, passed when calling the method, is executed using `yield`.

> The splat parameter `*rest` allows multiple arguments to be captured into a single array.

Let’s look at a simpler block example:

```ruby
def greeting
	puts "Hello!"
	
	yield if block_given? # Only call the block if one is passed
	
	puts "Goodbye!"
end

greeting { puts "I am a block!" }
# Output:
# Hello!
# I am a block!
# Goodbye!
```

In this example, `greeting` behaves differently depending on whether a block is passed. Using `block_given?` ensures the method can execute normally even without a block.

## Procs
Now that we’ve covered blocks, let’s dive into procs. A proc (short for procedure) is essentially a saved block that can be stored in variables and passed around as an object.

- Procs are objects, unlike blocks.
- They can be stored in variables and passed to methods.
- Procs don't strictly enforce the number of arguments passed.

```ruby
def some_method(my_proc, a, *rest)
	my_proc.call(a, rest)
end

example = proc {
	|a, rest| rest.keep_if { |e| e >= a }
} # Proc object stored in the example variable

print some_method(example, 5, 2,4,6,8)
# Output: [6, 8]
```

In this case, the `example` proc is passed to the method, where it is called to filter out values from the `rest` array that are less than `a`.

> The `keep_if` method modifies the array in place, keeping only elements that satisfy the given condition.

## Lambdas
Lambdas in Ruby are objects of the Proc class, but they differ from procs in some key aspects:

- Lambdas **do** enforce the number of arguments passed to them.
- Lambdas are declared using either `lambda` or `->`.
- To invoke a lambda, use the `call` method or the shorthand `.()`.

```ruby
def some_method(a, b, *rest)
	-> { rest.push(a, b) } # Lambda to push arguments to the rest array
end

example = some_method("anonymous", "functions", "Lambdas are").call # OR .()
# Output: ["Lambdas are", "anonymous", "functions"]
```

This example showcases the use of a lambda to modify the `rest` array by adding additional elements. It enforces the exact number of arguments (`a` and `b`) when called.

## Conclusion
Higher-order functions give your Ruby code more flexibility and reusability. By mastering blocks, procs, and lambdas, you can pass around behaviors and manipulate data with greater control and fewer lines of code. Whether you're working with basic control structures or more complex algorithms, understanding how these components work will help you build more elegant and efficient solutions.

Thank you for reading, and happy coding!