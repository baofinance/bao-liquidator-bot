// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { FlashLoanReceiverBase, ILendingPoolAddressesProvider } from "./AaveV2Interfaces.sol";
import { bdToken, Stabilizer } from "./BaoInterfaces.sol";
import { ISwapRouter } from "./UniswapInterfaces.sol";
import { IWETH9 } from "./WethInterface.sol";
import { ICurve } from "./CurveInterfaces.sol";

contract LiquidationController is
Ownable,
FlashLoanReceiverBase(ILendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5))
{
    bdToken immutable bdUSD;
    bdToken public bdETH;
    IWETH9 constant WETH = IWETH9(payable(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2));
    IERC20 constant DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 immutable bUSD;
    ISwapRouter immutable swapRouter; // UniV3 Router
    ICurve immutable curvePool; //bUSD-3Pool

    address constant public Treasury = 0xC189Ca9C9168004B3c0eED5409c15A88B87a0702;

    mapping(address => uint24) poolFee;

    using SafeERC20 for IERC20;

    constructor(address _curvePool, address _bdUSD, address _bdETH, address _bUSD, address _bdUSDC, address _swapRouter){
        curvePool = ICurve(_curvePool);
        bdUSD = bdToken(_bdUSD);
        bdETH = bdToken(_bdETH);
        bUSD = IERC20(_bUSD);
        swapRouter = ISwapRouter(_swapRouter);

        poolFee[_bdUSDC] = 500; //USDC-DAI
        poolFee[_bdETH] = 3000; //ETH-DAI
    }

    // This function is called after the contract has received the flash loaned amount
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata _params
    ) external override returns(bool){
        (address[] memory _borrowers, uint256[] memory _repayAmounts, address[] memory _bdCollaterals) = abi.decode(_params, (address[], uint256[], address[]));

        // Approve transfer of DAI to stabilizer
        DAI.approve(address(curvePool), amounts[0]);

        // Exchange DAI for bUSD on Curve
        curvePool.exchange_underlying(1,0,amounts[0],0);

        // Approve bUSD transfers for liquidations
        bUSD.approve(address(bdUSD), amounts[0]);

        // Liquidate the different users
        for (uint i = 0; i < _borrowers.length; i++) {
            (uint result) = bdUSD.liquidateBorrow(_borrowers[i], _repayAmounts[i], _bdCollaterals[i]);

            // If liquidation didn't succeed we need to sell the bUSD again.
            // If the incurred fees are too high we won't be able to repay the Flashloan fee and the transaction will revert
            if (result != 0) {
                bUSD.approve(address(curvePool), _repayAmounts[i]);
                curvePool.exchange_underlying(0, 1, _repayAmounts[i], 0);
            }
        }

        // Redeem and sell all seized Collateral
        for (uint j = 0; j < _bdCollaterals.length; j++) {
            bdToken bdCollateral = bdToken(_bdCollaterals[j]);
            uint collateralBalance = bdCollateral.balanceOf(address(this));

            // If liquidation failed we might not have any collateral to redeem
            if (collateralBalance == 0 && address(this).balance == 0) {
                continue;
            }

            bdCollateral.redeem(collateralBalance);
            ISwapRouter.ExactInputSingleParams memory params;

            // If we are handling eth -> transform to weth before selling
            if (0 < address(this).balance) {
                uint collateralAmount = address(this).balance;

                // ETH to WETH
                WETH.deposit{value: collateralAmount}();

                WETH.approve(address(swapRouter), collateralAmount);

                // Define Swap Params
                params = ISwapRouter.ExactInputSingleParams({
                    tokenIn: address(WETH),
                    tokenOut: address(DAI),
                    fee: poolFee[_bdCollaterals[j]],
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: collateralAmount,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                });
            }
            // Swapping any other ERC20 type for DAI
            else {
                // Get amount of seized assets
                address underlyingCollateral = bdCollateral.underlying();
                uint collateralAmount = IERC20(underlyingCollateral).balanceOf(address(this));

                IERC20(underlyingCollateral).approve(address(swapRouter), collateralAmount);

                // Define Swap Params
                params = ISwapRouter.ExactInputSingleParams({
                    tokenIn: underlyingCollateral,
                    tokenOut: address(DAI),
                    fee: poolFee[_bdCollaterals[j]],
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: collateralAmount,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                });
            }
            // Execute Swap
            swapRouter.exactInputSingle(params);
        }

        // Repay Loan
        uint totalDebt = amounts[0] + premiums[0];
        DAI.approve(address(LENDING_POOL), totalDebt);

        return true;
    }

    /**
      * @notice Method to liquidate users given an address, amount and asset.
      * @param _borrowers The addresses whose borrow we are going to repay (liquidations)
      * @param _repayAmounts The number of borrowed assets we want to repay
      * @param _bdCollaterals The bdToken address of the collateral we want to claim
      * @param _totalRepayAmount The total amount of the synth assets that we plan to repay the user debts with
      */
    function executeLiquidations(
        address[] memory _borrowers,
        uint256[] memory _repayAmounts,
        address[] memory _bdCollaterals,
        uint256 _totalRepayAmount
    ) external {

        bytes memory params = abi.encode(_borrowers,_repayAmounts,_bdCollaterals);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _totalRepayAmount;

        address[] memory assets = new address[](1);
        assets[0] = address(DAI);

        // 0 = no debt, 1 = stable, 2 = variable
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;
        LENDING_POOL.flashLoan(address(this), assets, amounts, modes, address(this), params, 0);

        // Transfer funds to treasury (to avoid griefing attack)
        DAI.safeTransfer(Treasury, DAI.balanceOf(address(this)));
        bUSD.safeTransfer(Treasury, bUSD.balanceOf(address(this)));
    }

    function retrieve(address token, uint256 amount) external onlyOwner {
        IERC20 tokenContract = IERC20(token);
        tokenContract.safeTransfer(msg.sender, amount);
    }

    // Needed for bdETH redeem
    receive() external payable {}
}