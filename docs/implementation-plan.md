Good thinking on all three. Let me respond to each properly.

---

**1. Sub-wallet architecture**

The current design already does what you're describing — one SubWallet is deployed per coin, and LaunchpadFactory is the coordination layer. But you've identified a real gap: there's no **platform-level wallet** that aggregates the treasury slice across all coins. Right now the 20% treasury slice sits dispersed across N SubWallet contracts, and the protocol has no single place to withdraw operating funds from.

The fix is clean:

- Add a `PlatformTreasury` contract — one single address the factory knows about. All 20% treasury slices from all SubWallets send directly there (not to individual SubWallets). Keeper calls a single `withdraw()` on PlatformTreasury to collect operating funds.
- The 50/15/20/15 split stays the same but the 20% destination changes from "held in SubWallet" to "pushed directly to PlatformTreasury on each claim."
- SubWallet remains per-coin (correct architecture) — it manages only the perp position and the per-coin creator/buyback logic.
- PlatformTreasury gets a multisig or timelock for owner withdrawal — the keeper doesn't control it.

This is a small contract addition, not a redesign. The bigger question is: should the keeper EOA and the treasury be **separate addresses**? Yes, they should. Keeper = hot wallet for on-chain ops (low balance, rotatable). Treasury = cold multisig for accumulated fees (high balance, locked). Worth separating now before mainnet.

---

**2. Platform fees + NFT tab**

On platform fees — launchpads typically take one or more of:

- **Launch fee** — flat USDC charged when `launchCoin()` is called (e.g. 5–50 USDC). Simple, predictable.
- **Trading fee cut** — a slice of the 1% bonding curve fee goes to the platform before the 50/15/20/15 split. E.g. take the 1% fee, send 0.2% to PlatformTreasury, split the remaining 0.8%.
- **Graduation fee** — a percentage of the USDC in the curve at graduation flows to PlatformTreasury before LP migration.

The cleanest sustainable model for infinite.fun: **flat launch fee (10–25 USDC) + 0.2% platform cut on every swap**. No percentage of the 50/15/20/15 needs to change — just cut the trading fee before the split happens.

On **NFTs** — this is genuinely interesting and fits the mechanic well. A few directions:

- **Coin NFTs**: when a coin is launched, the creator receives a soulbound NFT representing their "engine" — it visualizes the position in real time (P&L, collateral, total burned). Tradeable or soulbound depending on design.
- **Proof-of-burn NFT**: when a user's buyback burns tokens, they receive an NFT receipt with the burn amount, timestamp, and position state. Collectible, no utility, but adds a social layer.
- **Keeper NFT**: a single NFT that grants the ability to run the keeper for a specific coin. Holder earns a small slice of keeper fees. Creates a secondary market for keeper operation rights.

The **NFT launch tab** idea — where users can launch NFT collections alongside tokens — is a bigger surface. Worth planning separately. The integration with the flywheel would be: NFT mint proceeds go to the SubWallet, deepening the position. That's a natural extension.

---

**3. Open dev approach / infinite.fun as an ethos**

This is the right frame and it should be explicit in the product. A few thoughts:

- **Governance runway**: the 20% treasury isn't just operating costs — it's a grants fund. Once the DAO is live (roadmap v1.0), holders vote on what to build next. The flywheel funds its own development.
- **Feature cadence**: plan in two-week sprints. Each sprint ships something visible. Between sprints, nothing is rushed. The roadmap in the whitepaper already has the right sequencing — v0.2 (audit), v0.3 (mainnet + V4), v0.4 (multi-perp basket), v0.5 (social layer), v1.0 (DAO).
- **Community input loop**: add a `/ideas` page or a GitHub Discussions board where users propose features. The keeper log and event feed already give users a sense of the mechanics — but a public roadmap they can comment on turns passive users into contributors.
- **The name does work for you here**: "infinite" isn't just a stylistic choice, it's a commitment. Features should stack, not replace. The bonding curve, the perp, the keeper, the burn — those are the engine. NFTs, multi-perp, DAO governance, social layer — those are cylinders added to the same engine.

---

**What I'd action next (in order):**

1. **PlatformTreasury contract** — small, bounded, fixes the fee aggregation gap. Add platform launch fee and 0.2% trading cut at the same time.
2. **Separate keeper EOA from treasury address** in config and contracts.
3. **NFT receipts for burns** — low complexity, high social value. Start there before a full NFT launch tab.
4. **NFT launch tab** — design it as a separate planning session once the core contracts are audited.
5. **`/ideas` page or GitHub Discussions** — low effort, high signal for long-term direction.

Want me to start on item 1 (PlatformTreasury + platform fees) now, or plan the NFT mechanic first?
