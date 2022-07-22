import "forge-std/Test.sol";
import "solmate/tokens/ERC20.sol";
import "../src/LiquidationController.sol";
import {Constants} from "./Constants.sol";
import {ICToken} from "../src/interfaces/ICToken.sol";
import {IComptroller} from "../src/interfaces/IComptroller.sol";
import {IRecipe} from "../src/interfaces/IRecipe.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

interface Cheats {
    function deal(address who, uint256 amount) external;
    function startPrank(address sender) external;
    function stopPrank() external;
}

contract LiquidationControllerTest is DSTest {
    LiquidationController controller;
    ICToken public bdSTBL;
    ICToken public bSTBL;
    IComptroller public unitroller;
    Constants public const;
    Cheats public cheats;

    function setUp() public {
        controller = new LiquidationController(0x24a42fD28C976A61Df5D00D0599C34c4f90748c8);
        const = new Constants();
        cheats = Cheats(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
        cheats.deal(address(this), 1000 ether);	
    }

    // Check if owner was set properly
    function testOwnerAddress() public {
        assertEq(controller.owner(), address(this));
    }

    // Pinned block number where this liquidation is available: 14225453
    function testLiquidation() public {

        //////////////////////////////
        //Create underwater position//
        //////////////////////////////

        //Allow for bSTBL Minting
        cheats.startPrank(unitroller.admin());
        cheats.deal(unitroller.admin(), 1000 ether);
        unitroller._setMintPaused(address(bdSTBL), false);
        cheats.stopPrank();

        //Mint bSTBL
        mintBasket(address(bSTBL),10 ether);

        //Deposit bSTBL
        IERC20()
        depositCollateral(bSTBL,,true);

        //Borrow bUSD

        //Remove assets from bSTBL to create shortfall

        //Perform Liquidation
        address borrower = 0xFC69e0a5823E2AfCBEb8a35d33588360F1496a00;
        uint256 repayAmount = 1000 * 1 ether;
        address collateral = 0xF635fdF9B36b557bD281aa02fdfaeBEc04CD084A; // bdETH

        controller.executeLiquidations(
            borrower,
            repayAmount,
            collateral,
            1010 * 1 ether, // 1000 *= 1.01
            address(this)
        );

        emit log("Profit:");
        emit log_named_uint("DAI", ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F).balanceOf(address(this)));
        emit log_named_uint("baoUSD", ERC20(0x7945b0A6674b175695e5d1D08aE1e6F13744Abb0).balanceOf(address(this)));
    }

    function mintBasket(address _basket, uint _mintAmount) public {
	    IRecipe recipe = IRecipe(const.recipe());
        uint256 mintPrice = recipe.getPriceEth(_basket, _mintAmount);
        cheats.deal(address(this),mintPrice); 
        //Mint Basket tokens
	    recipe.toBasket{value: mintPrice}(_basket, _mintAmount);    
    }

    function depositCollateral(ICToken _dbToken, uint _collateralAmount, bool _joinMarket) public {
    	cheats.startPrank(msg.sender);
        IERC20 underlyingToken = IERC20(_dbToken.underlying());
        underlyingToken.approve(address(_dbToken),_collateralAmount);
        _dbToken.mint(_collateralAmount, _joinMarket);
        cheats.stopPrank(); 
   }

}