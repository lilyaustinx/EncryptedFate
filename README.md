# Encrypted Fate

Encrypted Fate is a four-step path game where every move and every score update stays encrypted on-chain.
Players start with an encrypted 1000 points, choose one of three branches at each step, and only the hidden
route 1, 1, 1, 2 yields the encrypted 1000-point bonus. At no point are the path, choices, or final score
revealed in plaintext on-chain.

This repository includes the Solidity contract, Hardhat tasks and tests, deployment scripts, and a React
frontend that uses the Zama Relayer SDK for client-side encryption and decryption.

## What problem this solves

Traditional on-chain games reveal player choices and results, which enables copycatting, front-running,
and privacy leaks. This project uses fully homomorphic encryption (FHE) to keep gameplay private while
still enforcing rules and rewards on-chain.

- **Privacy for players**: Choices, correctness, and score remain encrypted.
- **On-chain enforcement**: The contract validates the full path and awards the bonus without plaintext.
- **Trust-minimized UX**: The frontend handles encryption and decryption with the Zama Relayer SDK, while
  the contract remains the single source of truth.

## Key advantages

- **FHE-native gameplay**: All comparisons and scoring run on encrypted values.
- **Deterministic rules**: The correct path is fixed in the contract and never exposed.
- **Clear flow**: Start game, submit choices in order, receive encrypted outcome and score.
- **Composable tooling**: Hardhat tasks cover the end-to-end flow for local and Sepolia usage.
- **Frontend discipline**: Reads use viem, writes use ethers, no local storage, no mock data.

## Game rules (on-chain)

- The game has 4 steps (0 to 3).
- Each step accepts a choice in the range 1 to 3.
- The correct path is 1, 1, 1, 2.
- Every player starts with an encrypted score of 1000.
- If all four choices are correct, the encrypted score increases by 1000.
- Choices must be submitted in order; skipping or reordering is rejected.

## Contract overview

Contract: `contracts/EncryptedFate.sol`

Core methods:

- `startGame()` initializes a player with encrypted 1000 points and resets choices.
- `submitPathChoice(stepIndex, encryptedChoice, inputProof)` stores an encrypted choice and checks
  correctness against the encrypted path. Once all 4 steps are submitted, the contract finalizes the
  encrypted outcome and score.
- `getEncryptedScore(address)`, `getEncryptedOutcome(address)`, `getEncryptedChoice(address, step)`
  return encrypted values for client-side decryption.
- `getProgress(address)` returns the number of submitted steps and whether the game is finished.
- `getPathLength()` returns 4.

Important constraints:

- All encrypted values are `euint32` and never decrypted on-chain.
- View methods do not use `msg.sender`; the caller address is explicit.
- Access is managed via `FHE.allow` to let the player decrypt their own state.

## Tech stack

Smart contract and tooling:

- Solidity ^0.8.24
- Zama FHEVM libraries (`@fhevm/solidity`)
- Hardhat + hardhat-deploy + fhevm plugin
- TypeScript tasks for encryption, submission, and decryption

Frontend:

- React + Vite
- viem for reads
- ethers for writes (via RainbowKit signer)
- RainbowKit + wagmi for wallet UX
- Zama Relayer SDK for encryption/decryption
- No Tailwind, no local storage, no frontend environment variables

## Repository layout

- `contracts/` Solidity contract
- `deploy/` deployment script
- `tasks/` CLI tasks to start the game, submit encrypted choices, and decrypt results
- `test/` tests for the mock FHEVM and Sepolia
- `frontend/` React app (no root imports)

## Setup and development

### Prerequisites

- Node.js and npm
- A wallet with Sepolia ETH for deployment and testing
- An Infura API key

### Install dependencies

```bash
npm install
```

### Environment configuration (deployment only)

Create a `.env` file at the repo root with a single private key (no mnemonic):

```
PRIVATE_KEY=<private_key_without_0x>
INFURA_API_KEY=<infura_key>
ETHERSCAN_API_KEY=<optional_for_verification>
```

### Compile and test (mock FHEVM)

```bash
npm run compile
npm test
```

## Tasks (CLI)

The Hardhat tasks are designed for encrypted flows. Example usage:

```bash
npx hardhat task:address
npx hardhat task:start-game
npx hardhat task:submit-choice --step 0 --value 1
npx hardhat task:submit-choice --step 1 --value 1
npx hardhat task:submit-choice --step 2 --value 1
npx hardhat task:submit-choice --step 3 --value 2
npx hardhat task:decrypt-score
npx hardhat task:decrypt-outcome
```

## Deployment

Local FHEVM:

```bash
npm run deploy:localhost
```

Sepolia:

```bash
npm run deploy:sepolia
```

After deployment, the ABI and address are written to:

- `deployments/sepolia/EncryptedFate.json`

Use that file as the source of truth for the frontend ABI and contract address.

## Frontend setup

Frontend lives in `frontend/`. It assumes Sepolia only and does not use localhost or local storage.
Reads use viem; writes use ethers with the RainbowKit signer. Encryption and decryption are performed
with the Zama Relayer SDK.

### Install and run

```bash
cd frontend
npm install
npm run dev
```

### Contract integration

- Copy the ABI from `deployments/sepolia/EncryptedFate.json` into
  `frontend/src/config/contracts.ts`.
- Update the contract address in the same file after deployment.
- Do not introduce frontend `.env` usage or `.json` configuration files.

## Testing

- `npm test` for the mock FHEVM
- `npm run test:sepolia` after deploying to Sepolia (requires funded deployer)

## Security and privacy notes

- FHE keeps scores and choices encrypted on-chain, but you must trust the relayer to execute encryption
  and decryption correctly for the client.
- This project has not been audited. Use at your own risk for real value.
- The correct path is fixed and stored encrypted, which is sufficient for this game but not flexible for
  dynamic content without additional encrypted data handling.

## Limitations

- Single fixed path and score reward.
- No replay protection across accounts.
- No leaderboard or public statistics (by design, to preserve privacy).
- Requires the relayer flow for encryption and decryption, which adds client complexity.

## Roadmap

- Configurable encrypted paths and dynamic rewards per session.
- Multi-round gameplay with aggregate encrypted scoring.
- Optional anti-bot measures and rate limiting.
- Improved UX around progress, relayer status, and error recovery.
- Additional test coverage for edge cases and contract events.

## License

BSD-3-Clause-Clear
