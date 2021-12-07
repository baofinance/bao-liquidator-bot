import BigNumber from 'bignumber.js'

const decimate = (n: any, decimals = 18): BigNumber =>
  new BigNumber(n).div(10 ** decimals)

const exponentiate = (n: any, decimals = 18): BigNumber =>
  new BigNumber(n).times(10 ** decimals)

export { decimate, exponentiate }
