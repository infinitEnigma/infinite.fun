import { useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';

/* ------------------------------------------------------------------ */
/* Prose helpers                                                         */
/* ------------------------------------------------------------------ */

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="display font-bold text-4xl sm:text-5xl mb-6 leading-tight" style={{ color: 'var(--ink)' }}>
      {children}
    </h1>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="display font-bold text-2xl mt-14 mb-4 scroll-mt-24"
      style={{ color: 'var(--ink)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="display font-semibold text-lg mt-8 mb-3" style={{ color: 'var(--ink-2)' }}>
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
      {children}
    </p>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 mb-2 text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
      <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '0.15em' }}>→</span>
      <span>{children}</span>
    </li>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mb-4 pl-0 list-none">{children}</ul>;
}

function Callout({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className="rounded-xl px-5 py-4 my-6 text-sm leading-relaxed"
      style={{
        background: accent ? 'rgba(172,198,233,0.08)' : 'var(--surface-muted)',
        border: `1px solid ${accent ? 'rgba(172,198,233,0.25)' : 'var(--border)'}`,
        color: accent ? 'var(--ink-2)' : 'var(--muted)',
      }}
    >
      {children}
    </div>
  );
}

function Table({ rows }: { rows: [string, string, string?][] }) {
  return (
    <div className="overflow-x-auto my-6">
      <table className="w-full text-sm border-collapse">
        <tbody>
          {rows.map(([a, b, c], i) => (
            <tr
              key={i}
              style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
            >
              <td className="py-2.5 pr-4 font-semibold mono align-top" style={{ color: 'var(--accent)', width: c ? '20%' : '30%' }}>{a}</td>
              <td className="py-2.5 pr-4 align-top" style={{ color: 'var(--muted)', width: c ? '30%' : '70%' }}>{b}</td>
              {c && <td className="py-2.5 align-top" style={{ color: 'var(--ink-2)' }}>{c}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table of contents                                                     */
/* ------------------------------------------------------------------ */

const TOC = [
  { id: 'abstract',       label: '1. Abstract' },
  { id: 'background',     label: '2. Background' },
  { id: 'flywheel',       label: '3. The Flywheel' },
  { id: 'bonding-curve',  label: '4. Bonding Curve' },
  { id: 'fee-split',      label: '5. Fee Split' },
  { id: 'position',       label: '6. Position Lifecycle' },
  { id: 'keeper',         label: '7. Keeper Architecture' },
  { id: 'graduation',     label: '8. Graduation' },
  { id: 'tokenomics',     label: '9. Tokenomics' },
  { id: 'inf-token',      label: '10. The INF Token' },
  { id: 'strategy-layer', label: '11. Strategy Layer' },
  { id: 'security',       label: '12. Security Model' },
  { id: 'risks',          label: '13. Risks' },
  { id: 'roadmap',        label: '14. Roadmap' },
];

/* ------------------------------------------------------------------ */
/* Page                                                                  */
/* ------------------------------------------------------------------ */

export function Paper() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-gradient)' }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between"
        style={{ background: 'rgba(13,27,47,0.92)', backdropFilter: 'blur(14px)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => { void navigate('/'); }}
          className="display font-bold text-xl transition-colors hover:opacity-80"
          style={{ color: 'var(--ink)' }}
        >
          <span style={{ color: 'var(--accent-2)', textShadow: '0 0 16px var(--glow)' }}>∞</span>.fun
        </button>
        <a
          href="https://github.com/infinitEnigma/infinite.fun"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:bg-[var(--surface-strong)]"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          View on GitHub
        </a>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="text-xs font-mono mb-4 tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
            Whitepaper · v0.2 · September 2026
          </div>
          <H1>infinite.fun: A Perpetual-Backed Token Launchpad</H1>
          <p className="text-lg leading-relaxed mb-6" style={{ color: 'var(--subtle)' }}>
            A protocol where every launched token is permanently backed by a live leveraged
            perpetual position. Trading fees fund the position; realized profits burn supply.
            The engine never closes.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {['Arc Testnet', 'Solidity 0.8.28', 'GPL-3.0', 'USDC-native'].map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full border mono"
                style={{ borderColor: 'var(--border)', color: 'var(--subtle)', background: 'var(--surface)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Table of contents */}
        <div
          className="rounded-xl p-5 mb-12"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--subtle)' }}>
            Table of Contents
          </div>
          <div className="grid sm:grid-cols-2 gap-1">
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-sm py-0.5 hover:text-[var(--accent-2)] transition-colors"
                style={{ color: 'var(--muted)' }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* ---- 1. Abstract ---- */}
        <H2 id="abstract">1. Abstract</H2>
        <P>
          infinite.fun is a token launchpad built on Arc Testnet in which every ERC-20 token
          launched through the protocol is permanently linked to a leveraged perpetual futures
          position managed by an on-chain sub-wallet. The bonding curve collects a 1% fee on
          every buy and sell; those fees flow to the sub-wallet, which splits them across four
          destinations: perpetual margin (50%), creator earnings (15%), protocol treasury (20%),
          and a buyback-and-burn mechanism (15%). Profits realized from partial position closes
          are routed back to supply reduction. The position is never voluntarily closed at a
          loss. The result is a deflationary token mechanic in which sustained trading activity
          creates permanent, compounding downward pressure on circulating supply.
        </P>

        {/* ---- 2. Background ---- */}
        <H2 id="background">2. Background</H2>
        <P>
          Token launchpads in the current market follow a well-worn template: a bonding curve
          or fair-launch auction sells tokens, a fixed percentage of proceeds seeds a Uniswap
          pool at graduation, and thereafter the token trades freely with no protocol-level
          price support or supply reduction mechanism. The launched token becomes a pure
          speculation vehicle with no endogenous demand or structural deflationary pressure.
        </P>
        <P>
          Perpetual futures protocols, by contrast, have built deep liquidity and sophisticated
          fee structures, but are disconnected from the token-launch ecosystem. A perpetual
          position on BTC-PERP generates yield and P&L independently of whether any specific
          token exists.
        </P>
        <P>
          infinite.fun connects these two primitives. Each launched token is not merely a
          representation of community sentiment — it is the on-chain beneficiary of an active
          position. The position's margin grows with trading fees, its profits reduce token
          supply, and its existence creates a mechanical link between the external asset (the
          perp market) and the launched token's circulating supply. This produces a novel
          flywheel that self-reinforces as long as any trading occurs on the bonding curve.
        </P>

        {/* ---- 3. The Flywheel ---- */}
        <H2 id="flywheel">3. The Flywheel</H2>
        <P>
          The core mechanic operates as a closed feedback loop executed on every keeper tick
          (approximately every 15 seconds):
        </P>

        <div className="rounded-2xl p-6 my-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col gap-0">
            {[
              { step: '01', title: 'Trading activity', desc: 'Users buy and sell the token on the bonding curve. Every swap incurs a 1% flat fee retained by the curve contract.' },
              { step: '02', title: 'Fee accumulation', desc: 'Fees accumulate in the BondingCurve contract. The SubWallet polls and claims them on each keeper tick via claimFees().' },
              { step: '03', title: 'Fee split', desc: 'Claimed fees are split 50/15/20/15 across perp margin, creator, treasury, and buyback-burn.' },
              { step: '04', title: 'Margin growth', desc: 'The 50% perp slice is deposited into the Hyperliquid position as additional collateral, increasing effective leverage-adjusted exposure.' },
              { step: '05', title: 'Profit realization', desc: 'When unrealized P&L exceeds +50% of collateral, the keeper closes 25% of the position, collecting realized profit.' },
              { step: '06', title: 'Supply burn', desc: '75% of realized profit buys tokens on the bonding curve; those tokens are immediately burned. 25% flows to treasury.' },
            ].map((item, i, arr) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mono flex-shrink-0"
                    style={{ background: 'var(--surface-muted)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                  >
                    {item.step}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-px flex-1 my-1" style={{ background: 'var(--border)', minHeight: '24px' }} />
                  )}
                </div>
                <div className="pb-5">
                  <div className="font-semibold text-sm mb-1" style={{ color: 'var(--ink-2)' }}>{item.title}</div>
                  <div className="text-sm leading-relaxed" style={{ color: 'var(--subtle)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <P>
          The loop returns to step 1: with tokens burned, circulating supply is lower, the
          bonding curve price is higher, and the remaining tokens become more valuable — which
          increases the incentive to trade, generating more fees, which grow the position
          further. Under conditions of sustained trading, the flywheel compounds.
        </P>

        {/* ---- 4. Bonding Curve ---- */}
        <H2 id="bonding-curve">4. Bonding Curve</H2>
        <H3>Mechanism</H3>
        <P>
          The BondingCurve contract implements a constant-product invariant (xy = k) with
          virtual reserves. The initial state sets a virtual USDC reserve of 1 USDC and a
          virtual token reserve of 1,000,000,000 tokens (the full supply), establishing a
          near-zero initial price that rises continuously as USDC flows in.
        </P>
        <Callout accent>
          <strong style={{ color: 'var(--ink)' }}>Price formula:</strong>
          {' '}tokensOut = virtualTokenReserve × usdcIn / (virtualUsdcReserve + usdcIn)
          <br />
          <strong style={{ color: 'var(--ink)' }}>Spot price:</strong>
          {' '}price = virtualUsdcReserve × 10¹⁸ / virtualTokenReserve (in USDC per token, 18-decimal precision)
        </Callout>
        <H3>Fee structure</H3>
        <P>
          A flat 1% fee is deducted from every swap input before the AMM formula is applied.
          On buys the fee is taken from USDC in; on sells it is taken from USDC out. Fees
          accumulate in the contract and are claimed exclusively by the coin's SubWallet
          through the permissioned claimFees() function.
        </P>
        <H3>Slippage protection</H3>
        <P>
          Both buyTokens and sellTokens accept a minOut parameter. Transactions revert if
          the executed output falls below the caller's stated minimum, protecting users from
          sandwich attacks and price impact in the same block.
        </P>
        <H3>Graduation threshold</H3>
        <P>
          When cumulative real USDC collected (excluding fees) crosses the graduation
          threshold (420 USDC on testnet, to be set at a production value on mainnet),
          the curve emits a Graduated event and calls the factory's onGraduated hook.
          At graduation, trading halts on the bonding curve and remaining assets are
          eligible for migration to a Uniswap V2 pool (or V4 with a custom hook, planned
          for mainnet).
        </P>

        {/* ---- 5. Fee Split ---- */}
        <H2 id="fee-split">5. Fee Split — 50 / 15 / 20 / 15</H2>
        <P>
          Every fee claim distributes across four destinations enforced on-chain in the
          SubWallet contract. The split is fixed at deployment and cannot be altered by any
          actor including the keeper or factory owner.
        </P>
        <Table rows={[
          ['50%', 'Perp margin', 'Deposited into the Hyperliquid position as additional collateral, compounding leverage exposure over time.'],
          ['15%', 'Creator', 'Paid to the wallet that called launchCoin(). Incentivises creators to drive trading activity.'],
          ['20%', 'Protocol treasury', 'Held in a protocol-controlled multisig. Used for development, audits, and grants.'],
          ['15%', 'Buyback & burn (or LP)', 'Default: buys tokens on the bonding curve and burns them, reducing supply. Creator can configure this slice to accrue as LP liquidity instead.'],
        ]} />
        <Callout>
          Integer division over 6-decimal USDC amounts means up to 3 wei of dust per claim
          may be unallocated. This dust is held in the SubWallet and is recoverable only by
          the keeper via withdrawTo() with governance consent.
        </Callout>

        {/* ---- 6. Position Lifecycle ---- */}
        <H2 id="position">6. Position Lifecycle</H2>
        <P>
          The perp position backing each token follows a strict one-directional lifecycle.
          The position is never voluntarily closed at a loss. This is not merely a policy
          decision — it is enforced by the absence of any function that closes the full
          position or withdraws collateral without a corresponding profit realization.
        </P>
        <Ul>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Open (once).</strong> When accumulated collateral in the SubWallet reaches $20 USDC, the keeper calls openPosition(). The position is long on the creator-selected market at the creator-selected leverage (1–25×). positionOpen is set to true and cannot be set again — re-calling openPosition() reverts.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Add margin.</strong> On each keeper tick, the 50% perp slice from fee claims is deposited as additional collateral via addMargin(). This gradually reduces effective leverage as the position ages, reducing liquidation risk without closing the position.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Profit take (partial close).</strong> When unrealized P&L exceeds +50% of total collateral, the keeper calls takeProfitSlice(), which closes 25% of the nominal position size. Realized profit is routed: 75% to buyback+burn, 25% to treasury.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Drawdown response.</strong> If the mark price falls below entry and unrealized loss exceeds a configurable threshold (default: 30% of collateral), the keeper increases the margin deposit from the 50% slice to 100% of available SubWallet balance, effectively doubling down to defend the position. The position is never margin-called voluntarily.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Liquidation.</strong> If the position is liquidated by the exchange (extreme adverse price move), the SubWallet records the event, emits PositionLiquidated, and the keeper opens a new position once $20 of fresh fees have accrued. The lifecycle restarts.</Li>
        </Ul>

        {/* ---- 7. Keeper ---- */}
        <H2 id="keeper">7. Keeper Architecture</H2>
        <P>
          The keeper is an off-chain TypeScript service that executes the protocol's active
          logic. It polls every 15 seconds and processes each active coin in sequence.
        </P>
        <H3>Responsibilities per tick</H3>
        <Ul>
          <Li>Call BondingCurve.claimFees() for each coin with pending fees above the gas threshold.</Li>
          <Li>Execute the 50/15/20/15 split via SubWallet.claimAndSplit().</Li>
          <Li>Read position state from the Hyperliquid API (collateral, size, mark price, unrealized P&L).</Li>
          <Li>Branch: if P&L &gt; +50%, call takeProfitSlice(); if drawdown &gt; 30%, increase margin deposit.</Li>
          <Li>Write a position snapshot to the Postgres database (collateral, size, entry price, mark price, unrealized P&L, timestamp).</Li>
          <Li>Emit Discord webhook notifications on graduation, profit take, and near-liquidation events.</Li>
        </Ul>
        <H3>Authorization</H3>
        <P>
          The keeper's EOA address is registered in KeeperRegistry at deploy time. Every
          state-changing function on SubWallet carries an onlyKeeper modifier that reverts
          if called by any other address. The keeper address can be rotated by the registry
          owner through a two-step commit-reveal pattern to prevent front-running.
        </P>
        <H3>Failure modes</H3>
        <P>
          The keeper is stateless — it derives all necessary state from on-chain data and
          the Hyperliquid API on every tick. A crashed or restarted keeper misses ticks but
          does not cause fund loss or incorrect state. Fee accumulation during downtime is
          processed on the next successful tick.
        </P>

        {/* ---- 8. Graduation ---- */}
        <H2 id="graduation">8. Graduation and Liquidity Migration</H2>
        <P>
          When a coin's bonding curve crosses the graduation threshold, the protocol
          transitions from the curve-based price discovery phase to open market trading.
        </P>
        <Ul>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Curve halts.</strong> buyTokens() and sellTokens() revert after graduation. No new buys or sells on the curve.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>LP migration.</strong> The factory calls a Uniswap V2 addLiquidity() with the remaining curve USDC and a proportional token amount. LP tokens are locked in the SubWallet permanently, providing permanent base liquidity.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Position continues.</strong> The SubWallet's perp position remains active after graduation. Swap fees from the Uniswap pool (if routed back to SubWallet) continue to compound the position.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>V4 upgrade path.</strong> On mainnet, the migration target will be a Uniswap V4 pool with a custom GraduationHook that routes a percentage of LP swap fees back into the SubWallet margin on every swap. This is not yet available on testnet.</Li>
        </Ul>

        {/* ---- 9. Tokenomics ---- */}
        <H2 id="tokenomics">9. Tokenomics</H2>
        <P>
          Each token launched through infinite.fun has identical tokenomics enforced by the
          protocol contracts. There is no privileged pre-mine, no team allocation, and no
          vesting schedule. All 1,000,000,000 tokens are minted to the bonding curve contract
          at deployment and are available exclusively through the curve from block zero.
        </P>
        <Table rows={[
          ['Total supply', '1,000,000,000 (fixed)', 'Set at construction. No mint function.'],
          ['Initial distribution', '100% to bonding curve', 'No pre-mine, no team allocation.'],
          ['Burn mechanism', 'Via buyback on profit-take', '75% of realized P&L used to buy + burn.'],
          ['Creator allocation', '0% at launch', 'Creator earns 15% of ongoing fees only.'],
          ['LP lock', 'Permanent post-graduation', 'Migration LP tokens held in SubWallet forever.'],
        ]} />
        <P>
          The deflationary pressure scales with two independent variables: trading volume
          (which drives fee accumulation and faster margin growth) and the performance of the
          underlying perp market (which drives the magnitude of profit-takes). Under
          conditions of high volume and a rising underlying market, both mechanisms accelerate
          simultaneously.
        </P>

        {/* ---- 10. The INF Token ---- */}
        <H2 id="inf-token">10. The INF Token</H2>
        <P>
          INF is the governance and value-accrual token of the infinite.fun protocol.
          It is a fixed-supply ERC-20 with voting capabilities (ERC20Votes) that enables
          on-chain governance over protocol parameters. INF is not required to use the
          launchpad — any wallet can launch a coin, buy, sell, and earn creator fees without
          holding INF. It enhances participation and aligns long-term incentives.
        </P>
        <H3>Fixed Supply and Allocation</H3>
        <P>
          The total supply is fixed at <strong style={{ color: 'var(--ink-2)' }}>1,000,000,000 INF</strong>.
          The entire supply is minted at construction with no mint function. Allocation at genesis:
        </P>
        <Table rows={[
          ['40% — Community',   '400,000,000 INF', 'Airdrop, liquidity mining, community grants. Controlled by governance.'],
          ['25% — Treasury',    '250,000,000 INF', 'Protocol operations, development, audits. Controlled by governance multisig.'],
          ['20% — Team',        '200,000,000 INF', '4-year linear vesting, 1-year cliff. Held in TokenVesting contract.'],
          ['10% — Ecosystem',   '100,000,000 INF', 'Keeper operators, integrators, auditors, protocol partnerships.'],
          ['5% — Liquidity',    '50,000,000 INF',  'Initial DEX liquidity bootstrap at TGE. Burned LP tokens.'],
        ]} />
        <H3>Utility</H3>
        <Ul>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Governance.</strong> INF holders propose and vote on protocol parameters including launch fee, platform fee basis points, graduation thresholds, and strategy allocation.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Fee sharing.</strong> A portion of PlatformTreasury revenue will be distributed to INF stakers proportional to their stake weight. The exact share is a governance parameter.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Keeper rights.</strong> Staked INF grants eligibility to operate a keeper for one or more coins, earning a portion of the keeper fee slice. This decentralizes the keeper layer.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Access tiers.</strong> INF holders above a defined threshold receive reduced launch fees and early access to experimental markets.</Li>
        </Ul>
        <Callout accent>
          The INF token contract is deployed on Arc Testnet at{' '}
          <span className="mono text-xs" style={{ color: 'var(--accent-2)' }}>
            0x199c7111bdfeB8aA8a3ABf7AB69D5554aD8c7A37
          </span>.
          TGE timing and distribution details will be announced through official channels.
          No presale, no private sale. Community allocation is 40%.
        </Callout>

        {/* ---- 11. Strategy Layer ---- */}
        <H2 id="strategy-layer">11. Strategy Layer</H2>
        <P>
          The keeper currently executes a single hardcoded strategy for every coin: add margin
          in drawdown, take a 25% partial close at +50% unrealized P&L. This is a starting
          point, not a ceiling.
        </P>
        <P>
          The protocol is designed to support a pluggable strategy layer. The{' '}
          <span className="mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--accent-2)' }}>
            IPositionStrategy
          </span>{' '}
          interface (already present in the repository) defines an advisory pattern: a strategy
          contract receives the current position state and returns an action recommendation. The
          keeper executes the action through the SubWallet. The strategy has no custody of funds.
        </P>
        <H3>Governance-Approved Strategies</H3>
        <P>
          Community governance will maintain a registry of approved strategy implementations.
          Strategies must pass an on-chain safety review and INF holder vote before activation.
          Three strategy tiers are planned: Conservative, Balanced (current default), and
          Aggressive. Coin creators choose a tier at launch.
        </P>
        <H3>Agent-Driven Execution</H3>
        <P>
          Beyond rule-based strategies, the layer is designed to accommodate trained agents that
          post signed position recommendations on-chain. An agent monitors off-chain signals and
          submits a signed recommendation the keeper validates and executes. Agents advise, never
          custody. This separates intelligence from execution and allows strategy logic to evolve
          without changing the SubWallet contracts.
        </P>
        <Callout>
          The strategy layer is under active development. The interface and registry design
          are intentionally public — developers building on infinite.fun are encouraged to
          propose strategy implementations for governance review.
        </Callout>

        {/* ---- 12. Security ---- */}
        <H2 id="security">12. Security Model</H2>
        <H3>Access control</H3>
        <Ul>
          <Li>All SubWallet state-changing functions are gated by onlyKeeper. No user, creator, or third party can call them.</Li>
          <Li>Token.burn() is callable only by the registered SubWallet address, set once at deployment via a one-time factory setter.</Li>
          <Li>BondingCurve.claimFees() is callable only by the SubWallet.</Li>
          <Li>KeeperRegistry.setFactory() is callable only by the registry owner (keeper EOA at deploy).</Li>
        </Ul>
        <H3>Fund safety</H3>
        <Ul>
          <Li>All ERC-20 interactions use OpenZeppelin SafeERC20 (forceApprove, safeTransfer, safeTransferFrom).</Li>
          <Li>Residual allowances are cleared after every external call (approve to 0 after bridge interaction).</Li>
          <Li>SubWallet.withdrawTo() is restricted to the protocol treasury address only — it cannot be called to an arbitrary recipient.</Li>
          <Li>openPosition() enforces a single-position invariant; re-opening reverts until the position is closed or liquidated.</Li>
          <Li>buyback slippage is bounded by a minTokensOut parameter computed by the keeper from a TWAP before calling executeBuyback().</Li>
        </Ul>
        <H3>Audit status</H3>
        <Callout>
          The contracts have received an internal security review covering all Critical and
          High severity findings per the Arc Studio balanced audit tier. An independent
          third-party audit by a specialist firm is planned before mainnet deployment.
          Do not use on mainnet with real funds until that audit is complete and the report
          is published.
        </Callout>

        {/* ---- 11. Risks ---- */}
        <H2 id="risks">13. Risks</H2>
        <Ul>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Position liquidation.</strong> In extreme adverse market conditions, the backing position may be liquidated. The SubWallet balance is lost. The protocol restarts from fees but the P&L history resets.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Keeper downtime.</strong> If the keeper is offline for an extended period, fees accumulate unclaimed, the margin is not topped up, and the position may drift closer to liquidation. The keeper is designed to be stateless and easy to restart.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Hyperliquid bridge risk.</strong> The SubWallet interacts with the Hyperliquid on-chain bridge. Any vulnerability or change in the bridge contract could affect fund safety.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Smart contract risk.</strong> Despite the internal review, undiscovered vulnerabilities may exist. An independent audit is mandatory before mainnet deployment.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Low-volume stall.</strong> A coin with minimal trading generates minimal fees. The position is opened only once $20 has accrued. Very low-volume coins may never open a position and thus never burn supply.</Li>
          <Li><strong style={{ color: 'var(--ink-2)' }}>Market correlation.</strong> The underlying perp tracks an external asset (BTC, ETH, NVDA, etc.) chosen by the creator. The token's deflationary pressure is therefore correlated to the performance of that external asset, not the token itself.</Li>
        </Ul>

        {/* ---- 12. Roadmap ---- */}
        <H2 id="roadmap">14. Roadmap</H2>
        <Table rows={[
          ['v0.1',     'Arc Testnet: bonding curve, SubWallet, keeper, frontend, PlatformTreasury, internal audit.'],
          ['v0.2 — Now', 'INF token deployed (testnet). IPositionStrategy interface published. Admin dashboard. Portfolio page. Live market prices (Pyth proxy).'],
          ['v0.3',     'Third-party security audit. Keeper failover (redundant nodes). Keeper rotation via commit-reveal.'],
          ['v0.4',     'Mainnet deployment. Uniswap V4 graduation hook routing post-graduation LP fees back to SubWallet.'],
          ['v0.5',     'Strategy Layer v1: governance-approved strategy registry, conservative/balanced/aggressive tiers selectable at launch.'],
          ['v0.6',     'Agent-driven strategies: signed off-chain recommendations submitted on-chain, validated by keeper. INF staker keeper rights.'],
          ['v0.7',     'INF TGE and liquidity bootstrap. Fee-sharing to stakers. Multi-perp basket support (e.g. 50% BTC, 50% ETH).'],
          ['v1.0',     'DAO governance live: fee parameters, graduation threshold, strategy approval, treasury allocation — all controlled by INF holders.'],
        ]} />

        {/* Footer note */}
        <div
          className="mt-16 pt-8 border-t text-xs leading-relaxed"
          style={{ borderColor: 'var(--border)', color: 'var(--subtle)' }}
        >
          <p className="mb-2">
            <strong style={{ color: 'var(--muted)' }}>Disclaimer.</strong>{' '}
            This document is for informational purposes only. Nothing in this whitepaper
            constitutes financial, investment, or legal advice. The protocol is in active
            development and deployed on testnet only. All figures, thresholds, and parameters
            are subject to change before mainnet deployment.
          </p>
          <p>
            infinite.fun is released under the{' '}
            <a
              href="https://www.gnu.org/licenses/gpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--accent-2)] transition-colors"
            >
              GNU General Public License v3.0
            </a>
            . Source available at{' '}
            <a
              href="https://github.com/infinitEnigma/infinite.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--accent-2)] transition-colors"
            >
              github.com/infinitEnigma/infinite.fun
            </a>.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
