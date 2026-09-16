Good call. Let me read the current UI files before touching anything. Good picture of the current state. Before touching a single line, here are the logo and hero ideas — then I'll do the UI pass.

---

**Logo ideas for infinite.fun**

The name has two strong assets: the infinity symbol `∞` and the word "infinite" being literally endless. Three directions:

**Direction 1 — The ∞ as a position**
The infinity loop rendered as two candles (like a trading chart). Left loop = long position going up, right loop = the burn. Color: steel blue fading to the accent blue. Works as a favicon at 16px and a wordmark.

**Direction 2 — Orbit / flywheel**
A circle of small dots orbiting a central coin icon — each dot represents one step of the keeper cycle (fee → margin → profit → burn → fee). Animated in CSS (slow rotation, 20s). Clean, technical, says "perpetual motion."

**Direction 3 — Minimal wordmark**
`∞.fun` in Space Grotesk Bold. The `∞` in the accent blue (`#acc6e9`), `.fun` in a dimmer white. No icon — just the mark. This is the strongest at small sizes and in the nav.

**My pick:** Direction 3 for the nav logo (just CSS + the font you already have), Direction 2 as the hero illustration (pure CSS animation, no image dependency).

---

**Hero section ideas**

Current hero is just a title + subtitle. Three approaches that would make it land harder:

**Option A — Live stats strip**
Below the headline: three animated counters. "X coins live", "X USDC in perps", "X tokens burned." Polled from the API every 30s. Makes the page feel alive even with few coins.

**Option B — Animated flywheel diagram**
A CSS-only diagram showing the cycle: Curve → Fees → SubWallet → Hyperliquid → Profit → Burn → back to Curve. Nodes connected by animated dashed lines. Explains the mechanic visually in 2 seconds.

**Option C — Ticker tape**
A horizontally scrolling marquee of all active coins with their live P&L. Like a Bloomberg terminal strip. Feels native to the trading aesthetic.

**Best combination:** Option A (stats strip) + Option C (ticker tape) together below the headline. Direction 3 logo in the nav. Option B flywheel diagram can live in an "How it works" section further down the page.

---

Ready to build all of this. Here's what the UI pass will cover:

- **Global CSS**: deeper shadows, glow effects on cards, glass surface variables, improved border radii, subtle grid/noise texture on background
- **Nav**: `∞.fun` wordmark, glow on hover for buttons, frosted glass stronger
- **Hero**: stats strip (live counters), ticker tape marquee, better headline sizing
- **CoinCard**: box-shadow with accent glow on hover, glass effect, richer info (leverage badge, time since launch, position status dot)
- **CoinDetail**: better stat cards with icons and tooltips, polished chart, improved tab design
- **Footer**: links (GitHub, docs, Discord), chain info, "built on Arc" badge, GPL notice
- **Tooltips**: added to all fee split percentages, leverage badge, graduation threshold, keeper status
- **Transitions**: smooth page entrance animations, card hover lifts

Say "go" and I'll build it all now.
