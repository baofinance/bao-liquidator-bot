import { ApolloClient, gql, HttpLink, InMemoryCache } from '@apollo/client'
import { fetch } from 'cross-fetch'
import Constants from '../constants'

const getAccountsAndMarkets = async () => _querySubgraph(_userQuery())

const _getClient = (network = 'ropsten') =>
  new ApolloClient({
    uri: Constants.SUBGRAPH_URLS[network],
    link: new HttpLink({
      uri: Constants.SUBGRAPH_URLS[network],
      fetch,
    }),
    cache: new InMemoryCache(),
  })

const _querySubgraph = async (query: string, network?: string) => {
  return new Promise((resolve, reject) => {
    _getClient(network)
      .query({
        query: gql(query),
      })
      .then(({ data }) => resolve(data))
      .catch((err) => reject(err))
  })
}

const _userQuery = (): string =>
  `
  {
    accounts{
      id
      tokens{
        id
        enteredMarket
        cTokenBalance
        storedBorrowBalance
      }
    }
    markets{
      id
      underlyingAddress
      underlyingDecimals
    }
  } 
  `

export default {
  getUsersAndMarkets: getAccountsAndMarkets,
}
