/*
██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██╔══██╗
██████╦╝███████║██║░░██║
██╔══██╗██╔══██║██║░░██║
██████╦╝██║░░██║╚█████╔╝
╚═════╝░╚═╝░░╚═╝░╚════╝░
██╗░░░░░██╗░██████╗░██╗░░░██╗██╗██████╗░░█████╗░████████╗░█████╗░██████╗░
██║░░░░░██║██╔═══██╗██║░░░██║██║██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗
██║░░░░░██║██║██╗██║██║░░░██║██║██║░░██║███████║░░░██║░░░██║░░██║██████╔╝
██║░░░░░██║╚██████╔╝██║░░░██║██║██║░░██║██╔══██║░░░██║░░░██║░░██║██╔══██╗
███████╗██║░╚═██╔═╝░╚██████╔╝██║██████╔╝██║░░██║░░░██║░░░╚█████╔╝██║░░██║
╚══════╝╚═╝░░░╚═╝░░░░╚═════╝░╚═╝╚═════╝░╚═╝░░╚═╝░░░╚═╝░░░░╚════╝░╚═╝░░╚═╝

                  ██
                  ██
                ██░░██
                ██░░██
              ▓▓░░░░░░▓▓
              ██░░░░░░▓▓
            ▒▒▒▒░░░░░░▒▒▒▒
          ██░░▒▒▒▒░░░░░░░░██
        ██░░░░▒▒▒▒░░░░░░░░░░██
      ▓▓░░░░▒▒▒▒▒▒▒▒░░░░░░░░░░▓▓
    ▒▒▒▒░░▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░
    ▓▓░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░██
  ▓▓░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░██
  ██░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░██
  ▓▓░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░▓▓
  ▓▓░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░██
  ▓▓░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░██
    ██░░░░░░░░░░░░░░░░░░░░░░░░░░██
    ▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░██
      ▓▓░░░░░░░░░░░░░░░░░░░░░░██
        ██████▓▓████▓▓████████
 */

import Constants from './constants'
import Web3 from 'web3'
import BigNumber from 'bignumber.js'
import fs from 'fs'
import logger from './utils/logger'
import inquirer from 'inquirer'
import chalk from 'chalk'
import GraphUtil from './utils/graph'
import Multicall from './utils/multicall'
import { Multicall as MC } from 'ethereum-multicall'
import { decimate } from './utils/numbers'
import { AbiItem } from 'web3-utils'

// ABIs
import erc20Abi from './abi/erc20.json'
import cTokenAbi from './abi/ctoken.json'
import oracleAbi from './abi/marketOracle.json'
import comptrollerAbi from './abi/comptroller.json'

// Initialize Web3 & MultiCall
const web3 = new Web3(new Web3.providers.HttpProvider(Constants.infuraURI))
const multicall = new MC({
  web3Instance: web3,
  tryAggregate: true,
})

// pull private key from secret file
const secret = fs.readFileSync('.secret').toString().trim()
web3.eth.accounts.wallet.add(secret)

const contracts = {
  comptroller: new web3.eth.Contract(
    comptrollerAbi as AbiItem[],
    Constants.comptrollerAddress,
  ),
  oracle: new web3.eth.Contract(
    oracleAbi as AbiItem[],
    Constants.oracleAddress,
  ),
}

