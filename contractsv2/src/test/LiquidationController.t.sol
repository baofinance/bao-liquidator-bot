import "ds-test/test.sol";
import "solmate/tokens/ERC20.sol";
import "../LiquidationController.sol";

// TODO- Tests for liquidation controller
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
        collaterals[0] = 0xF635fdF9B36b557bD281aa02fdfaeBEc04CD084A;

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
}