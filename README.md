# Liquidator Bot

[![License: WTFPL](http://www.wtfpl.net/wp-content/uploads/2012/12/wtfpl-badge-3.png)](http://www.wtfpl.net/)

A simple liquidator bot written in JS for BAO Finance's synthetics protocol.

This bot is by no means top-of-the-line and is meant to be used as a reference / starting point for people attempting to create more robust liquidation bots for the protocol. JavaScript is no bueno for MEV searching. Feel free to run it as-is, however, here's your competition:
![This is your competition](https://i.imgur.com/fiuiztF.png)

## To Do
* Create proxy contract to batch liquidation operations into one transaction
    * Submit transactions in flashbots bundles / to the flashbots RPC
* Consider profit/loss when executing liquidations
    * Include gas expenditures & liquidation profit in consideration
* Use subgraph more to speed things up, no need to query contracts in several instances
* Auto-withdraw from bdTokens to receive underlying liquidity after successful liquidations.

## Instructions
1) Copy `src/constants.default.ts` to `src/constants.ts` and fill in blank values.
2) Create a file in the project root called `.secret` and include your liquidator wallet's private key
3) Run `yarn`
4) Patch `@apollo` dependency for CLI usage: `(cd node_modules/@apollo && yarn add react)`
5) Run `yarn start`

## References
* [BAO HardSynth Contracts](https://github.com/baofinance/HardSynths)
* [Compound Docs](https://compound.finance/docs)

# License
Released under the WTFPL License. Have at it.
