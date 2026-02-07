// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockLPLocker {
    using SafeERC20 for IERC20;

    uint256 public lockCount;

    function lockTokens(
        address lpToken,
        uint256 amount,
        uint256 unlockTime,
        address beneficiary
    ) external returns (uint256 lockId) {
        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);
        lockId = lockCount++;
        return lockId;
    }
}
