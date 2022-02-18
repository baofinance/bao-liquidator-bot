// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import "solmate/tokens/ERC20.sol";
import "solmate/tokens/WETH.sol";
import { FlashLoanReceiverBase, ILendingPoolAddressesProvider } from "./interfaces/AaveV2Interfaces.sol";
import { bdToken, Stabilizer } from "./interfaces/BaoInterfaces.sol";
import { ISwapRouter } from "./interfaces/UniswapInterfaces.sol";
import { ICurve } from "./interfaces/CurveInterfaces.sol";

contract LiquidationController is FlashLoanReceiverBase {
    bdToken immutable bdUSD;
    WETH constant wrappedETH = WETH(payable(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2));
    ERC20 constant DAI = ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    ERC20 immutable bUSD;
    ISwapRouter immutable swapRouter; // UniV3 Router
    ICurve immutable curvePool; // bUSD-3Pool

    address immutable public owner; // Only used for the retrieve function, no need to use OZ's Ownable or Solmate's Auth
    address immutable public treasury;

    mapping(address => uint24) poolFee;

    constructor(
        address _curvePool,
        address _bdUSD,
        address _bUSD,
        address _bdETH,
        address _bdUSDC,
        address _swapRouter,
        address _lpap,
        address _treasury
    ) FlashLoanReceiverBase(ILendingPoolAddressesProvider(_lpap)) {
        owner = msg.sender;
        treasury = _treasury;

        curvePool = ICurve(_curvePool);
        bdUSD = bdToken(_bdUSD);
        bUSD = ERC20(_bUSD);
        swapRouter = ISwapRouter(_swapRouter);

        poolFee[_bdUSDC] = 500; // USDC-DAI
        // poolFee[_bdETH] = 3000; // ETH-DAI

        // Approve tokens on contract creation to save gas during liquidations
        DAI.approve(address(curvePool), type(uint256).max);
        DAI.approve(address(LENDING_POOL), type(uint256).max);
        bUSD.approve(address(curvePool), type(uint256).max);
        bUSD.approve(address(bdUSD), type(uint256).max);
        wrappedETH.approve(address(swapRouter), type(uint256).max);
    }

    // This function is called after the contract has received the flash loan
    function executeOperation(
        address[] calldata,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address,
        bytes calldata _params
    ) external override returns(bool) {
        (address[] memory _borrowers, uint256[] memory _repayAmounts, address[] memory _bdCollaterals) = abi.decode(_params, (address[], uint256[], address[]));

        // Approve transfer of DAI to curve pool
        // DAI.approve(address(curvePool), amounts[0]);

        // Exchange DAI for bUSD on Curve
        curvePool.exchange_underlying(1, 0, amounts[0], 0);

        // Approve bUSD transfers for liquidations
        // bUSD.approve(address(bdUSD), amounts[0]);

        // Liquidate the different users
        for (uint i = 0; i < _borrowers.length; i++) {
            // If liquidation didn't succeed we need to sell the bUSD again.
            // If the incurred fees are too high we won't be able to repay the Flashloan fee and the transaction will revert
            if (bdUSD.liquidateBorrow(_borrowers[i], _repayAmounts[i], _bdCollaterals[i]) != 0) {
                // bUSD.approve(address(curvePool), _repayAmounts[i]);
                curvePool.exchange_underlying(0, 1, _repayAmounts[i], 0);
                continue;
            }

            bdToken bdCollateral = bdToken(_bdCollaterals[i]);

            bdCollateral.redeem(bdCollateral.balanceOf(address(this)));
            ISwapRouter.ExactInputSingleParams memory params;
            uint collateralAmount;

            // If we are handling eth -> transform to weth before selling
            if (address(this).balance > 0) {
                collateralAmount = address(this).balance;

                // ETH to WETH
                wrappedETH.deposit{value: collateralAmount}();

                // wrappedETH.approve(address(swapRouter), collateralAmount);

                // Define Swap Params
                params = ISwapRouter.ExactInputSingleParams({
                    tokenIn: address(wrappedETH),
                    tokenOut: address(DAI),
                    fee: 3000, // No need to reference poolFee[_bdCollaterals[i]], swap is always ETH->DAI and SLOADs are expensive (361 gas here)
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
                collateralAmount = ERC20(underlyingCollateral).balanceOf(address(this));

                ERC20(underlyingCollateral).approve(address(swapRouter), collateralAmount);

                // Define Swap Params
                params = ISwapRouter.ExactInputSingleParams({
                    tokenIn: underlyingCollateral,
                    tokenOut: address(DAI),
                    fee: poolFee[_bdCollaterals[i]],
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
        // DAI.approve(address(LENDING_POOL), totalDebt);

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
        DAI.transfer(treasury, DAI.balanceOf(address(this)));
        bUSD.transfer(treasury, bUSD.balanceOf(address(this)));
    }

    // In case any funds are sent to the contract, allow the owner to retrieve them
    function retrieve(address token, uint256 amount) external {
        require(owner == msg.sender, "Must be owner");

        ERC20 tokenContract = ERC20(token);
        tokenContract.transfer(msg.sender, amount);
    }

    // Needed for bdETH redeem
    receive() external payable {}
}