//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IRecipe {

    function bake(
        address _basket,
        uint256 _maxInput,
        uint256 _mintAmount
    ) external returns (uint256 inputAmountUsed, uint256 outputAmount);

    function toBasket(
        address _basket,
        uint256 _mintAmount
    ) external payable returns (uint256 inputAmountUsed, uint256 outputAmount);

    function getPriceEth(address _basket, uint256 _amount) external returns (uint256 _price);

}
