import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Encrypted Fate',
  projectId: 'f20c8e1f3c3a4099a5d28ad1a7c1fbb8',
  chains: [sepolia],
  ssr: false,
});
