# Go Mini Home HTML Prototype Implementation Plan

> **Archive note (2026-08-08):** This uncommitted historical plan targeted the removed `registration_system_mini_go/` project. Future mini/H5 design and implementation belongs in `registration_system_mini/`; paths below are retained only to preserve the original plan context.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, high-fidelity HTML prototype of the Go mini-program home page for visual approval.

**Architecture:** Create one offline HTML document containing semantic markup, CSS variables, responsive styles, inline Lucide SVG geometry, fixed demo data, and two small local interactions. Keep it isolated from `registration_system_mini_go/src/` so approval does not affect production code.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Playwright browser verification

## Global Constraints

- Create only `docs/prototypes/go-mini-home.html` for the prototype.
- Do not use React, Tailwind, uni-app, remote fonts, CDNs, or Go API requests.
- Support 360px, 390px, and 420px mobile widths; center a maximum 420px canvas on desktop.
- Use the exact copy, demo match data, colors, and interaction states from `docs/superpowers/specs/2026-08-05-go-mini-home-html-prototype-design.md`.
- Keep the bottom navigation visible without covering the final content.

---

### Task 1: Standalone Home Prototype

**Files:**
- Create: `docs/prototypes/go-mini-home.html`
- Reference: `docs/superpowers/specs/2026-08-05-go-mini-home-html-prototype-design.md`

**Interfaces:**
- Consumes: no runtime dependencies; browser viewport and pointer/keyboard events only
- Produces: a directly openable HTML file with `#registration-button`, `#registration-status`, and `.tab-button[data-tab]` interaction hooks

- [ ] **Step 1: Build the semantic page structure**

Create the status preview, header, hero, recent-match section, opportunity empty state, and five-part bottom navigation. Use real `button` elements and inline Lucide-compatible SVG icons with accessible labels.

- [ ] **Step 2: Implement responsive visual styling**

Define the reference palette as CSS variables. Use a full-width mobile canvas, `max-width: 420px` desktop canvas, stable match-card tracks, fixed button dimensions, safe-area bottom padding, and a final content spacer taller than the bottom navigation.

- [ ] **Step 3: Implement the two local interactions**

Initialize registration as `true`. Clicking `#registration-button` toggles the button between `已报名 ✓` and `去报名`, toggles `is-registered`, and changes `#registration-status` between `我的状态：参加` and `我的状态：未参加`. Clicking a `.tab-button[data-tab]` removes `is-active` and `aria-current` from the old tab and applies both to the selected tab.

- [ ] **Step 4: Run structural checks**

Run:

```bash
rg -n "https?://|fetch\(|XMLHttpRequest|localStorage|sessionStorage" docs/prototypes/go-mini-home.html
```

Expected: no matches.

Run an HTML parser check and confirm the document has one `main`, one bottom navigation, `#registration-button`, `#registration-status`, and four `.tab-button[data-tab]` buttons.

- [ ] **Step 5: Verify in a real browser**

Open the file in Chromium. Capture screenshots at 360x800, 390x844, 420x900, and 1440x1000. At each width, confirm no horizontal overflow, overlapping text, blank icons, or final-content obstruction. Click the registration button twice and verify the exact state mapping; click each normal tab and verify only one active state. Confirm the console has no errors and no network requests occur.

- [ ] **Step 6: Commit the prototype**

```bash
git add docs/prototypes/go-mini-home.html docs/superpowers/plans/2026-08-05-go-mini-home-html-prototype.md
git commit -m "feat: add Go mini home HTML prototype"
```
