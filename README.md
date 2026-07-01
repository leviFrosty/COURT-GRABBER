# COURT-GRABBER

COURT-GRABBER looks up available courts for selected time, prioritizes selecting the desired court, and books said court when it becomes available, instantly.

With COURT-GRABBER there is no more fighting over being the fastest person to click a button on a screen.

You will always get a court at the desired time, if there ever is any available.

I built this for me targeting a very specific scheduling api, this isn't intended for general use!

## Prerequisites

1. Install [Bun](https://bun.sh/docs/installation)
1. Setup [.env](./.env) with following items:
   - `username` - Credentials
   - `password` - Credentials
   - `loginEndpoint` - API endpoint for submitting credentials
   - `availabilityEndpoint` - API endpoint for fetching court availability
   - `submitEndpoint` - API endpoint for submitting court reservation

## Get Started

Run in terminal `bun run start`

## Why does this program exist?

The place I play tennis has an annoying court reservation system that forces you to gamble on getting your court at a specific time making everyone fight for a reservation in a free-for-all manner once a certain time strikes. COURT-GRABBER solves this issue by calling these APIs directly the second they become available and programmatically handles getting a court for me. Sorry other tennis players, I'm selfish.
