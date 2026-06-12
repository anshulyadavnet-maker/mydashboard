# Tools Grid Dashboard & Tracking System

This documentation describes the architecture, implementation, and features of the **All-in-One Utility and Personal Ledger Dashboard** built as a server-side rendered (SSR) Astro application and deployed on Cloudflare Pages.

---

## 🗺️ Architecture Overview

The system consolidates personal trackers (requiring user authentication) and utility calculators (publicly accessible) under a single dashboard. 

```mermaid
graph TD
    User([User Client]) --> Home["🏠 Home Dashboard (/)"]
    Home -->|Click Live Personal Tool| AuthCheck{Auth Checked?}
    Home -->|Click Live Utility Tool| PublicPages[Utility Tools]
    Home -->|Click Upcoming Tool| PreviewModal[Upcoming Preview Modal]
    
    AuthCheck -->|Authenticated| PersonalPages[Personal Tools]
    AuthCheck -->|Anonymous| LoginRedirect[/login]
    
    PersonalPages -->|Server Side| D1[(Cloudflare D1 Database)]
    D1 -->|Read/Write Usage| UsageTable[tool_usage Table]
    
    PublicPages -->|Local Storage| ClientTrack[localStorage: tool_usage_local]
```

### Key Technical Aspects
1. **Hosting**: Hosted on Cloudflare's edge network, taking advantage of Cloudflare Pages for fast routing and asset delivery.
2. **Database**: SQLite-compatible Cloudflare D1 for storing notes, expenses, password credentials, milk ledgers, and tool usage frequencies.
3. **Session & Auth**: Handled using JSON Web Tokens (JWT) signed with a custom secret key and stored securely in cookies.
4. **Theme Support**: Integrated dark/light theme switching using CSS custom properties with state persisted in `localStorage`.
5. **Mobile-First Responsive Layout**:
   - **Desktop Layout**: Displays a sticky top glass navigation bar, brand logo, and horizontal layout structure. Modals appear as centered glass overlays.
   - **Mobile Layout**: Replaces top navigation links with a fixed bottom tab bar (Home, Milk, Expenses, Notes, Vault/Passwords). Form items and tables wrap cleanly.
   - **Native-feeling Bottom Sheets**: Modals on mobile screens automatically align to the bottom of the screen and slide up smoothly like native iOS/Android sheet sheets, improving single-hand thumb reachability.
   - **Premium Glow Backdrops**: Dual-radial gradient layers in `global.css` cast soft, atmospheric cyan and blue light behind cards in dark mode and subtle clean depths in light mode.

---

## 🎨 Tool Accent Palette & SEO Routing

Each tool operates on its own dedicated route (`/[tool-name]`) optimized for SEO. Each has a unique design accent color applied to its dashboard card and page headers.

| Tool Name | Route | Requires Login | Accent Color (Hex) | Badge Icon | SEO Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Milk Ledger** | `/milk` | Yes | `#0284c7` (Sky) | 🥛 | Log daily milk delivery, rates, payments, and balances. |
| **Expense Manager** | `/expenses` | Yes | `#e11d48` (Rose) | 💸 | Categorize spendings, log records, and track monthly budgets. |
| **Quick Notes** | `/notes` | Yes | `#d97706` (Amber) | 📝 | Capture notes, checklists, and categorize using tags and colors. |
| **Password Manager** | `/passwords` | Yes | `#4f46e5` (Indigo) | 🔑 | Securely store credentials, generate passwords, and copy. |
| **Smart Calculator** | `/calculator` | No | `#64748b` (Slate) | 📊 | Free arithmetic calculator with keyboard shortcuts and history. |
| **Age Calculator** | `/age-calculator` | No | `#10b981` (Emerald)| 🎂 | Calculate exact age, birthday countdown, and zodiac sign. |
| **Cylinder Tracker** | `#cylinder` | Yes (Upcoming) | `#ea580c` (Rust) | 🔥 | Track gas cylinder refill intervals and next booking date. |
| **Newspaper Ledger** | `#newspaper` | Yes (Upcoming) | `#0891b2` (Cyan) | 📰 | Log newspaper deliveries, vacation gaps, and monthly bills. |
| **Tuition Fee Tracker**| `#tuition` | Yes (Upcoming) | `#8b5cf6` (Violet) | 🎓 | Manage student lists, classes, dues, and payment receipts. |
| **Rent Ledger** | `#rent` | Yes (Upcoming) | `#db2777` (Pink) | 🏠 | Keep tenant rent logs, security deposits, and reminders. |
| **Subscription Tracker**| `#subscriptions`| Yes (Upcoming) | `#c084fc` (Lavender)| 💳 | Track recurring bills, Netflix, Spotify renewal deadlines. |
| **Habit Tracker** | `#habits` | Yes (Upcoming) | `#06b6d4` (Teal) | ⚡ | Monitor daily habits, streaks, and view consistency maps. |

---

## 📈 Usage Tracking & Sorting Algorithm

To provide a personalized dashboard, tools are sorted dynamically. **Used tools are displayed at the top, followed by unused tools in order of their usage frequency.**

A hybrid algorithm manages this for both authenticated and anonymous visitors:

### 1. Authenticated User Tracking (Database-Driven)
For logged-in users, tool usage counts are updated server-side on SSR page loads and fetched from the D1 SQLite database.