const runLiquidator = async () => {
  console.log('------------------------------------------------')
  logger.info('Querying BAO subgraph...')

  const { comptroller, oracle } = contracts
  const data: any = await GraphUtil.getUsersAndMarkets()
  logger.success('Fetched data from subgraph.')
  logger.info(
    `Using ${chalk.greenBright(
      data.markets.length,
    )} markets & ${chalk.greenBright(data.accounts.length)} accounts`,
  )

  let marketToUnderlying = {}
  let underlyingPricesUSD = {}
  const priceQueryMC = Multicall.createCallContext([
    {
      ref: 'MarketOracle',
      contract: oracle,
      calls: data.markets.map((marketInfo) => ({
        method: 'getUnderlyingPrice',
        ref: marketInfo.id,
        params: [marketInfo.id],
      })),
    },
  ])
  logger.info('Querying market price oracle...')
  const { MarketOracle: prices } = Multicall.parseCallResults(
    await multicall.call(priceQueryMC),
  )
  logger.success('Oracle prices received.')
  data.markets.forEach((market) => {
    const priceInfo = prices.find((price) => price.ref === market.id)
    underlyingPricesUSD = {
      ...underlyingPricesUSD,
      [priceInfo.ref]: decimate(
        priceInfo.values[0].hex,
        36 - market.underlyingDecimals,
      ).toString(),
    }
    marketToUnderlying = {
      ...marketToUnderlying,
      [market.id]: market.underlyingAddress,
    }
  })

  const accountsLiquidityQueryMC = Multicall.createCallContext([
    {
      ref: 'Comptroller',
      contract: comptroller,
      calls: data.accounts.map((account) => ({
        ref: account.id,
        method: 'getAccountLiquidity',
        params: [account.id],
      })),
    },
  ])
  logger.info(
    `Querying comptroller for ${chalk.greenBright(
      data.accounts.length,
    )} accounts...`,
  )
  const { Comptroller: accountsLiquidity } = Multicall.parseCallResults(
    await multicall.call(accountsLiquidityQueryMC),
  )
  logger.success('Gathered accounts liquidity from comptroller.')

  const liquidatableAccounts = accountsLiquidity
    .map((account) => ({
      id: account.ref,
      liquidatableAmount: new BigNumber(account.values[2].hex),
      accountMarkets: data.accounts.find(
        (_account) => _account.id === account.ref,
      ).tokens,
    }))
    .filter((isLiquidatable) => isLiquidatable.liquidatableAmount.gt(0))

  logger.info(
    `💸 Found ${chalk.greenBright(
      liquidatableAccounts.length,
    )} account(s) flagged for liquidation 💸`,
  )

  // Loop through accounts with a > zero shortfall value
  for (const accountInfo of liquidatableAccounts) {
    const { id: account, liquidatableAmount, accountMarkets } = accountInfo

    // Keep track of largest borrow position & largest collateral position
    let largestBorrowPosition
    let largestCollateralPosition
    for (const market of accountMarkets) {
      if (market.enteredMarket) {
        const bdTokenAddress = market.id.split('-')[0]
        const bdToken = new web3.eth.Contract(
          cTokenAbi as AbiItem[],
          bdTokenAddress,
        )

        const balancesQueryMC = Multicall.createCallContext([
          {
            ref: 'BDToken',
            contract: bdToken,
            calls: [
              { method: 'borrowBalanceCurrent', params: [account] },
              { method: 'balanceOfUnderlying', params: [account] },
              { method: 'symbol' },
            ],
          },
        ])
        const { BDToken: bdBalanceRes } = Multicall.parseCallResults(
          await multicall.call(balancesQueryMC),
        )

        const borrowBalance = new BigNumber(bdBalanceRes[0].values[0].hex)
        const underlyingBalance = new BigNumber(bdBalanceRes[1].values[0].hex)

        const _market = data.markets.find(
          (market) => market.id === bdTokenAddress,
        )
        const borrowValue = decimate(
          borrowBalance,
          _market.underlyingDecimals,
        ).times(underlyingPricesUSD[bdTokenAddress])
        const collateralValue = decimate(
          underlyingBalance,
          _market.underlyingDecimals,
        ).times(underlyingPricesUSD[bdTokenAddress])

        if (
          !largestBorrowPosition ||
          largestBorrowPosition.borrowValue.lt(borrowValue)
        )
          largestBorrowPosition = {
            bdToken,
            bdTokenAddress,
            bdTokenSymbol: bdBalanceRes[2].values[0],
            borrowBalance,
            borrowValue,
            market: _market,
          }
        if (
          !largestCollateralPosition ||
          largestCollateralPosition.collateralValue.lt(collateralValue)
        )
          largestCollateralPosition = {
            bdTokenAddress: bdTokenAddress,
            bdTokenSymbol: bdBalanceRes[2].values[0],
            collateralValue,
          }
      }
    }

    const liquidationAmount = largestBorrowPosition.borrowBalance
      .times(0.5)
      .minus(1)
      .decimalPlaces(0)
    console.log('---------------------------------------------------------')
    logger.info(`Liquidating account ${chalk.yellow(account)}...`)
    logger.info(
      `Account debt: ${chalk.redBright(liquidatableAmount.toNumber())}`,
    )
    logger.info(
      `Liquidating borrow from ${chalk.magenta(
        largestBorrowPosition.bdTokenSymbol,
      )} (${chalk.yellow(
        largestBorrowPosition.bdTokenAddress,
      )}) - Borrow value: $${chalk.greenBright(
        largestBorrowPosition.borrowValue.toFixed(2),
      )}`,
    )
    logger.info(
      `Seizing collateral from ${chalk.magenta(
        largestCollateralPosition.bdTokenSymbol,
      )} (${chalk.yellow(
        largestCollateralPosition.bdTokenAddress,
      )}) - Collateral value: $${chalk.greenBright(
        largestCollateralPosition.collateralValue.toFixed(2),
      )}`,
    )
    logger.info(
      `Liquidation size: ${chalk.greenBright(
        decimate(
          liquidationAmount,
          largestBorrowPosition.market.underlyingDecimals,
        ).toFixed(4),
      )} ${chalk.magenta(
        largestBorrowPosition.bdTokenSymbol,
      )} - $${chalk.greenBright(
        largestBorrowPosition.borrowValue.times(0.5).toFixed(2),
      )}`,
    )

    await new Promise(async (resolve) => {
      largestBorrowPosition.bdToken.methods
        .liquidateBorrow(
          account,
          liquidationAmount,
          largestCollateralPosition.bdTokenAddress,
        )
        .send({
          from: Constants.liquidatorWallet,
          gas: 1000000,
          gasPrice: await web3.eth.getGasPrice(),
        })
        .on('transactionHash', (txHash) =>
          console.log(chalk.yellowBright(txHash)),
        )
        .on('receipt', () => {
          logger.success(`Liquidated ${chalk.yellow(account)} successfully.`)
          setTimeout(resolve, 2500) // Wait 2500ms (2.5s) before next loop
        })
        .on('error', (error) => {
          console.log(error)
          process.exit(1) // exit, for now
          resolve(error)
        })
    })
  }
  setTimeout(runLiquidator, 60000)
}

