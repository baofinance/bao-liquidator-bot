import { ethers } from 'hardhat'

async function main() {
  const LiquidationController = await ethers.getContractFactory(
    'LiquidationController',
  )
  const liqController = await LiquidationController.deploy()

  await liqController.deployed()

  console.log('LiquidationController deployed to:', liqController.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
