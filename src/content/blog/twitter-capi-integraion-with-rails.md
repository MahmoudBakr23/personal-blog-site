---
author: Mahmoud Bakr
pubDatetime: 2024-07-18T15:22:00Z
modDatetime: 2024-09-14T15:21:00Z
title: Twitter API Conversion & Integration Guide with Ruby on Rails
slug: twitter-api-conversion-integration-guide-with-rails
featured: true
draft: false
tags:
  - Ruby on Rails
  - Twitter API
  - Conversion API
  - X
description: >
  A step-by-step guide for integrating the Twitter Conversion API with Ruby on Rails, including setup, configuration, and handling data.
canonicalURL: https://mbakr6821.medium.com/twitter-api-conversion-integration-guide-with-ruby-on-rails-d7af6719614e
---

Integrating a server-side API with platforms like Facebook, Twitter (now known as X), or TikTok is crucial in expanding your business. Whether you’re a seller aiming to broaden your market reach, maximize your product’s exposure, or monitor customer activities on your website, this integration can significantly boost your business development efforts.

## Table of contents
## Introduction
Not all APIs are designed with user-friendliness in mind, making it challenging for developers to accomplish their tasks efficiently. When we embarked on our Ruby on Rails server-side integration with the Twitter API Conversion at [Tadarab](https://tadarab.com/), we were overwhelmed by the extensive documentation and unsure where to begin. So, I’m here to provide you with a concise yet comprehensive guide, complete with code examples and references. 

## Setting up a Twitter Developer Account
First, you’ll need to create a developer account on Twitter. Head over to their [website](https://developer.x.com/en) and sign up for a new account. If you’re working for a company, be sure to use your company email for the registration. Once you’ve successfully signed up for your new developer account, navigate to the sidebar and select the “Projects & Apps” option. Here, you’ll create a project that will link your server to your company’s ads account or yours.

> Your company or you should set up an [ads account](https://business.x.com/en/help/account-setup/ads-account-creation.html) to manage campaigns and track user events. Keep in mind that after submitting your application, it might take a few days for Twitter to review.

### Generating API Tokens
We’re almost halfway there. Go back to your developer account, and follow these steps:
1. Open the new project and app you just created.
2. Click on the “Keys and tokens” button.

> Twitter uses OAuth, which requires several tokens: API Key, API Secret, Access Token, and Access Token Secret.

3. Click the “Generate” button to create your tokens.
> Make sure to save them in a safe place, as they won’t be displayed again.

## Getting Rails API app ready
Now that we have our tokens, we’re ready to write some code. Open your editor and navigate to the Rails project where you want to integrate the API Conversion. Start by creating a new folder called ‘analytics’ or any name you prefer. I find it helpful to have everything neatly structured for easy reading and navigation.

Inside the ‘analytics’ directory, create a new file for the Twitter Conversion API class. I named mine ‘twitter_capi.rb’.

This file will handle server-side requests to the Twitter ads account. To manage request authentication, I used the ‘oauth’ Ruby gem. We’ll store the four authentication tokens in the environment variables file ‘.env’ and reference them in this class file.

```ruby
require 'oauth'

module Analytics
  class TwitterCapi
    CONSUMER_KEY = ENV['TWITTER_API_KEY'] #API KEY
    CONSUMER_SECRET = ENV['TWITTER_API_SECRET_KEY'] #API SECRET
    ACCESS_TOKEN = ENV['TWITTER_ACCESS_TOKEN'] #ACCESS KEY
    ACCESS_TOKEN_SECRET = ENV['TWITTER_ACCESS_SECRET_TOKEN'] #ACCESS SECRET
  end
end
```

Remember, the variable names can be anything you prefer. Now that we have our authentication tokens ready, let’s initialize the connection between our server and the Twitter API.

```ruby
require 'oauth'

module Analytics
  class TwitterCapi
    CONSUMER_KEY = ENV['TWITTER_API_KEY'] #API KEY
    CONSUMER_SECRET = ENV['TWITTER_API_SECRET_KEY'] #API SECRET
    ACCESS_TOKEN = ENV['TWITTER_ACCESS_TOKEN'] #ACCESS KEY
    ACCESS_TOKEN_SECRET = ENV['TWITTER_ACCESS_SECRET_TOKEN'] #ACCESS SECRET

    def initialize
      @consumer = OAuth::Consumer.new(CONSUMER_KEY, CONSUMER_SECRET, site: 'https://ads-api.twitter.com', signature_method: 'HMAC-SHA1')
      @access_token = OAuth::AccessToken.new(@consumer, ACCESS_TOKEN, ACCESS_TOKEN_SECRET)
    end
  end
end
```

The ‘@access_token’ instance variable will be used later to fire the event request to the Twitter API.

## Twitter (X) Conversion API Payload
Now we’re ready to dive into the specifics of the data that will be sent to Twitter. I’ll guide you directly to the essential page in the API documentation, where you’ll find the resource URL and details about the required and optional data that the Twitter API expects in the request payload.

One key piece of data is the ‘pixel_id’, a 5-character Universal Website Tag specific to an ad account. After Twitter approves your ads account request.

> If it’s your company’s account, ask your manager to send you an invitation with an admin role.

For quick reference, here’s a general outline of the data structure and steps:
1. Resource URL: This is the endpoint where you’ll send your requests. You’ll find it in the Twitter API documentation.
2. Required Data: Includes fields like ‘pixel_id’, ‘event_name’, ‘event_time’, and other necessary details specific to your integration.
3. Optional Data: Additional fields that you can include to enhance your tracking and reporting.

### Steps to Create Event Source and Get PIXEL_ID
I'm assuming you got the ads account approved by Twitter (X).

1. Login to the ads account [here](https://ads.twitter.com).
2. Navigate to ‘Tools’ from the navbar.
3. Select ‘Events Manager’ and hit the ‘Create Event Source’ button create a new event source if you don't have one.
4. Once created, you'll find the `PIXEL_ID` displayed.

### Firing Your First Event
Now, let’s use that `PIXEL_ID` to fire our first event to the Twitter API. Keep in mind the other required data we talked about above

```ruby
require 'oauth'

module Analytics
  class TwitterCapi
    CONSUMER_KEY = ENV['TWITTER_API_KEY'] #API KEY
    CONSUMER_SECRET = ENV['TWITTER_API_SECRET_KEY'] #API SECRET
    ACCESS_TOKEN = ENV['TWITTER_ACCESS_TOKEN'] #ACCESS KEY
    ACCESS_TOKEN_SECRET = ENV['TWITTER_ACCESS_SECRET_TOKEN'] #ACCESS SECRET

    def initialize
      @consumer = OAuth::Consumer.new(CONSUMER_KEY, CONSUMER_SECRET, site: 'https://ads-api.twitter.com', signature_method: 'HMAC-SHA1')
      @access_token = OAuth::AccessToken.new(@consumer, ACCESS_TOKEN, ACCESS_TOKEN_SECRET)
    end

    def fire_event(payload)
      request = @access_token.post("/11/measurement/conversions/pixel_id_here", # Resource URL
                              payload.to_json,
                              'Content-Type' => 'application/json')
    end
  end
end
```

## Tracking Events in Rails Controllers
With the `TwitterCAPI` class ready, we're almost there! Now let's use the `fire_event` method to send a request with your desired data to the Twitter API.

If you want to track users who visit specific products on your e-commerce site, such as books, you can integrate the `TwitterCAPI` class into your `BooksController` to send tracking events.

```ruby
class BooksController < ApplicationController
  def index
    @books = Book.all
  end

  def show
    @book = Book.find(params[:id])
  end

  # other methods...

  private
  # private methods here
end
```

We want to track the most visited books, we’ll fire the event with the shown book’s data in the request payload as follows. Take a closer look to the payload in the given code below because there you'll find both the required and optional data you might need.

```ruby
class BooksController < ApplicationController
  def index
    @books = Book.all
  end

  def show
    @book = Book.find(params[:id])

    payload = {
      conversions: [
        conversion_time: Time.now.utc.strftime("%Y-%m-%dT%H:%M:%S.%LZ"), # This is the time format Twitter expects
        event_id: "tw-s19t9-kor2f", # This is the event_id that you get from the ads account events manager page for this case, the event will be "Content View", and you can create as many events as you want.
        identifiers:[
          {
            #here the user's data such as email, phone, ip, etc
          }
        ],
        price_currency: 'USD',
        value: 250.0, # Twitter expects integers to be float
        conversion_id: "unique_number_here", # This is for deduplication option if you plan to send requests from both backend and frontend
        contents:[
          content_id: @book.id.to_s, # Required to be string
          content_price: @book.price.to_f, # Float because it's a number
          num_items: 1 # Number of items shown in the viewed page
        ]
      ]
    }
    Analytics::TwitterCapi.new.fire_event(payload)
  end

  # other methods...

  private
  # private methods here
end
```
Of course, this is just an explanatory example, now imagine you can fire events when content is viewed, users signups, payments captured, etc.

You can refactor the method in the application controller or helper and reuse it whenever you want across all your API application files.

To understand more about the deduplication, please read about it [here](https://developer.x.com/en/docs/x-ads-api/measurement/web-conversions/conversion-api#:~:text=If%20you%20use%20both%20pixel%20and%20Conversion%20API%20for%20the%20same%20event).

## Conclusion
If you made it till here, you’re the hero! Thank you very much for reading.
Stay tuned for the TikTok Conversion API integration guide!