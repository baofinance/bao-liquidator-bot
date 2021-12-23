import BigNumber from 'bignumber.js';

export default {
  comptrollerAddress: '0x8B932257a6b5D20EaD78FB4d5Fd00a19daF937b3',
  oracleAddress: '0xf9941b9E8D010d961f7d3D6Aea57a108Bcfe1026',
  liquidatorWallet: '<wallet-address>',
  liquidatorContract: '<liquidator-contract>',
  genesisAddress: '0x0000000000000000000000000000000000000000',
  //Min gas cost of liquidating an account (in wei)
  liquidationGasCost: new BigNumber(849438770000000),
  // Infura URI
  infuraURI: '<infura-uri>',

  // Subgraphs
  SUBGRAPH_URLS: {
    ropsten:
      'https://api.thegraph.com/subgraphs/name/totalpizza/dev-hard-synths',
    mainnet: '-',
  },
}
