export function Footer() {
  return (
    <footer
      className="relative z-10 mt-20 border-t px-4 py-10"
      style={{ borderColor: 'var(--border)', background: 'rgba(8,15,28,0.8)' }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          {/* Brand */}
          <div>
            <div className="display font-bold text-xl mb-1 text-glow" style={{ color: 'var(--accent-2)' }}>
              ∞<span style={{ color: 'var(--ink)' }}>.fun</span>
            </div>
            <p className="text-xs max-w-xs" style={{ color: 'var(--subtle)' }}>
              Every coin backs a live leveraged position.
              Trading fees fund the perp. Profits burn supply. The engine never stops.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col sm:items-end gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <a
              href="https://github.com/infinitEnigma/infinite.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent-2)] transition-colors flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.005 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://perpshood.fun/paper"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent-2)] transition-colors"
            >
              Whitepaper
            </a>
            <a
              href="https://arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent-2)] transition-colors"
            >
              Built on Arc
            </a>
          </div>
        </div>

        {/* Contracts */}
        <div
          className="rounded-xl p-4 mb-6 text-xs space-y-1.5"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <div className="font-medium mb-2" style={{ color: 'var(--muted)' }}>Deployed contracts — Arc Testnet (Chain ID 5042002)</div>
          {[
            { label: 'KeeperRegistry',   addr: '0xfd8B9Ddb776Bd1608F1774255B7FE2caf674fa08' },
            { label: 'LaunchpadFactory', addr: '0x937a4C48E3C50875AF19825B177d6A71b5194C31' },
            { label: 'USDC',             addr: '0x3600000000000000000000000000000000000000' },
          ].map(({ label, addr }) => (
            <div key={label} className="flex items-center gap-2 flex-wrap">
              <span style={{ color: 'var(--subtle)', minWidth: '120px' }}>{label}</span>
              <span className="mono" style={{ color: 'var(--accent)' }}>{addr}</span>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs" style={{ color: 'var(--subtle)' }}>
          <span>© 2026 infinite.fun — Released under the <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-2)] transition-colors underline underline-offset-2">GPL-3.0</a> license.</span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }}
            />
            Arc Testnet
          </span>
        </div>

        {/* Audit disclaimer */}
        <p className="text-xs mt-4 leading-relaxed" style={{ color: 'var(--subtle)', opacity: 0.7 }}>
          This code has received an internal security review but has not been independently audited by a third party.
          Use on mainnet at your own risk. This is not financial advice.
        </p>
      </div>
    </footer>
  );
}
