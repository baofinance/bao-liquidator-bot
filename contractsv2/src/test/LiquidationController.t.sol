import "ds-test/test.sol";
import "solmate/tokens/ERC20.sol";
import "../LiquidationController.sol";
/* import "solmate/tokens/WETH.sol";
import "../interfaces/UniswapInterfaces.sol";
import "../interfaces/BaoInterfaces.sol";

interface Comptroller {
    function getAccountLiquidity(address account) external view returns (uint, uint, uint);
} */

contract LiquidationControllerTest is DSTest {
    LiquidationController controller;

    function setUp() public {
        controller = new LiquidationController(
            0x0FaFaFD3C393ead5F5129cFC7e0E12367088c473, // BaoUSD 3Pool
            0xc0601094C0C88264Ba285fEf0a1b00eF13e79347, // bdUSD
            0x7945b0A6674b175695e5d1D08aE1e6F13744Abb0, // BaoUSD
            0xF635fdF9B36b557bD281aa02fdfaeBEc04CD084A, // bdETH
            0x7749f9f3206A49d4c47b60db05716409dC3A4149, // bdUSDC
            0xE592427A0AEce92De3Edee1F18E0157C05861564, // UniV3 swap router
            0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5, // Lending Pool Address Provider
            address(this)
        );
    }

    // Check if owner was set properly
    function testOwnerAddress() public {
        assertEq(controller.owner(), address(this));
    }

    // Pinned block number where this liquidation is available: 14225453
    function testLiquidation() public {
        address[] memory borrowers = new address[](1);
        borrowers[0] = 0xFC69e0a5823E2AfCBEb8a35d33588360F1496a00;

        uint256[] memory repayAmounts = new uint256[](1);
        repayAmounts[0] = 1000 * 1 ether;

        address[] memory collaterals = new address[](1);
        collaterals[0] = 0xF635fdF9B36b557bD281aa02fdfaeBEc04CD084A; // bdETH

        controller.executeLiquidations(
            borrowers,
            repayAmounts,
            collaterals,
            1010 * 1 ether // 1000 *= 1.01
        );

        emit log("Profit:");
        emit log_named_uint("DAI", ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F).balanceOf(address(this)));
        emit log_named_uint("baoUSD", ERC20(0x7945b0A6674b175695e5d1D08aE1e6F13744Abb0).balanceOf(address(this)));
    }

    // Doesn't work- USDC/baoUSD are usually on a 1:1 peg, so shortfall isn't generated even at max borrow
    /* function testLiquidationUSDC() public {
        WETH wrappedETH = WETH(payable(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2));
        ERC20 usdc = ERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        ISwapRouter router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

        wrappedETH.deposit{value: 10 ether}();
        emit log_named_uint("weth balance", wrappedETH.balanceOf(address(this)));
        wrappedETH.approve(address(router), 10 ether);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(wrappedETH),
            tokenOut: address(usdc), // USDC
            fee: 500,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: wrappedETH.balanceOf(address(this)),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        router.exactInputSingle(params);
        emit log_named_uint("usdc balance", usdc.balanceOf(address(this)));

        bdToken bdUSDC = bdToken(0x7749f9f3206A49d4c47b60db05716409dC3A4149);
        bdToken bdUSD = bdToken(0xc0601094C0C88264Ba285fEf0a1b00eF13e79347);
        ERC20 baoUSD = ERC20(0x7945b0A6674b175695e5d1D08aE1e6F13744Abb0);

        uint usdcBalance = usdc.balanceOf(address(this));
        usdc.approve(address(bdUSDC), usdcBalance);
        bdUSDC.mint(usdcBalance, true);
        emit log_named_uint("bdUSDC balance", bdUSDC.balanceOf(address(this)));

        bdUSD.borrow(usdcBalance * 1e12 * 70 / 100);
        emit log_named_uint("bao usd balance", baoUSD.balanceOf(address(this)));

        Comptroller comptroller = Comptroller(0x0Be1fdC1E87127c4fe7C05bAE6437e3cf90Bf8d8);
        (uint error,uint liq,uint shortfall) = comptroller.getAccountLiquidity(address(this));
        emit log_named_uint("error", error);
        emit log_named_uint("liq", liq);
        emit log_named_uint("shortfall", shortfall);

        address[] memory borrowers = new address[](1);
        borrowers[0] = address(this);

        uint256[] memory repayAmounts = new uint256[](1);
        repayAmounts[0] = 1000 * 1 ether;

        address[] memory collaterals = new address[](1);
        collaterals[0] = address(bdUSDC);

        controller.executeLiquidations(
            borrowers,
            repayAmounts,
            collaterals,
            1010 * 1 ether // 1000 *= 1.01
        );

        emit log("Profit:");
        emit log_named_uint("DAI", ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F).balanceOf(address(this)));
        emit log_named_uint("baoUSD", ERC20(0x7945b0A6674b175695e5d1D08aE1e6F13744Abb0).balanceOf(address(this)));
    } */
}