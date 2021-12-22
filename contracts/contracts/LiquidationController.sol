// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { FlashLoanReceiverBase, ILendingPoolAddressesProvider } from "./AaveInterfaces.sol";
import { bdToken, Stabilizer } from "./BaoInterfaces.sol";
import { IUniswapV2Router02 } from "./UniswapInterfaces.sol";

contract LiquidationController is
Ownable,
FlashLoanReceiverBase(ILendingPoolAddressesProvider(0x506B0B2CF20FAA8f38a4E2B524EE43e1f4458Cc5))
{
    bdToken immutable bdUSD;
    IERC20 immutable DAI;
    IERC20 immutable bUSD;
    Stabilizer immutable stabilizer;
    IUniswapV2Router02 immutable swapRouter;

    bdToken[] public collateral;

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    constructor() {
        bdUSD = bdToken(0x8584B05012749bdd32E41f8c7eB973D2283d1e56);
        DAI = IERC20(0xf80A32A835F79D7787E8a8ee5721D0fEaFd78108);
        bUSD = IERC20(0xDF559301C178221E8D76E4A91126C504Dfe5947a);
        stabilizer = Stabilizer(0xD15C57FE113C6276FAD2F82658BB420351147f5E);
        swapRouter = IUniswapV2Router02(0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506); // SUSHI Router on Ropsten
    }

    // This function is called after the contract has received the flash loaned amount
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Liquidation logic, contract has funds

        // Approve tokens to be taken back by the lending pool
        for (uint i = 0; i < assets.length; i++) {
            uint amountOwed = amounts[i].add(premiums[i]);
            IERC20(assets[i]).approve(address(LENDING_POOL), amountOwed);
        }

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
        // Get a flash loan for DAI
        address[] memory assets = new address[](1);
        assets[0] = address(DAI);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _totalRepayAmount;
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;
        LENDING_POOL.flashLoan(address(this), assets, amounts, modes, address(this), "", 0);

        // TODO- Move logic - https://docs.aave.com/developers/guides/flash-loans#2.-calling-flashloan

        // Approve transfer of DAI to stabilizer
        DAI.approve(address(stabilizer), _totalRepayAmount);

        // Exchange for bUSD on Stabilizer
        stabilizer.buy(_totalRepayAmount);

        // Approve bUSD transfers for liquidations
        bUSD.approve(address(bdUSD), _totalRepayAmount);

        // Liquidate the different users
        for (uint i = 0; i < _borrowers.length; i++) {
            bdUSD.liquidateBorrow(_borrowers[i], _repayAmounts[i], _bdCollaterals[i]);
        }

        // Redeem all seized Collateral
        for (uint j = 0; j < _bdCollaterals.length; j++) {
            // ToDo: use balanceOfUnderlying by calculating with exchange rate so that we don't have to read balanceOf() again later
            bdToken bdCollateral = bdToken(_bdCollaterals[j]);
            bdCollateral.redeem(bdCollateral.balanceOf(address(this)));

            address underlyingCollateral = bdCollateral.underlying();
            uint collateralAmount = IERC20(underlyingCollateral).balanceOf(address(this));

            // Exchange Collateral for DAI
            IERC20(underlyingCollateral).approve(address(swapRouter), collateralAmount);
            address[] memory route = new address[](2);
            route[0] = address(underlyingCollateral);
            route[1] = address(DAI);
            swapRouter.swapExactTokensForTokens(collateralAmount, 0, route, address(this), block.timestamp);
        }

        // Sell remaining bUSD
        stabilizer.sell(bUSD.balanceOf(address(this)));
    }

    function addCollateralOption(address _newCollateral) external onlyOwner {
        require(_newCollateral != address(0));
        collateral.push(bdToken(_newCollateral));
    }

    function removeCollateralOption(uint index) external onlyOwner {
        require(index < collateral.length);
        require(address(collateral[index]) != address(0));
        collateral[index] = collateral[collateral.length - 1];
        collateral.pop();
    }

    function retrieve(address token, uint256 amount) external onlyOwner {
        IERC20 tokenContract = IERC20(token);
        tokenContract.safeTransfer(msg.sender, amount);
    }

    // ToDo: Function to remove any assets that might remain from liquidations
}
