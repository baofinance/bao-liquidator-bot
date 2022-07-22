// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICToken {
    function underlying() external returns (address);
    function _setReserveFactor(uint newReserveFactorMantissa) external returns (uint);
    function _setProtocolSeizeShare(uint newProtocolSeizeShareMantissa) external returns (uint);
    function mint(uint _mintAmount, bool enterMarket) external returns (uint256);
    function redeem(uint _redeemTokens) external returns (uint256);
    function redeemUnderlying(uint _redeemAmount) external returns (uint256);
    function borrowBalanceStored(address account) external view returns (uint);
    function borrow(uint borrowAmount) external returns (uint);
    function supplyRatePerBlock() external view returns (uint256);
    function repayBorrow(uint repayAmount) external returns (uint);
    function liquidateBorrow(address borrower, uint repayAmount, ICToken cTokenCollateral) external returns (uint);
    function exchangeRateCurrent() external returns (uint256);
    function exchangeRateStored() external view returns(uint256);
}