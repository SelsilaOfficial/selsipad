// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../BlueCheckRegistry.sol";

contract BlueCheckRegistryTest is Test {
    BlueCheckRegistry public registry;
    
    address public owner;
    address public treasury;
    address public referralPool;
    address public user1;
    address public user2;
    
    uint256 public constant INITIAL_BNB_PRICE = 600 * 1e18; // $600 per BNB
    
    event BlueCheckPurchased(
        address indexed user,
        uint256 amountPaid,
        uint256 treasuryAmount,
        uint256 referralPoolAmount,
        uint256 timestamp
    );
    
    function setUp() public {
        owner = address(this);
        treasury = address(0x1);
        referralPool = address(0x2);
        user1 = address(0x3);
        user2 = address(0x4);
        
        registry = new BlueCheckRegistry(treasury, referralPool, INITIAL_BNB_PRICE);
        
        // Fund users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
    }
    
    function testInitialState() public {
        assertEq(registry.treasury(), treasury);
        assertEq(registry.referralPool(), referralPool);
        assertEq(registry.manualPriceBNB(), INITIAL_BNB_PRICE);
        assertEq(registry.totalPurchases(), 0);
        assertEq(registry.totalBNBCollected(), 0);
    }
    
    function testGetRequiredBNB() public {
        // $10 / $600 = 0.01666... BNB
        uint256 required = registry.getRequiredBNB();
        uint256 expected = (10 * 1e18 * 1e18) / INITIAL_BNB_PRICE;
        
        assertEq(required, expected);
        assertApproxEqAbs(required, 0.0166666 ether, 0.0001 ether);
    }
    
    function testPurchaseBlueCheck() public {
        uint256 requiredBNB = registry.getRequiredBNB();
        
        uint256 treasuryBefore = treasury.balance;
        uint256 poolBefore = referralPool.balance;
        
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit BlueCheckPurchased(user1, requiredBNB, (requiredBNB * 70) / 100, (requiredBNB * 30) / 100, block.timestamp);
        
        registry.purchaseBlueCheck{value: requiredBNB}();
        
        // Verify purchase recorded
        assertTrue(registry.hasBlueCheck(user1));
        assertEq(registry.purchase Timestamp(user1), block.timestamp);
        assertEq(registry.totalPurchases(), 1);
        
        // Verify fee split
        uint256 expectedTreasury = (requiredBNB * 70) / 100;
        uint256 expectedPool = requiredBNB - expectedTreasury;
        
        assertEq(treasury.balance - treasuryBefore, expectedTreasury);
        assertEq(referralPool.balance - poolBefore, expectedPool);
    }
    
    function testPurchaseWithExcessRefund() public {
        uint256 requiredBNB = registry.getRequiredBNB();
        uint256 sentAmount = requiredBNB + 0.01 ether;
        
        uint256 user1Before = user1.balance;
        
        vm.prank(user1);
        registry.purchaseBlueCheck{value: sentAmount}();
        
        // Should refund excess
        uint256 expectedRefund = sentAmount - requiredBNB;
        assertEq(user1.balance, user1Before - requiredBNB);
    }
    
    function testCannotPurchaseTwice() public {
        uint256 requiredBNB = registry.getRequiredBNB();
        
        vm.startPrank(user1);
        registry.purchaseBlueCheck{value: requiredBNB}();
        
        vm.expectRevert(BlueCheckRegistry.AlreadyPurchased.selector);
        registry.purchaseBlueCheck{value: requiredBNB}();
        vm.stopPrank();
    }
    
    function testCannotPurchaseWithInsufficientFunds() public {
        uint256 requiredBNB = registry.getRequiredBNB();
        
        vm.prank(user1);
        vm.expectRevert(BlueCheckRegistry.InsufficientPayment.selector);
        registry.purchaseBlueCheck{value: requiredBNB - 1}();
    }
    
    function testMultiplePurchases() public {
        uint256 requiredBNB = registry.getRequiredBNB();
        
        vm.prank(user1);
        registry.purchaseBlueCheck{value: requiredBNB}();
        
        vm.prank(user2);
        registry.purchaseBlueCheck{value: requiredBNB}();
        
        assertTrue(registry.hasBlueCheck(user1));
        assertTrue(registry.hasBlueCheck(user2));
        assertEq(registry.totalPurchases(), 2);
        assertEq(registry.totalBNBCollected(), requiredBNB * 2);
    }
    
    function testUpdateTreasury() public {
        address newTreasury = address(0x5);
        
        registry.updateTreasury(newTreasury);
        assertEq(registry.treasury(), newTreasury);
    }
    
    function testUpdateReferralPool() public {
        address newPool = address(0x6);
        
        registry.updateReferralPool(newPool);
        assertEq(registry.referralPool(), newPool);
    }
    
    function testUpdateManualPrice() public {
        uint256 newPrice = 500 * 1e18; // $500 per BNB
        
        registry.updateManualPrice(newPrice);
        assertEq(registry.manualPriceBNB(), newPrice);
        
        // Required BNB should change
        uint256 newRequired = registry.getRequiredBNB();
        uint256 expected = (10 * 1e18 * 1e18) / newPrice;
        assertEq(newRequired, expected);
    }
    
    function testPauseAndUnpause() public {
        registry.pause();
        
        uint256 requiredBNB = registry.getRequiredBNB();
        
        vm.prank(user1);
        vm.expectRevert("Pausable: paused");
        registry.purchaseBlueCheck{value: requiredBNB}();
        
        registry.unpause();
        
        vm.prank(user1);
        registry.purchaseBlueCheck{value: requiredBNB}();
        assertTrue(registry.hasBlueCheck(user1));
    }
    
    function testOnlyOwnerCanUpdateSettings() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        registry.updateTreasury(address(0x7));
        
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        registry.updateReferralPool(address(0x8));
        
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        registry.updateManualPrice(700 * 1e18);
    }
}
