const { expect } = require('chai')
const { ethers } = require('hardhat')

// TODO- set up deployment of BAO Markets contracts, AAVE markets, and Curve pools for full coverage testing
describe('LiquidationController Contract', () => {
  let LiquidationController, contract, address

  beforeEach(async () => {
    LiquidationController = await ethers.getContractFactory(
      'LiquidationController',
    )
    address = (await ethers.getSigners())[0].address
    contract = await LiquidationController.deploy()
  })

  describe("Deployment", () => {
    it("Should set the correct contract owner", async () => {
      expect(await contract.owner()).to.eq(address)
    })

    // etc.
  })

  describe("Liquidations", () => {
    it("Should liquidate a single user with total debt >= total collateral", () => {
      // ...
    })

    it("Should liquidate a single user with total debt <= total collateral", () => {
      // ...
    })

    it("Should liquidate 5 users", () => {
      // ...
    })

    it("Should liquidate 10 users", () => {
      // ...
    })

    // etc.
  })
})