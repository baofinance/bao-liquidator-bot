pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract bdToken is IERC20 {
    address public underlying;

    function redeem(uint redeemTokens) virtual external returns (uint);
    function liquidateBorrow(address borrower, uint repayAmount, address cTokenCollateral) virtual external returns (uint);
}

// Probably want to exchange this for 1inch or similar
interface Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

interface AaveLendingPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external;
}

interface Stabilizer {
    function buy(uint amount) external;
}

contract LiquidationController is Ownable {
    bdToken immutable bdUSD;
    AaveLendingPool immutable aaveLending;
    IERC20 immutable DAI;
    IERC20 immutable bUSD;
    Stabilizer immutable stabilizer;
    Router immutable swapRouter;

    bdToken[] public collateral;

    using SafeERC20 for IERC20;

    constructor() {
        bdUSD = bdToken(0x8584B05012749bdd32E41f8c7eB973D2283d1e56);
        aaveLending = AaveLendingPool(0x9E5C7835E4b13368fd628196C4f1c6cEc89673Fa);
        DAI = IERC20(0xf80A32A835F79D7787E8a8ee5721D0fEaFd78108);
        bUSD = IERC20(0xDF559301C178221E8D76E4A91126C504Dfe5947a);
        stabilizer = Stabilizer(0xD15C57FE113C6276FAD2F82658BB420351147f5E);
        swapRouter = Router(0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506); // SUSHI Router on Ropsten
    }

    /**
      * @notice Method to liquidate users given an address, amount and asset.
      * @param _borrowers The addresses whose borrow we are going to repay (liquidations)
      * @param _repayAmounts The number of borrowed assets we want to repay
      * @param _bdCollaterals The bdToken address of the collateral we want to claim
      * @param _totalRepayAmount The total amount of the synth assets that we plan to repay the user debts with
      */
    function executeLiquidations(address[] memory _borrowers, uint256[] memory _repayAmounts, address[] memory _bdCollaterals, uint256 _totalRepayAmount) external {
        // Get a flash loan for DAI
        address[] memory assets = new address[](1);
        assets[0] = address(DAI);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _totalRepayAmount;
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;
        aaveLending.flashLoan(address(this), assets, amounts, modes, address(0), "", 0);

        // Approve transfer of DAI to stabilizer
        DAI.approve(address(stabilizer), _totalRepayAmount);

        // Exchange for bUSD on Stabilzer
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

        // Repay loan
        DAI.approve(address(aaveLending), type(uint256).max);
        aaveLending.repay(address(DAI), type(uint256).max, 0, address(this)); // Don't think we should be using type(uint256).max here for the amount
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
        require(tokenContract.balanceOf(address(this)) >= amount, "Token balance insufficient");
        tokenContract.safeTransfer(msg.sender, amount);
    }

    // ToDo: Function to remove any assets that might remain from liquidations
}
