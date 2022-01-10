// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { FlashLoanReceiverBase, ILendingPoolAddressesProvider } from "./AaveV1Interfaces.sol";
import { bdToken, Stabilizer } from "./BaoInterfaces.sol";
import { ISwapRouter } from "./UniswapInterfaces.sol";
import { IWETH9 } from "./WethInterface.sol";

contract LiquidationController is
Ownable,
FlashLoanReceiverBase(0x506B0B2CF20FAA8f38a4E2B524EE43e1f4458Cc5)
{
    bdToken constant bdUSD = bdToken(0x63793577FC659243Df8fF731089FBe60d2A36A0d);
    bdToken constant bdETH = bdToken(0x895952c8290bf311B4848dE954F1A747Bf97809f);
    IWETH9 constant WETH = IWETH9(payable(0xc778417E063141139Fce010982780140Aa0cD5Ab));
    IERC20 constant DAI = IERC20(0xf80A32A835F79D7787E8a8ee5721D0fEaFd78108);
    IERC20 constant bUSD = IERC20(0x0F051F3C818b495ef27AC46462188295F83469A5);
    Stabilizer constant stabilizer = Stabilizer(0x842Cc92850A7BFCC3e539797d109c13eD661037E);
    ISwapRouter constant swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564); // UniV3 Router
    address constant public Treasury = 0xC189Ca9C9168004B3c0eED5409c15A88B87a0702;

    mapping(address => uint24) poolFee;

    //ONLY FOR ROPSTEN TESTING
    uint public lastEthSale;

    using SafeERC20 for IERC20;

    constructor(){
        poolFee[0xfA3545f9Cca55088B30223bc86BE1AEe0F86eE62] = 500; //USDC-DAI
        poolFee[address(bdETH)] = 3000; //Eth-DAI
    }

    // This function is called after the contract has received the flash loaned amount
    function executeOperation(
        address _reserve,
        uint256 _amount, 
        uint256 _fee, 
        bytes calldata _params
    ) external override{

        (address[] memory _borrowers, uint256[] memory _repayAmounts, address[] memory _bdCollaterals) = abi.decode(_params, (address[], uint256[], address[]));

        // Approve transfer of DAI to stabilizer
        DAI.approve(address(stabilizer), _amount);

        // Exchange for bUSD on Stabilizer
        stabilizer.buy(_amount);

        // Approve bUSD transfers for liquidations
        bUSD.approve(address(bdUSD), _amount);

        //ONLY FOR ROPSTEN TESTING
        lastEthSale = 0;

        // Liquidate the different users
        for (uint i = 0; i < _borrowers.length; i++) {
            (uint result) = bdUSD.liquidateBorrow(_borrowers[i], _repayAmounts[i], _bdCollaterals[i]);
            //If liquidation didn't succeed we need to sell the bUSD again.
            //If the incurred fees are too high we won't be able to repay the Flashloan fee and the transaction will revert
            if(result!=0){
                bUSD.approve(address(stabilizer), _repayAmounts[i]);
                stabilizer.sell(_repayAmounts[i]);
            }
        }

        // Redeem and sell all seized Collateral
        for (uint j = 0; j < _bdCollaterals.length; j++) {
            bdToken bdCollateral = bdToken(_bdCollaterals[j]);
            uint collateralBalance = bdCollateral.balanceOf(address(this));
            
            //If liquidation failed we might not have any collateral to redeem 
            if(collateralBalance == 0 && address(this).balance == 0){
                continue;
            }

            bdCollateral.redeem(collateralBalance);

            ISwapRouter.ExactInputSingleParams memory params;

            //If we are handling eth -> transform to weth before selling
            if(0 < address(this).balance){

                uint collateralAmount = address(this).balance;

                //Only for Ropsten testing
                lastEthSale += collateralAmount;

                //ETH to WETH
                WETH.deposit{value: collateralAmount}();

                WETH.approve(address(swapRouter), collateralAmount);

                //Define Swap Params
                params =
                ISwapRouter.ExactInputSingleParams({
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
            //Swapping any other ERC20 type for DAI
            else{
                //Get amount of seized assets
                address underlyingCollateral = bdCollateral.underlying();
                uint collateralAmount = IERC20(underlyingCollateral).balanceOf(address(this));

                IERC20(underlyingCollateral).approve(address(swapRouter), collateralAmount);

                //Define Swap Params
                params =
                ISwapRouter.ExactInputSingleParams({
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

            //Execute Swap
            swapRouter.exactInputSingle(params);
        }

        uint currentDaiBalance = DAI.balanceOf(address(this));

        //Repay Loan
        uint totalDebt = _amount + _fee;
        transferFundsBackToPoolInternal(payable(address(DAI)), totalDebt);

        //Transfer funds to treasury (to avoid greefing attack)
        DAI.transfer(Treasury, DAI.balanceOf(address(this)));
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
                                                            //We need to lend more for the stabilizer fee
        LENDING_POOL.flashLoan(address(this), address(DAI), (_totalRepayAmount * 1e18 / 99e16), params);
    }

    function retrieve(address token, uint256 amount) external onlyOwner {
        IERC20 tokenContract = IERC20(token);
        tokenContract.safeTransfer(msg.sender, amount);
    }
}