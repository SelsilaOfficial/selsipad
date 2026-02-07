// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockTaxToken is ERC20 {
    constructor() ERC20("Tax Token", "TAX") {
        _mint(msg.sender, 1000000 * 10**18);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 tax = amount / 100; // 1% tax
        uint256 netAmount = amount - tax;
        _burn(msg.sender, tax);
        return super.transfer(to, netAmount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 tax = amount / 100; // 1% tax
        uint256 netAmount = amount - tax;
        _burn(from, tax);
        return super.transferFrom(from, to, netAmount);
    }
}