#### D1 Database Schema (`schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS tool_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  use_count INTEGER DEFAULT 0,
  last_used_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, tool_id)
);
CREATE INDEX IF NOT EXISTS idx_tool_usage_user ON tool_usage(user_id);
```

#### SQL Upsert Operation
Every time an authenticated user loads a tool page (e.g. `/milk`), the server-side code runs:
```sql
INSERT INTO tool_usage (user_id, tool_id, use_count, last_used_at)
VALUES (?, ?, 1, datetime('now'))
ON CONFLICT(user_id, tool_id) DO UPDATE SET
  use_count = use_count + 1,
  last_used_at = datetime('now')
```

#### Server-Side Sorting on Homepage (`src/pages/index.astro`)
The homepage fetches usage records using `getToolUsage(db, user.userId)`. Sorting is performed using:
1. Compare `use_count` for tool A and B. If both have a positive count, sort by `use_count` descending (frequent tools on top).
2. If only one has a positive count (i.e. used), that tool goes first.
3. If both are unused (`use_count = 0`), fallback to sorting by `defaultOrder` (preserves logical suite order).

---

### 2. Anonymous User Tracking (LocalStorage-Driven)
For logged-out users, utility pages (like `/calculator` and `/age-calculator`) increment counts inside client-side `localStorage`.

#### Client-side Increment Script
Injected into `/calculator` and `/age-calculator`:
```html
<script is:inline>
  (function() {
    try {
      const counts = JSON.parse(localStorage.getItem('tool_usage_local') || '{}');
      counts['calculator'] = (counts['calculator'] || 0) + 1; // replaces with tool id
      localStorage.setItem('tool_usage_local', JSON.stringify(counts));
    } catch (e) {}
  })();
</script>
```

#### Client-Side DOM Reordering
A script on `/` handles reordering the grid items in the browser for anonymous visitors:
```html
<script>
  (function() {
    const isLoggedIn = document.documentElement.getAttribute('data-logged-in') === 'true';
    if (isLoggedIn) return; // server sorting handled it

    try {
      const localCounts = JSON.parse(localStorage.getItem('tool_usage_local') || '{}');
      const grid = document.getElementById('tools-grid');
      if (!grid) return;

      const cards = Array.from(grid.querySelectorAll('.tool-card'));
      cards.sort((a, b) => {
        const aId = a.dataset.toolId;
        const bId = b.dataset.toolId;
        const aCount = localCounts[aId] || 0;
        const bCount = localCounts[bId] || 0;
        const aOrder = parseInt(a.dataset.defaultOrder || '99');
        const bOrder = parseInt(b.dataset.defaultOrder || '99');

        if (aCount > 0 && bCount > 0) {
          return bCount - aCount;
        } else if (aCount > 0) {
          return -1;
        } else if (bCount > 0) {
          return 1;
        } else {
          return aOrder - bOrder;
        }
      });

      cards.forEach(card => grid.appendChild(card));
    } catch (e) {}
  })();
</script>
```

---

## 🛠️ Tool Specifications & Dynamic Preview

### 1. Smart Calculator (`/calculator`)
* **Access**: Public (No login required).
* **Theme Accent**: Slate (`#64748b`).
* **Features**:
  - Full keyboard shortcuts (numbers, symbols, Enter to evaluate, Escape to clear).
  - Keeps a rolling history of the last 20 computations stored locally.
  - Interactive history log - click past results to instantly load them back into the input buffer.
  - Percent (`%`), sign toggle (`±`), backspace (`⌫`), and clear (`AC`) functionality.

### 2. Age Calculator (`/age-calculator`)
* **Access**: Public (No login required).
* **Theme Accent**: Emerald (`#10b981`).
* **Features**:
  - Computes exact years, months, and days from Date of Birth to a specific Target Date.
  - Computes exact countdown in months/days until the next birthday.
  - Calculates astrological Zodiac sign (e.g. Scorpio ♏, Aries ♈).
  - Displays lifetime statistics: total months, total weeks, total days, total hours, minutes, and seconds.

### 3. Dynamic Preview & Voting system for Upcoming Tools
When a user clicks on an upcoming tool (e.g. Newspaper Ledger, Subscription Tracker), instead of a dead link, they are met with a gorgeous modal showing the planned features.

Users can click a **👍 Vote for this Tool** button. This increments votes in `localStorage` and alerts the user, capturing interest and helping developers prioritize what to build next.

#### Planned Feature Map for Modals:
* **Cylinder Tracker**: Track refill durations, calculate next booking reminder, estimate usage rates.
* **Newspaper Ledger**: Log newspaper arrivals, input vacation breaks, calculate skipped day adjustments.
* **Tuition Fee**: Track students, calculate hourly/monthly tuition fee payments, send receipts.
* **Rent Ledger**: Maintain rent ledgers, tenant/landlord agreements, repairs costs log.
* **Subscription Tracker**: List streaming and SaaS memberships, Renewal alert, Monthly sum.
* **Habit Tracker**: Build habits, log compliance streaks, heatmap view.

---

## 🚀 Running, Testing, & Deploying

### Local Development
To run the server locally with wrangler Pages emulation and local D1 database bindings:
```bash
# Setup database schema locally
npm run db:setup:local

# Run developer server with D1 bindings active
npm run dev:build
```

### Production Deployment
To deploy your Astro Pages build and local D1 updates to Cloudflare production:
```bash
# Apply schema to production D1 Database
npm run db:setup

# Build and deploy build/dist files to Cloudflare Pages
npm run deploy
```
