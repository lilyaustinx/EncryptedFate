import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">EF</div>
        <div>
          <p className="brand-title">Encrypted Fate</p>
          <p className="brand-subtitle">Zama FHE path game</p>
        </div>
      </div>
      <ConnectButton chainStatus="icon" showBalance={false} label="Connect" />
    </header>
  );
}
