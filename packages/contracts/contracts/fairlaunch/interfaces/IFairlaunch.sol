// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFairlaunch
 * @notice Interface for Fairlaunch pool contracts
 */
interface IFairlaunch {
    enum Status {
        UPCOMING,
        LIVE,
        ENDED,
        SUCCESS,
        FAILED,
        CANCELLED
    }

    // Events
    event Contributed(address indexed user, uint256 amount, uint256 totalRaised);
    event FinalizedSuccess(uint256 finalPrice, uint256 totalRaised, uint256 lpLocked);
    event FinalizedFail();
    event TokensClaimed(address indexed user, uint256 amount);
    event Refunded(address indexed user, uint256 amount);
    event Paused();
    event Unpaused();
    event Cancelled();
    event LiquidityLocked(address indexed lpToken, uint256 amount, uint256 unlockTime);

    // User functions
    function contribute() external payable;
    function contributeERC20(uint256 amount) external;
    function claimTokens() external;
    function refund() external;

    // Public functions
    function finalize() external;

    // Admin functions
    function pause() external;
    function unpause() external;
    function cancel() external;

    // View functions
    function getStatus() external view returns (Status);
    function getUserContribution(address user) external view returns (uint256);
    function getUserAllocation(address user) external view returns (uint256);
    function getFinalPrice() external view returns (uint256);
}
