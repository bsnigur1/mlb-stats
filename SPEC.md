# The Yard — Full Build Spec

> MLB The Show 25 stat tracker for Greg, Bryan, and Andres. Private web app. Dark mode. Premium sports analytics meets vintage baseball card aesthetic.

## What You're Building
A personal stat tracker for three friends playing MLB The Show 25 together, supporting 2v2 co-op online games and solo exhibition matches. Tracks per-player batting/pitching stats, session logs, MVP awards, streaks, and head-to-head records.

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Framer Motion
- Lucide React icons
- Supabase

## Design System

### Color Tokens
```css
--bg-base: #080D18       /* night sky background */
--bg-surface: #0F1829    /* card surfaces */
--bg-elevated: #162035   /* modals */
--text-primary: #EFF2FF  /* main text */
--text-secondary: #8A9BBB /* labels */
--text-muted: #4A5772    /* tertiary */
--accent-gold: #F0B429   /* MVP/top performers */
--accent-green: #34D399  /* wins/positive */
--accent-red: #F87171    /* losses/negative */
--accent-blue: #60A5FA   /* links/interactive */
--border-subtle: rgba(255,255,255,0.07)
```

### Typography
- **Inter** font: body, labels, stat values, tables (weights: 400, 500, 600, 700)
- **Barlow Condensed**: display-only, big stat callouts (24px+)
- All numbers require `font-variant-numeric: tabular-nums`

### Type Scale
- 11px: micro labels
- 13px: secondary UI
- 15px: body/primary UI
- 17px: card titles
- 20px: page headers
- 28px: featured stats
- 48–72px: hero callouts

### Spacing & Radius
- 8pt grid system
- `border-radius: 8px` standard, `100px` for pills/badges
- Card padding: 20px standard, 16px compact

### Shadows
- Cards: `0 1px 3px rgba(0,0,0,0.2)`
- Modals: `0 24px 48px rgba(0,0,0,0.6)`
- Hot player glow: `0 0 16px rgba(240,180,41,0.12)`

### Animation Principles
- Framer Motion for all UI animations
- Default: ease-out, duration 0.2–0.3s
- Stagger entrance: `delay: i * 0.07`
- Hover: subtle `y: -2` or `x: 2`
- `whileTap: { scale: 0.97 }` on buttons
- `AnimatePresence` for expand/collapse

## Data Models

### Player
```typescript
interface Player {
  id: string;
  name: string;
  handle: string;
  heat: 'hot' | 'cold' | 'neutral';
  streak: number;
  streakType: 'W' | 'L';
  batting: {
    avg: number;
    hr: number;
    rbi: number;
    obp: number;
    slg: number;
    ops: number;
    hits: number;
    atBats: number;
  };
  pitching: {
    era: number;
    whip: number;
    strikeouts: number;
    walks: number;
    inningsPitched: number;
    wins: number;
    losses: number;
  };
}
```

### Session
```typescript
interface Session {
  id: string;
  date: string;
  label: string;
  games: Game[];
  mvpPlayerId?: string;
}
```

### Game
```typescript
interface Game {
  id: string;
  sessionId: string;
  opponent: string;
  result: 'W' | 'L';
  score: string;
  innings: number;
  type: 'CO-OP' | 'SOLO';
  mvpPlayerId?: string;
  playerStats: PlayerGameStat[];
}
```

### PlayerGameStat
```typescript
interface PlayerGameStat {
  id: string;
  gameId: string;
  playerId: string;
  batting: {
    atBats: number;
    hits: number;
    hr: number;
    rbi: number;
    bb: number;
    k: number;
  };
  pitching?: {
    inningsPitched: number;
    hits: number;
    runs: number;
    earnedRuns: number;
    walks: number;
    strikeouts: number;
  };
}
```

### Award
```typescript
interface Award {
  id: string;
  playerId: string;
  type: 'MVP_GAME' | 'MVP_SESSION' | 'MVP_WEEK' | 'SEASON_HIGH' | 'HOT_STREAK';
  label: string;
  sessionId?: string;
  gameId?: string;
  date: string;
}
```

## Screens

### 1. Dashboard `/`
- Header with date and "Log Game" CTA
- Season leaders row (AVG, HR, Wins)
- Recent sessions list with expand/collapse
- Hot/cold player sidebar

### 2. Session Log `/sessions/[id]`
- Date header with session label
- Vertical game timeline
- Per-player stat lines
- MVP callout

### 3. Player Profile `/players/[id]`
- Name header with heat indicator
- Hero stat display
- Batting/pitching stat grid
- H2H records vs other players
- Recent games list

### 4. Head-to-Head `/h2h`
- Player selector (dropdown)
- Side-by-side stat comparison
- Advantage highlights (green/red)
- Win/loss record

### 5. Log Game `/log`
- Quick mode (default): score, opponent, type, MVP
- Full mode toggle: individual stat lines
- Incrementors `[−] N [+]` for HR, RBI, K
- Tab order: AB → H → HR → RBI → BB → K
- Auto-advance after completing a line

### 6. Awards `/awards`
- Leaderboard layout
- Award type tabs
- Player avatars with badges

## Component Specs

### StatBlock
- Sizes: Micro (15px), Standard (28px), Hero (56px Barlow)
- Structure: value → label → optional trend delta

### Badges (100px border-radius)
- MVP: gold-tinted with gold border
- Season High: blue-tinted
- Hot/Cold streaks: gold/gray
- CO-OP/SOLO: blue/gold
- Result dots: green (W) or red (L), 7px circles

### Cards
- `background: #0F1829`
- `border: 1px solid rgba(255,255,255,0.07)`
- `border-radius: 8px`
- `padding: 20px`
- Player cards include pinstripe texture

### Tables
- 11px uppercase headers with 0.1em letter-spacing
- 44px row height
- Right-aligned numbers (tabular-nums)
- Gold left border for active row

### Buttons
- Primary: gold background, dark text, 40px height
- Secondary: transparent with subtle border
- `whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}`

## Navigation

### Desktop (≥768px)
- Left sidebar (220px)
- Logo + nav items with gold active indicator
- Bottom settings link

### Mobile (<768px)
- Fixed top bar: logo, title, Log button
- Fixed bottom nav: 5 items
- Safe-area padding

## Responsive Breakpoints
- Mobile: <768px
- Tablet: 768–1024px
- Desktop: >1024px

## Design Don'ts
- No gradient text on numbers
- No glassmorphism
- No confetti on save
- No serif fonts on data
- No MLB/Yankees logos
- Don't mix border-radius values
- Don't animate keyboard-triggered actions
