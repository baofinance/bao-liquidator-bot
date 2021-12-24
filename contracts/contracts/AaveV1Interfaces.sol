// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ILendingPool {
    function flashLoan(
        address _receiver,
        address _reserve, 
        uint256 _amount, 
        bytes memory _params
        ) external ;
}

interface ILendingPoolAddressesProvider {
    function getLendingPool() external view returns (address);
    function getLendingPoolCore() external view returns (address);
}

interface IFlashLoanReceiver {
    function executeOperation(address _reserve, uint256 _amount, uint256 _fee, bytes calldata _params) external;
}

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver{

    using SafeERC20 for IERC20;
    
    ILendingPoolAddressesProvider public addressesProvider;
    ILendingPool public immutable LENDING_POOL;

    constructor(address _addressProvider) {
        addressesProvider = ILendingPoolAddressesProvider(_addressProvider);
        LENDING_POOL = ILendingPool(0x9E5C7835E4b13368fd628196C4f1c6cEc89673Fa);
    }

    receive() payable external {}

    function transferFundsBackToPoolInternal(address payable _reserve, uint256 _amount) internal {
        IERC20(_reserve).safeTransfer(0x4295Ee704716950A4dE7438086d6f0FBC0BA9472, _amount);
    }
}