const performApprovals = async () => {
  logger.info('Fetching markets...')
  const { markets }: any = await GraphUtil.getUsersAndMarkets()
  logger.success('Fetched markets from subgraph.')

  const underlyingContracts = markets.reduce(
    (prev, market) => ({
      ...prev,
      [market.id]: new web3.eth.Contract(
        erc20Abi as AbiItem[],
        market.underlyingAddress,
      ),
    }),
    {},
  )

  logger.info(
    `Fetching token approvals for ${chalk.greenBright(
      markets.length,
    )} markets...`,
  )
  const approvalQueryMC = Multicall.createCallContext(
    markets.map(
      (market) =>
        market.underlyingAddress !== Constants.genesisAddress && {
          ref: market.id,
          contract: underlyingContracts[market.id],
          calls: [
            {
              method: 'allowance',
              params: [Constants.liquidatorWallet, market.id],
            },
          ],
        },
    ),
  )
  const approvals = Multicall.parseCallResults(
    await multicall.call(approvalQueryMC),
  )

  const notApproved = Object.keys(approvals)
    .map(
      (tokenAddress) =>
        !new BigNumber(approvals[tokenAddress][0].values[0].hex).gt(0) &&
        tokenAddress,
    )
    .filter((tokenAddress) => tokenAddress)
  logger.success(
    `Your liquidator wallet has approved ${chalk.greenBright(
      Object.keys(approvals).length - notApproved.length,
    )}/${chalk.greenBright(
      Object.keys(approvals).length,
    )} tokens for spending.`,
  )

  // Do not prompt if all bdTokens have been approved for spending
  if (notApproved.length === 0) return mainMenu()

  inquirer
    .prompt([
      {
        type: 'list',
        name: 'direction',
        message: 'Would you like to send approval transactions?',
        choices: ['Yes', 'No'],
      },
    ])
    .then(async ({ direction }) => {
      if (direction === 'Yes') {
        for (const tokenAddress of notApproved) {
          logger.info(
            `Approving ${underlyingContracts[tokenAddress].options.address} for spending...`,
          )
          await new Promise(async (resolve) => {
            const tokenContract = underlyingContracts[tokenAddress]
            tokenContract.methods
              .approve(
                tokenAddress,
                new BigNumber(0x1fffffffffffff).times(1e18), // MAX SAFE INT
              )
              .send({
                from: Constants.liquidatorWallet,
                gas: 1000000,
                gasPrice: await web3.eth.getGasPrice(),
              })
              .on('transactionHash', (txHash) =>
                logger.info(`Tx Hash: ${txHash}`),
              )
              .on('receipt', (receipt) => {
                logger.success(
                  `Approved ${tokenContract.options.address} for spending.`,
                )
                setTimeout(() => resolve(receipt), 2500)
              })
              .on('error', (error) => {
                console.log(error)
                process.exit(1) // exit on error, for now
              })
          })
        }
      }
      mainMenu()
    })
}

// Init
const mainMenu = () => {
  console.log(chalk.greenBright('🤖 Liquidation Bot Control Panel'))
  inquirer
    .prompt([
      {
        type: 'list',
        name: 'direction',
        message: 'What would you like to do?',
        choices: [
          'Start Bot',
          'Check & Perform Approvals',
          'Get Close Factor & Incentive Mantissa',
          'Exit',
        ],
      },
    ])
    .then(({ direction }) => {
      switch (direction) {
        case 'Start Bot':
          runLiquidator()
          break
        case 'Check & Perform Approvals':
          performApprovals()
          break
        case 'Get Close Factor & Incentive Mantissa':
          contracts.comptroller.methods
            .closeFactorMantissa()
            .call()
            .then((closeFactor) => {
              logger.info(`Close Factor: ${decimate(closeFactor)}%`)
              contracts.comptroller.methods
                .liquidationIncentiveMantissa()
                .call()
                .then((liqIncentive) => {
                  logger.info(
                    `Liquidation Incentive: ${decimate(liqIncentive)}`,
                  )
                  mainMenu()
                })
            })
          break
        case 'Exit':
          process.exit(0)
          break
      }
    })
    .catch((error) => {
      if (error.isTtyError) {
        // Prompt couldn't be rendered in the current environment
      } else {
        // Something else went wrong
      }
    })
}

mainMenu()
