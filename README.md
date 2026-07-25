# Waypoint 🧭

> **Meet people through plans, not profiles.**

Waypoint is a mobile platform rethinking how adults form meaningful friendships after university, relocation, or simply the slow drift of growing up. Instead of asking you to scroll through strangers, Waypoint asks a simpler question: *where are you going?*

Log your plans. Browse what others are doing. Show up. The friendships follow.

[![TestFlight](https://img.shields.io/badge/iOS-TestFlight%20Beta-blue?logo=apple)](https://testflight.apple.com/join/fhUJQEHd)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey)](https://usewaypoint.app)
[![Built with Expo](https://img.shields.io/badge/built%20with-Expo%20SDK%2053-black?logo=expo)](https://expo.dev)
[![Supabase](https://img.shields.io/badge/backend-Supabase%20%2B%20PostgreSQL-green?logo=supabase)](https://supabase.com)

---

## The Problem Worth Solving

Loneliness among adults is a public health crisis, and it is the reason Waypoint exists. The existing solutions — dating apps repurposed for friendship, event platforms for passive browsing, group chats that go cold — all address isolated moments. None manage the full arc from *first encounter* to *lasting connection*.

The root cause is structural: most social apps optimise for the swipe, not the relationship. They generate meetings. They don't generate friendships.

Waypoint was built to fix that.

---

## The Social Momentum Engine

The **Social Momentum Engine** is the system at the centre of Waypoint — four components that between them address the complete friendship lifecycle, not just the introduction.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOCIAL MOMENTUM ENGINE                        │
├─────────────────┬──────────────────┬───────────────┬────────────┤
│  Chemistry      │  Auto-Generate   │  Pulse        │ Confidence │
│  Matching       │                  │  Monitor      │ Layer      │
├─────────────────┼──────────────────┼───────────────┼────────────┤
│ Multi-signal    │ Detects clusters │ Tracks        │ Graduated  │
│ compatibility   │ of compatible    │ engagement    │ exposure:  │
│ scoring using   │ users and auto-  │ health per    │ group →    │
│ interests,      │ creates plans    │ friendship.   │ friend     │
│ geography,      │ when no activity │ Flags drift   │ request →  │
│ date overlap,   │ exists in their  │ before users  │ DMs        │
│ and behavioural │ city             │ disengage     │            │
│ data            │                  │               │            │
└─────────────────┴──────────────────┴───────────────┴────────────┘
```

Each component feeds data into the others. The system compounds: every activity attended, every message exchanged, every friendship formed generates new behavioural signal that refines future group composition.

The platforms surveyed during design each address a single phase of the friendship journey — introduction, or scheduling, or messaging. This system was designed to connect them.

---

## Architecture Overview

Waypoint is a full-stack mobile platform with a single maintainer. Every architectural, schema and system-design decision below is mine. The scope:

| Layer | Stack |
|-------|-------|
| Mobile Client | React Native (Expo SDK 53), TypeScript, Expo Router |
| Backend | Supabase (PostgreSQL), Custom REST API |
| Real-time | WebSockets — group chat, DMs, typing indicators, read receipts |
| Geospatial | Mapbox GL — geocoding, reverse geocoding, proximity matching |
| Matching | Custom weighted compatibility algorithm |
| Auth | Supabase Auth + Apple Sign-In + Google Sign-In |
| Payments | RevenueCat subscription management |
| Notifications | Expo Push Notifications |
| Media | Client-side compression, CDN caching |
| Deployment | EAS Build + Submit, OTA updates |

### By the numbers

Every figure below is countable from this repository at the current commit.

```
39     route files (file-based routing)
14     onboarding steps capturing interests, location, scheduling preferences
24     relational database tables
38     client-callable PostgreSQL RPC functions
76     incremental schema migrations
 4     Deno edge functions (auto-generate, lifecycle-runner, 2 payment webhooks)
165    curated activity templates in the quest catalog
 1     maintainer
```

### Database Architecture

The PostgreSQL schema coordinates multiple interconnected systems simultaneously — user identity, activity management, group formation, real-time messaging, friendship state, geospatial data, and privacy controls. Row-level security enforces data isolation at the database engine level, not the application layer. Every query is automatically filtered by the requesting user's identity.

Building the security layer alone required resolving recursive policy evaluation — where security rules referenced tables whose own security rules referenced the original tables — across 8 iterative migrations.

### Matching System

The compatibility scoring algorithm weighs:
- Shared interest categories (23 available)
- Geographic proximity
- Date range overlap for upcoming plans
- Meeting preferences (open, same gender, etc.)
- Language compatibility
- Historical interaction patterns (compounding over time)

This combination of contextual signals — visit intentions alongside behavioural preference data — is the foundation of the Chemistry Matching component.

---

## Key Features

- **Activity Discovery** — Browse trending plans, popular activities, and new visits in your city
- **Plan Creation** — Create small-group activities with structured attendance and participation workflows
- **People Discovery** — Suggested users matched by compatibility scoring
- **Real-time Messaging** — Group chats auto-created per activity, DMs unlocked through accepted friend requests
- **Geospatial Exploration** — Interactive map with user clusters, location search, and proximity matching
- **13-step Onboarding** — Rich data capture for genuine compatibility from the first session
- **Confidence Layer** — Graduated social exposure designed to reduce friction in early connection
- **Dark Mode** — Full dark/light theme support with system preference detection

---

## Why the source is readable

Waypoint is a commercial product, not an open-source project — the code is
proprietary and not licensed for reuse. The repository is readable because the
engineering decisions behind it are worth being able to inspect: the schema, the
row-level security model, the compatibility scoring, and the record of how each
of them changed and why.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- EAS CLI (`npm install -g eas-cli`)
- Supabase account
- Mapbox account

### Installation

```bash
git clone https://github.com/suleimanodetoro/meetup.git
cd meetup
npm install
```

### Environment Setup

Create a `.env` file in the root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
MAPBOX_DOWNLOAD_TOKEN=your_mapbox_download_token
```

### Run locally

```bash
npx expo start
```

---

## Project Status

Waypoint is in **active alpha**. Core systems are live and have been validated with real users through TestFlight. The platform is pre-public-launch.

**Try the beta:** [testflight.apple.com/join/fhUJQEHd](https://testflight.apple.com/join/fhUJQEHd)

**Website:** [usewaypoint.app](https://usewaypoint.app)

---

## Roadmap

- [ ] Public App Store launch
- [ ] Android Play Store submission
- [ ] Auto-Generate component activation (requires user density threshold)
- [ ] Pulse Monitor rollout
- [ ] Web companion app
- [ ] API documentation

---

## Built By

**Suleiman Odetoro** — Software Engineer, Founder

Built while employed full-time as a QA Engineer. MSc Software Engineering with Distinction, Leeds Beckett University.

[usewaypoint.app](https://usewaypoint.app) · [LinkedIn](https://linkedin.com/in/suleimanodetoro)

---

## License

**No licence is granted.** © 2025–2026 Suleiman Odetoro. All rights reserved.

The source is public to read. It is not licensed for use, modification or
redistribution, and no contributions are being accepted.

---

*Waypoint exists because adult friendship is harder than it should be, and that's worth fixing.*