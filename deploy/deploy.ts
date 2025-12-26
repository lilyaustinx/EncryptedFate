import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedEncryptedFate = await deploy("EncryptedFate", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedFate contract: `, deployedEncryptedFate.address);
};
export default func;
func.id = "deploy_encryptedFate"; // id required to prevent reexecution
func.tags = ["EncryptedFate"];
