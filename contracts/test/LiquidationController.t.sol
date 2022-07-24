import "forge-std/Test.sol";
import "solmate/tokens/ERC20.sol";
import "../src/LiquidationController.sol";
import {Constants} from "./Constants.sol";
import {ICToken} from "../src/interfaces/ICToken.sol";
import {IComptroller} from "../src/interfaces/IComptroller.sol";
import {IRecipe} from "../src/interfaces/IRecipe.sol";
import {IERC20} from "openzeppelin/interfaces/IERC20.sol";

interface Cheats {
    function deal(address who, uint256 amount) external;
    function startPrank(address sender) external;
    function stopPrank() external;
}

contract LiquidationControllerTest is Test {
    LiquidationController controller;
    ICToken public bdSTBL;
    address public bSTBL;
    IComptroller public unitroller;
    Constants public const;
    Cheats public cheats;

    function setUp() public {
        controller = new LiquidationController(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
        const = new Constants();
        cheats = Cheats(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
        cheats.deal(address(this), 1000 ether);	
        unitroller = IComptroller(const.unitroller());
        bSTBL = const.bSTBL();
        bdSTBL = const.bdSTBL();
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
        mintBasket(bSTBL,100 ether);

        //Deposit bSTBL
        uint bSTBLBalance = IERC20(bSTBL).balanceOf(address(this));
        depositCollateral(bdSTBL,bSTBLBalance,true);

        //Borrow bUSD
        (,uint borrowingPowerBefore,) = IComptroller(const.unitroller()).getAccountLiquidity(address(this));
        borrowAssets(const.bdUSD(), borrowingPowerBefore);
	    (,uint borrowingPowerAfter,) = IComptroller(const.unitroller()).getAccountLiquidity(address(this));

        //Remove assets from bSTBL to create shortfall
        uint aDAIBalance = IERC20(const.aDAI()).balanceOf(address(bSTBL));
        transferBasketAssets(const.aDAI(), address(this), aDAIBalance/2);
        (,,uint debtAmount) = IComptroller(const.unitroller()).getAccountLiquidity(address(this));

        emit log_named_uint("debtAmount: ", debtAmount);
        emit log_named_uint("borrowingPowerBefore: ", borrowingPowerBefore);
        emit log_named_uint("DAI balance before liq:", ERC20(const.DAI()).balanceOf(address(this)));

        controller.executeLiquidations(
            address(this),
            debtAmount,
            address(bdSTBL),
            debtAmount*105e16/1e18,
            address(this)
        );
        
        emit log_named_uint("DAI balance after liq:", ERC20(const.DAI()).balanceOf(address(this)));
    }

    function mintBasket(address _basket, uint _mintAmount) public {
	    IRecipe recipe = IRecipe(const.recipe());
        uint256 mintPrice = recipe.getPriceEth(_basket, _mintAmount);
        cheats.deal(address(this),mintPrice); 
        emit log_named_uint("mintPrice:", mintPrice);
        //Mint Basket tokens
	    recipe.toBasket{value: mintPrice}(_basket, _mintAmount);  
    }

    function depositCollateral(ICToken _dbToken, uint _collateralAmount, bool _joinMarket) public {
        IERC20 underlyingToken = IERC20(_dbToken.underlying());
        underlyingToken.approve(address(_dbToken),_collateralAmount);
        _dbToken.mint(_collateralAmount, _joinMarket);
   }

   function borrowAssets(ICToken _borrowAsset, uint _borrowAmount) public {
        _borrowAsset.borrow(_borrowAmount);
    }

    function transferBasketAssets(address _assetToMove, address _receiver, uint _amount) public {
    	cheats.startPrank(const.bSTBL());
        IERC20(_assetToMove).transfer(_receiver,_amount);
        cheats.stopPrank();
    }

    receive() external payable{}
}