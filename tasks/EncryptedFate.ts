import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const CONTRACT_NAME = "EncryptedFate";

task("task:address", "Prints the EncryptedFate address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get(CONTRACT_NAME);

  console.log(`${CONTRACT_NAME} address is ${deployment.address}`);
});

task("task:start-game", "Initializes the encrypted path game for the caller")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();

    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);
    const tx = await contract.connect(signer).startGame();
    console.log(`Starting game for ${signer.address}. tx: ${tx.hash}`);
    await tx.wait();
    console.log("Game started and encrypted score initialized to 1000.");
  });

task("task:submit-choice", "Submits an encrypted choice for a specific step")
  .addParam("step", "Step index to submit (0-3)")
  .addParam("value", "The chosen path value (1-3)")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    const step = parseInt(taskArguments.step, 10);
    const value = parseInt(taskArguments.value, 10);

    if (!Number.isInteger(step) || step < 0 || step > 3) {
      throw new Error(`Invalid --step ${taskArguments.step}. Must be between 0 and 3.`);
    }

    if (!Number.isInteger(value) || value < 1 || value > 3) {
      throw new Error(`Invalid --value ${taskArguments.value}. Must be between 1 and 3.`);
    }

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const encrypted = await fhevm.createEncryptedInput(deployment.address, signer.address).add32(value).encrypt();

    const tx = await contract
      .connect(signer)
      .submitPathChoice(step, encrypted.handles[0], encrypted.inputProof);

    console.log(
      `Submitting choice ${value} for step ${step} by ${signer.address} on ${deployment.address}. tx: ${tx.hash}`,
    );
    await tx.wait();
    console.log("Choice submitted and stored encrypted on-chain.");
  });

task("task:decrypt-score", "Decrypts the caller score from EncryptedFate")
  .addOptionalParam("player", "Player address to inspect. Defaults to the first signer.")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const playerAddress = (taskArguments.player as string) ?? signer.address;

    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);
    const encryptedScore = await contract.getEncryptedScore(playerAddress);

    if (encryptedScore === ethers.ZeroHash) {
      console.log(`Encrypted score for ${playerAddress} is uninitialized`);
      return;
    }

    const clearScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedScore,
      deployment.address,
      signer,
    );

    console.log(`Encrypted score: ${encryptedScore}`);
    console.log(`Clear score   : ${clearScore}`);
  });

task("task:decrypt-outcome", "Decrypts whether the path was fully correct (1) or not (0)")
  .addOptionalParam("player", "Player address to inspect. Defaults to the first signer.")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const playerAddress = (taskArguments.player as string) ?? signer.address;

    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);
    const encryptedOutcome = await contract.getEncryptedOutcome(playerAddress);

    if (encryptedOutcome === ethers.ZeroHash) {
      console.log(`Encrypted outcome for ${playerAddress} is uninitialized`);
      return;
    }

    const clearOutcome = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedOutcome,
      deployment.address,
      signer,
    );

    console.log(`Encrypted outcome: ${encryptedOutcome}`);
    console.log(`Clear outcome    : ${clearOutcome}`);
  });
