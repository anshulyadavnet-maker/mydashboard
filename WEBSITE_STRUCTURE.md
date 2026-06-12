# Website Structure & Navigation Specification

This document maps out the page-wise structure, SEO elements, color accent configurations, and responsive navigation systems of the **MYDASHBOARD.CO.IN Dashboard**.

---

## 📁 Page Directory Structure (`src/pages/`)

The application maps specific file paths in the `src/pages` directory directly to routing URLs.

```
src/pages/
├── index.astro          -->  / (Home Tools Grid Dashboard)
├── milk.astro           -->  /milk (Milk Delivery Ledger)
├── expenses.astro       -->  /expenses (Expense Manager)
├── notes.astro          -->  /notes (Quick Notes Board)
├── passwords.astro      -->  /passwords (Password Vault)
├── calculator.astro     -->  /calculator (Smart Calculator)
├── age-calculator.astro -->  /age-calculator (Age Calculator)
├── login.astro          -->  /login (Sign In Page)
├── register.astro       -->  /register (Sign Up Page)
└── api/                 -->  Back-end D1 database endpoints
```

---

## 🛡️ Route Access & Middleware Filtering

The middleware ([middleware.ts](file:///C:/Users/ram-s/Downloads/milk/mydashboard/src/middleware.ts)) controls routing access by checking for valid session tokens in cookies.

```
                     ┌──────────────────┐
                     │   Request URL    │
                     └────────┬─────────┘
                              │
                     Is it a Public Route?
                     ( / , /calculator , /age-calculator, /login, /register, /api/auth/* )
                              │
                     ┌────────┴────────┐
            Yes      │                 │      No
          ┌──────────┴───┐    ┌────────┴────────┐
          │ Allow Access │    │ Is User Logged? │
          └──────────────┘    └────────┬────────┘
                                       │
                              Yes      │                 No
                            ┌──────────┴───┐    ┌────────┴────────┐
                            │ Allow Access │    │ Redirect Login  │
                            └──────────────┘    └─────────────────┘
```

---

## 📑 Page-by-Page Specifications & SEO

### 1. Home Dashboard (`/`)
* **File**: `src/pages/index.astro`
* **Route Type**: Public Access.
* **SEO Metadata**:
  - **Title**: `Dashboard - All-in-One Utility Suite & Ledger`
  - **Meta Description**: `Log your daily milk delivery, manage monthly expenses, capture tags notes, secure password credentials, and calculate details from a unified workspace dashboard.`
  - **Keywords**: `utility suite, personal ledger, dashboard portal, milk ledger, notes manager`
* **Color Accent**: Multi-colored accent grid.
* **Interactive Modals**: Dynamic upcoming tools feature list and vote sheet.

### 2. Milk Ledger (`/milk`)
* **File**: `src/pages/milk.astro`
* **Route Type**: Private (Requires Login).
* **SEO Metadata**:
  - **Title**: `Milk Ledger - Daily Milk Delivery Hissab`
  - **Meta Description**: `Track your daily milk delivery (Doodh ka Hissab), rates, category, active suppliers, payments, and due balance history.`
  - **Keywords**: `milk delivery, doodh ka hissab, milk matrix ledger, daily supplier ledger`
* **Color Accent**: Sky Blue (`#0284c7`).
* **UI Features**: Calendar grid matrix, quantity logs modal, bulk auto-fills, supplier summary cards, payments log.

### 3. Expense Manager (`/expenses`)
* **File**: `src/pages/expenses.astro`
* **Route Type**: Private (Requires Login).
* **SEO Metadata**:
  - **Title**: `Expense Manager - Monthly Spending Tracker`
  - **Meta Description**: `Log spendings, track monthly budget limits, and see total stats of your expenses categorized by categories.`
  - **Keywords**: `expense logger, budget limit, spending breakdown, monthly ledger`
* **Color Accent**: Rose Red (`#f43f5e`).
* **UI Features**: Calendar group categories list, inline filters, budget sums, color codes, detail editor modal.

### 4. Quick Notes (`/notes`)
* **File**: `src/pages/notes.astro`
* **Route Type**: Private (Requires Login).
* **SEO Metadata**:
  - **Title**: `Notes - Personal Idea & Checklist Board`
  - **Meta Description**: `Write down lists, thoughts, reminders, todo checklists, and categorize them using colors and search tags.`
  - **Keywords**: `quick notes, tag checklists, idea pinboard, colored notes`
* **Color Accent**: Amber Orange (`#d97706`).
* **UI Features**: Sticky notes pinboard, tag indexing, query filter search, sheet editor modal.

### 5. Password Vault (`/passwords`)
* **File**: `src/pages/passwords.astro`
* **Route Type**: Private (Requires Login).
* **SEO Metadata**:
  - **Title**: `Password Manager - Secure Credentials Vault`
  - **Meta Description**: `Store your login credentials, website URLs, and accounts safely. Generate secure passwords with click-to-copy.`
  - **Keywords**: `password manager, secure vault, copy login, password generator`
* **Color Accent**: Indigo Purple (`#4f46e5`).
* **UI Features**: Service login cards, hide/show password toggle, copy click buttons, vault forms modal.

### 6. Smart Calculator (`/calculator`)
* **File**: `src/pages/calculator.astro`
* **Route Type**: Public Access.
* **SEO Metadata**:
  - **Title**: `Online Calculator - Smart Math Tool`
  - **Meta Description**: `Free arithmetic web calculator. Features equation history, click-to-load memory, and keyboard support.`
  - **Keywords**: `web calculator, math history, keyboard shortcuts calculator`
* **Color Accent**: Slate Grey (`#64748b`).
* **UI Features**: Grid keyboard buttons, screen history, history sidebar, key events logger.

### 7. Age Calculator (`/age-calculator`)
* **File**: `src/pages/age-calculator.astro`
* **Route Type**: Public Access.
* **SEO Metadata**:
  - **Title**: `Age Calculator - Birthday & Zodiac Tool`
  - **Meta Description**: `Calculate exact age in years/months/days. Includes zodiac sign finder, next birthday countdown, and time statistics.`
  - **Keywords**: `age calculator, zodiac sign finder, next birthday countdown, time living stats`
* **Color Accent**: Emerald Green (`#10b981`).
* **UI Features**: DOB selector input, main age summary card, birthday countdown box, stats rows block.

---

## 🗺️ Navigation Flows

Navigation elements are responsive to screen size and user authentication states.

### 1. Desktop Layout (Top Navigation Header)
* Sticky header with blur backdrop.
* **Brand Logo**: Left-aligned, redirects to Home `/`.
* **Middle Nav Links**:
  - Visible only to authenticated users:
    1. `Dashboard` -> `/` (Home)
    2. `Milk Ledger` -> `/milk`
    3. `Expenses` -> `/expenses`
    4. `Notes` -> `/notes`
    5. `Passwords` -> `/passwords`
* **Right Side Controls**:
  - Theme toggler (☀️/🌙).
  - Authenticated: Displays a `Logout` button (POST to `/api/auth/logout` which clears session cookies).
  - Anonymous: Displays `Login` link and `Sign Up` button.

---

### 2. Mobile Layout (Bottom Navigation Dock)
* Fixed bottom navigation dock height: `60px`.
* **Dynamic Pinned Links**: Rather than hardcoded icons, the bottom bar dynamically reads the user's custom preference of exactly 4 pinned apps from `localStorage` and builds nav elements on load.
* **Defaults (when no preference is set)**:
  - *Authenticated*: `Home (🏠)` | `Milk (🥛)` | `Expenses (💸)` | `Notes (📝)`
  - *Anonymous*: `Home (🏠)` | `Calc (📊)` | `Age (🎂)` | `Login (👤)`

---

### 3. Modal sheet Transitions (Bottom Sheets & Settings Modal)
* **Desktop**: Displays centered glass modals overlays.
* **Mobile**: Modals translate from `bottom: 0`, expanding into sliding **Bottom Sheets** (like native mobile apps).
* **Settings Modal (⚙️)**:
  - Accessible via a Gear button next to the theme toggle.
  - Allows configuration of **Default Theme** (System / Dark / Light).
  - Allows configuration of **Default Launch Page**: If set (e.g. to Milk Ledger), loading `/` will instantly redirect the browser to `/milk` to feel like an installed app. (An override is automatically set in `sessionStorage` if they explicitly click the "Dashboard" home links, preventing redirect loops).
  - Allows selection of exactly 4 pinned apps for the bottom bar via a checklist.

---

### 4. Search Filter & Ads Architecture
* **Real-time Search Filter**: The homepage `/` displays a search bar input. Typing triggers a script that immediately hides/shows matching tool cards in the DOM.
* **Ads Monetization Placements**: A dashed sponsored ad banner layout is placed at the bottom of the home grid, providing standard tags and classes to drop in AdSense/Ezoic scripts later.
