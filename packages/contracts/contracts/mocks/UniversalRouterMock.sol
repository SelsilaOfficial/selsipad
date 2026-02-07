// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UniversalRouterMock {
    bool public shouldFail;

    function setFail(bool _fail) external {
        shouldFail = _fail;
    }

    function factory() external view returns (address) {
        return address(this);
    }

    function WETH() external view returns (address) {
        return address(this); // Mock WETH address
    }

    function getPair(address, address) external view returns (address) {
        return address(this); // Mock Pair address
    }

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity) {
        if (shouldFail) revert("DexAddLiquidityCallFailed");
        return (amountTokenDesired, msg.value, 100);
    }

    // ERC20 Mock for Pair/Token behavior
    function approve(address, uint256) external pure returns (bool) {
        return true;
    }

    function balanceOf(address) external pure returns (uint256) {
        return 1000 ether;
    }
    
    // Transfer function for Token behavior
    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }
    
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return true;
    }
}
