pragma solidity ^0.8.0;

import {ICToken} from "./ICToken.sol";

interface IComptroller{

    struct Market {
        bool isListed;

        uint collateralFactorMantissa;
		
	uint imfFactorMantissa;

        mapping(address => bool) accountMembership;

        bool isComped;
    }

    function liquidateCalculateSeizeTokens(address cTokenBorrowed, address cTokenCollateral, uint actualRepayAmount) external view returns (uint, uint);

    function liquidationIncentiveMantissa() external view returns(uint);

    function markets(address) external view returns(bool,uint,uint,bool);

    function _setMintPaused(address cToken, bool state) external returns (uint);

    function _setCollateralFactor(address cToken, uint newCollateralFactorMantissa) external returns (uint);

    function _setIMFFactor(ICToken cToken, uint newimfFactorMantissa) external returns (uint);

    function _supportMarket(ICToken cToken) external returns (uint);

    function admin() external view returns(address);

    function getAccountLiquidity(address account) external view returns (uint, uint, uint);
}
