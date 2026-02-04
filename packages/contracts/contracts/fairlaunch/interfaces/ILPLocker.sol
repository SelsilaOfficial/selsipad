// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILPLocker
 * @notice Interface for LP token locking providers (e.g., Unicrypt, PancakeSwap Locker)
 */
interface ILPLocker {
    /**
     * @notice Lock LP tokens for a specified duration
     * @param lpToken Address of the LP token to lock
     * @param amount Amount of LP tokens to lock
     * @param unlockTime Unix timestamp when tokens can be unlocked
     */
    function lockTokens(
        address lpToken,
        uint256 amount,
        uint256 unlockTime
    ) external;

    /**
     * @notice Get lock info for a specific LP token
     * @param lpToken Address of the LP token
     * @return amount Locked amount
     * @return unlockTime When tokens unlock
     */
    function getLockInfo(address lpToken)
        external
        view
        returns (uint256 amount, uint256 unlockTime);
}
