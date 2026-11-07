[README.md](https://github.com/user-attachments/files/34526685/README.md)
# ClueMate

**Think together.**

ClueMate is a real-time group voting app designed for situations such as an external viva, quiz, or team decision. Participants independently allocate confidence across answer options, commit their response, and see the room's live consensus. A room operator can advance the group to the next poll and end the session.

> **Project status:** This README documents the current project architecture and intended app behavior. Verify multi-device Realtime synchronization and room-ending behavior in your environment before relying on them in a live session.

## Features

- **Create and join rooms:** An operator creates a room and participants join using a room code.
- **Confidence allocation:** Distribute confidence across options A, B, C, and D in 25% increments.
- **Explicit commit:** Draft changes do not count until the participant commits. Participants can recommit to replace their previous response.
- **Don't Know response:** Submit a separate “Don't Know” response without treating it as an answer option allocation.
- **Live room state:** Supabase is used to synchronize room and poll state across clients.
- **Leader indicator:** The intended experience highlights the globally leading option with a rotating dotted border and a subtle matching glow. It should be driven by committed responses from the active poll—not a participant's own draft.
- **Operator controls:** The operator can advance the poll and end the room; these actions should not be available to ordinary participants.
- **Dark, mobile-first interface:** A minimal dark theme with distinct colors for each option.

## Tech stack

- **App:** React Native, Expo, TypeScript
- **Navigation:** Expo Router
- **Backend:** Supabase
- **Data and authentication:** Supabase Auth, PostgreSQL, Row Level Security (RLS), database functions/RPCs
- **Live updates:** Supabase Realtime
- **State management:** Zustand
- **Secure storage:** Expo SecureStore on native platforms, with web storage support for web builds
- **Tests and validation:** TypeScript, `tsx` allocation tests, Expo Doctor

## Requirements

- Node.js and npm versions supported by the Expo SDK used by this project
- A Supabase project
- Expo Go or a suitable simulator/device for mobile testing

## Getting started

### 1. Install dependencies

Clone or open the project, then run these commands from the project root:

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root. You can start from `.env.example` if it exists.

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Get the project URL and public client key from your Supabase project settings.

**Security:** Never put a Supabase `service_role` key in an Expo app or any `EXPO_PUBLIC_` variable. Client-side values are bundled into the application; use the public key together with correctly configured RLS policies.

### 3. Set up Supabase

The project includes a migration at:

```text
supabase/migrations/20261107000000_initial_schema.sql
```

Review the migration and the current database state before applying it. If the migration has not already been applied, run it through the Supabase SQL Editor or your team's normal migration workflow. Do not blindly rerun it against an existing database.

The initial schema is intended to provide the core room and voting data model, including profiles, rooms, room membership, and poll responses, plus the relevant database functions, access policies, and Realtime configuration. Confirm these objects and policies in your Supabase project before testing the application.

### 4. Start the app

Start Expo with a clean cache:

```bash
npx expo start -c
```

Use the Expo CLI prompts to open the app in Expo Go, a simulator, or a browser if the project's installed dependencies support that target.

For a web development session, you can also try:

```bash
npx expo start --web
```

## How voting works

1. The operator creates a room.
2. Participants join using the room code.
3. Each participant adjusts their local confidence allocation across A/B/C/D.
4. Participants explicitly commit their response. Draft edits alone should not affect room-wide results.
5. Recommitting should replace that participant's response for the active poll rather than create a second vote.
6. The app uses committed responses for the active poll version to calculate the room's aggregate leader.
7. The operator advances to the next poll. All clients should load the new authoritative poll version, reset their local draft and timer state, and stop displaying results from the previous poll.
8. When the operator ends the room, all participants should see that the session has ended and be unable to keep voting.

## Validation commands

Run these from the project root:

```bash
npx tsc --noEmit
npx --yes tsx src/utils/allocation.test.ts
npx --yes expo-doctor
npx expo export --platform web
```

These commands validate TypeScript, the allocation utility tests, Expo configuration, and a web export. They do **not** by themselves prove that multiple authenticated clients synchronize correctly through Supabase.

## Recommended manual Realtime test

Use at least three independently authenticated clients in the same test room:

1. Confirm no answer is highlighted before any response is committed.
2. Have one participant commit A at 100%; verify A is highlighted on every client.
3. Have two participants commit B at 100%; verify B becomes the leader everywhere, including on the client that voted A.
4. Change a committed response using recommit and confirm the aggregate leader updates without double-counting that participant.
5. Advance the poll from the operator's main screen; confirm all clients receive the new poll number/version and the timer resets.
6. Confirm the previous poll's leader disappears and old responses do not contribute to the new poll.
7. End the room and confirm all clients receive the room-ended state.
8. Reconnect a client and confirm it recovers the current authoritative room state.

Record which checks were actually performed; a successful build is not equivalent to a successful multi-client test.

## Project structure

A quick guide to the principal files referenced in the project:

```text
src/
├── app/
│   ├── _layout.tsx              # Root navigation/layout
│   ├── index.tsx                # Entry screen
│   └── room/
│       └── [id].tsx             # Room and voting screen
├── components/
│   ├── OptionCard.tsx           # Voting option UI
│   ├── VotingPanel.tsx          # Confidence allocation controls
│   ├── LeaderboardOptionRow.tsx # Animated leader-border component
│   └── ResultsModal.tsx         # Existing results UI, if still referenced
├── hooks/
│   └── useRoomRealtime.ts       # Room Realtime synchronization
├── lib/
│   └── supabase.ts              # Supabase client
├── stores/
│   └── roomStore.ts             # Room state
├── types/
│   ├── database.ts              # Database types
│   └── voting.ts                # Voting types
└── utils/
    └── allocation.ts            # Confidence allocation logic

supabase/
└── migrations/
    └── 20261107000000_initial_schema.sql
```

The structure may evolve. Check the actual workspace before relying on this tree as an exhaustive file listing.

## Security notes

- Keep the Supabase service-role key out of the client application and source control.
- Enforce room membership and operator permissions on the server using RLS and secure database functions; hiding a button in the UI is not authorization.
- Validate the current poll version on every vote write so old responses cannot affect the active poll.
- Do not put real credentials in screenshots, commits, issue reports, or this README.

## Troubleshooting

**Environment changes are not picked up**

Stop Expo and restart it with a cleared cache:

```bash
npx expo start -c
```

**Participants do not see a question advance or leader change**

Check that the clients are connected to the same Supabase project and room, that Realtime is configured for the relevant tables/channels, that subscriptions are filtered correctly, and that the committed response or poll change was persisted successfully. A local UI update on the operator's device is not proof of a room-wide update.

**Database migration errors**

Check whether the migration was already applied before rerunning it. Review existing tables, functions, policies, and Realtime publications rather than blindly repeating SQL.

**TypeScript or Expo checks fail**

Install dependencies and review the first reported error before changing package versions or rewriting working components.

## Contributing

Before changing voting, synchronization, or authorization behavior:

1. Inspect the existing implementation and database policies.
2. Keep changes focused and avoid replacing working modules unnecessarily.
3. Run the validation commands above.
4. Test behavior with multiple authenticated clients when touching Realtime functionality.
5. Report separately what was verified automatically and what remains to be tested manually.
