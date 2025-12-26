import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers, fhevm } from "hardhat";

describe("EncryptedFateSepolia", function () {
  let player: HardhatEthersSigner;
  let gameAddress: string;
  let steps: number;
  let step: number;

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    await fhevm.initializeCLIApi();

    try {
      const deployment = await deployments.get("EncryptedFate");
      gameAddress = deployment.address;
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    player = ethSigners[0];
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("plays through the correct path", async function () {
    steps = 12;
    this.timeout(6 * 40000);

    const contract = await ethers.getContractAt("EncryptedFate", gameAddress);

    const startTx = await contract.connect(player).startGame();
    await startTx.wait();
    const encryptedStartScore = await contract.getEncryptedScore(player.address);
    const clearStartScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStartScore,
      gameAddress,
      player,
    );
    expect(clearStartScore).to.eq(1000);

    const path = [1, 1, 1, 2];
    for (let i = 0; i < path.length; i++) {
      const encrypted = await fhevm.createEncryptedInput(gameAddress, player.address).add32(path[i]).encrypt();
      const tx = await contract.connect(player).submitPathChoice(i, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();
    }

    const encryptedOutcome = await contract.getEncryptedOutcome(player.address);
    const clearOutcome = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedOutcome,
      gameAddress,
      player,
    );

    expect(clearOutcome).to.eq(1);
  });
});
