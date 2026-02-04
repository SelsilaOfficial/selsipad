// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Using explicit imports instead of separate console.sol
// import "hardhat/console.sol" // Only for debug

/**
 * @title TeamVesting
 * @notice Simple vesting contract for Fairlaunch team tokens
 * @dev Deployed by FairlaunchFactory. Tokens are pushed to this contract during Fairlaunch creation.
 */
contract TeamVesting is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant BENEFICIARY_ROLE = keccak256("BENEFICIARY_ROLE");

    // Immutable Config
    address public immutable token;
    uint256 public immutable startTime; // Reference time (usually Fairlaunch EndTime)

    struct VestingSchedule {
        uint256 durationBytes; // Duration in seconds from startTime
        uint256 amount;        // Amount to unlock
        bool claimed;
    }

    VestingSchedule[] public schedules;
    uint256 public totalVestingAmount;
    uint256 public totalClaimed;

    event TokensClaimed(address indexed beneficiary, uint256 amount);
    event ScheduleCreated(uint256 totalAmount, uint256 scheduleCount);

    error NoTokensToClaim();
    error Unauthorized();
    error InvalidSchedule();

    constructor(
        address _token,
        address _beneficiary,
        uint256 _startTime,
        uint256[] memory _durations,
        uint256[] memory _amounts,
        address _admin
    ) {
        require(_token != address(0), "Invalid token");
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_durations.length == _amounts.length, "Length mismatch");
        require(_durations.length > 0, "Empty schedule");

        token = _token;
        startTime = _startTime;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(BENEFICIARY_ROLE, _beneficiary);

        uint256 total = 0;
        for (uint256 i = 0; i < _durations.length; i++) {
            schedules.push(VestingSchedule({
                durationBytes: _durations[i],
                amount: _amounts[i],
                claimed: false
            }));
            total += _amounts[i];
        }
        totalVestingAmount = total;

        emit ScheduleCreated(total, _durations.length);
    }

    /**
     * @notice Claim all unlocked tokens
     */
    function claim() external nonReentrant onlyRole(BENEFICIARY_ROLE) {
        uint256 claimable = 0;
        uint256 len = schedules.length;

        for (uint256 i = 0; i < len; i++) {
            if (!schedules[i].claimed) {
                if (block.timestamp >= startTime + schedules[i].durationBytes) {
                    schedules[i].claimed = true;
                    claimable += schedules[i].amount;
                }
            }
        }

        if (claimable == 0) revert NoTokensToClaim();

        totalClaimed += claimable;
        IERC20(token).safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    /**
     * @notice Get claimable amount
     */
    function getClaimable() external view returns (uint256) {
        uint256 claimable = 0;
        uint256 len = schedules.length;

        for (uint256 i = 0; i < len; i++) {
            if (!schedules[i].claimed) {
                if (block.timestamp >= startTime + schedules[i].durationBytes) {
                    claimable += schedules[i].amount;
                }
            }
        }
        return claimable;
    }

    /**
     * @notice Get full schedule info
     */
    function getSchedule() external view returns (
        uint256[] memory times,
        uint256[] memory amounts,
        bool[] memory claimedStatus
    ) {
        uint256 len = schedules.length;
        times = new uint256[](len);
        amounts = new uint256[](len);
        claimedStatus = new bool[](len);

        for (uint i = 0; i < len; i++) {
            times[i] = startTime + schedules[i].durationBytes;
            amounts[i] = schedules[i].amount;
            claimedStatus[i] = schedules[i].claimed;
        }
    }
}
