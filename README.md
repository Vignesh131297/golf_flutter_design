# golf_flutter_design

Clickable UX prototype of the **mobile app** (React + Vite + Tailwind, drawn in a phone frame).
One app, one sign-in: the account decides which tabs you get. Set-up and administration stay on the web prototype.

```bash
npm install
npx vite
```

## Roles and tabs

**Try a role** under the sign-in form fills a demo login.

| Role | Demo login | Tabs |
|---|---|---|
| Golfer | any other email, 4+ character password | **Home · Events · Play · Profile**. Play = today's round: position, *Continue scoring*, marker mismatches, leaderboard |
| Marshal | `marshal@gmail.com` / `marshal` | **Pace · Incidents · Tee sheet · Me** (before tournament day: Tee sheet · Me) |
| Tournament official | `official@gmail.com` / `official` | **Cards · Disputes · Pace · Me** — check cards against the marker, correct with a reason, verify, decide disputes |
| Organiser | `dana@augustapines.com` / `augusta` | **Today · Cards · Disputes · Me** — live overview, groups needing attention, marshal/official slots |
| Platform admin | `admin@gmail.com` / `admin` | No tabs: the admin console is on the web |

- Marshal and official logins work only for their tournaments (tee sheet before the day, everything on the day, nothing after it closes).
  **Me** lists their assignments and switches between them.
- The demo golfer is also a marshal at the Carmel Bay Stableford Cup: **Profile → Your other roles** switches, **Me → Switch to my golf** switches back.
- Live scoring: each player also enters their partner's score (*Marking …*). If the two cards differ, a red banner opens **Settle**:
  use the marker's score, have the marker change theirs, or send it to the committee. Cards can be submitted with blank holes.
- Registration has no waiting list; paid entries open a Stripe-style payment sheet (test card 4242 4242 4242 4242).

Golfers sign in with any email and a password of 4+ characters. **Sign up** creates a golfer account: login details → verify email with a 6-digit code (the prototype shows the code, `246810`) or verify later → about you → your game → preferences. Rules are shared with the web prototype in `src/account-rules.ts`. Use `wrongpass` to see the wrong-password error and `serverdown` to see the server error.

## Screens

| Screen | What the golfer can do |
| --- | --- |
| Home | Handicap card. **Playing now** card on tournament day (position, to par, thru, then continue scoring). Up next, open events |
| Tournaments | Search, plus a status filter (Live, Open, Upcoming, Completed, Cancelled) |
| Tournament details | Format, entry and fees, registration window, schedule, scoring, divisions, prizes, local rules, contacts. Register (choosing a division), join the waitlist, or withdraw. On tournament day: tee time, playing partners, leaderboard, enter scores |
| Leaderboard | Live (auto-refreshing) or final results, by round and division. Gross, net or Stableford. Tap a player to see their hole-by-hole card |
| Live play | Full-screen on-course mode. Front/centre/back of the green, reach and carry for the next hazard, a hole map (tap to measure, mark ball, "GPS my ball"), a score stepper with strokes received, and the scorecard sheet. Submit card |
| Course details | Stats, status banner (closed or maintenance), dress code, directions/call/website, scorecard, tees with rating/slope, hole guide with maps, facilities |
| Profile / Edit profile | Golfer details and handicap |

## Prototype data

- `src/data.ts` holds the static tournaments and courses. `t8` is a live tournament, today's club championship.
- `src/live.ts` holds tournament-day state: field entries, tee groups, scorecards, marked shots and the leaderboard. It's saved to `localStorage` (`gtp-live-v1`), and `simulateTick` moves the rest of the field along. A real backend would push these updates.
- `src/golf.ts` holds the golf maths: playing handicap (WHS), strokes per hole, Stableford points and hole-map generation.
- `src/hole-map.tsx` draws the hole maps. Positions are yards on a local grid; the backend would store latitude/longitude.

- `src/ops.ts` holds roles on tournament day: marshal/official slots and logins, incidents and disputes, marker scores, the score-change audit trail and pace of play. **Identical to the web copy** — change both.
- `src/ops-ui.tsx` and `src/screens/Roles.tsx` are the marshal, official and organiser screens; `src/accounts.ts` maps a sign-in to a role.

`golf.ts` and `hole-map.tsx` are copies of the web prototype's files. `live.ts` is the web copy without the admin store. Keep them in step with the web prototype.
