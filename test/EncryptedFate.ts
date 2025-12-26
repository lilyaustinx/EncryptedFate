import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { EncryptedFate, EncryptedFate__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedFate")) as EncryptedFate__factory;
  const gameContract = (await factory.deploy()) as EncryptedFate;
  const gameAddress = await gameContract.getAddress();

  return { gameContract, gameAddress };
}

async function encryptChoice(contractAddress: string, value: number, player: HardhatEthersSigner) {
  return fhevm.createEncryptedInput(contractAddress, player.address).add32(value).encrypt();
}

describe("EncryptedFate", function () {
  let signers: Signers;
  let gameContract: EncryptedFate;
  let gameAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ gameContract, gameAddress } = await deployFixture());
  });

  it("initializes encrypted score to 1000 on start", async function () {
    await gameContract.connect(signers.alice).startGame();
    const encryptedScore = await gameContract.getEncryptedScore(signers.alice.address);

    const clearScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedScore,
      gameAddress,
      signers.alice,
    );

    const [stepsSubmitted, finished] = await gameContract.getProgress(signers.alice.address);

    expect(clearScore).to.eq(1000);
    expect(stepsSubmitted).to.eq(0);
    expect(finished).to.eq(false);
  });

  it("rewards a full correct path with a 1000 point bonus", async function () {
    await gameContract.connect(signers.alice).startGame();

    const correctPath = [1, 1, 1, 2];
    for (let i = 0; i < correctPath.length; i++) {
      const encrypted = await encryptChoice(gameAddress, correctPath[i], signers.alice);
      await gameContract
        .connect(signers.alice)
        .submitPathChoice(i, encrypted.handles[0], encrypted.inputProof);
    }

    const encryptedScore = await gameContract.getEncryptedScore(signers.alice.address);
    const clearScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedScore,
      gameAddress,
      signers.alice,
    );

    const encryptedOutcome = await gameContract.getEncryptedOutcome(signers.alice.address);
    const clearOutcome = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedOutcome,
      gameAddress,
      signers.alice,
    );

    const [stepsSubmitted, finished] = await gameContract.getProgress(signers.alice.address);

    expect(clearScore).to.eq(2000);
    expect(clearOutcome).to.eq(1);
    expect(stepsSubmitted).to.eq(4);
    expect(finished).to.eq(true);
  });

  it("keeps the base score if any choice is wrong", async function () {
    await gameContract.connect(signers.alice).startGame();

    const wrongPath = [1, 2, 1, 2];
    for (let i = 0; i < wrongPath.length; i++) {
      const encrypted = await encryptChoice(gameAddress, wrongPath[i], signers.alice);
      await gameContract
        .connect(signers.alice)
        .submitPathChoice(i, encrypted.handles[0], encrypted.inputProof);
    }

    const encryptedScore = await gameContract.getEncryptedScore(signers.alice.address);
    const clearScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedScore,
      gameAddress,
      signers.alice,
    );

    const encryptedOutcome = await gameContract.getEncryptedOutcome(signers.alice.address);
    const clearOutcome = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedOutcome,
      gameAddress,
      signers.alice,
    );

    expect(clearScore).to.eq(1000);
    expect(clearOutcome).to.eq(0);
  });

  it("rejects out-of-order submissions", async function () {
    await gameContract.connect(signers.alice).startGame();

    const encrypted = await encryptChoice(gameAddress, 1, signers.alice);
    await expect(
      gameContract.connect(signers.alice).submitPathChoice(2, encrypted.handles[0], encrypted.inputProof),
    ).to.be.revertedWith("Submit the next step");
  });
});
