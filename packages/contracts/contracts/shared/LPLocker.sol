// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ILPLocker.sol";

/**
 * @title LPLocker
 * @notice Unified secure time-locked vault for LP tokens
 * @dev Used by both PresaleRound and Fairlaunch contracts
 *      Prevents rug pulls by locking liquidity for specified duration
 *
 * Features:
 *   - Lock LP tokens with beneficiary + unlock time
 *   - Withdraw after unlock time (beneficiary only)
 *   - Extend lock duration (beneficiary only)
 *   - Transfer beneficiary (owner/launch contract only)
 *   - On-chain query for UI verification
 */
contract LPLocker is ILPLocker, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════
    //                  STORAGE
    // ═══════════════════════════════════════════

    mapping(uint256 => Lock) private _locks;
    uint256 private _lockCount;

    // Index: beneficiary → lockIds (for UI query)
    mapping(address => uint256[]) private _beneficiaryLocks;

    // Index: lpToken → lockIds (for UI query)
    mapping(address => uint256[]) private _tokenLocks;

    // ═══════════════════════════════════════════
    //                  EVENTS
    // ═══════════════════════════════════════════

    event TokensLocked(
        uint256 indexed lockId,
        address indexed lpToken,
        address indexed owner,
        address beneficiary,
        uint256 amount,
        uint256 unlockTime
    );

    event TokensWithdrawn(
        uint256 indexed lockId,
        address indexed beneficiary,
        uint256 amount
    );

    event LockExtended(
        uint256 indexed lockId,
        uint256 oldUnlockTime,
        uint256 newUnlockTime
    );

    event BeneficiaryTransferred(
        uint256 indexed lockId,
        address indexed oldBeneficiary,
        address indexed newBeneficiary
    );

    // ═══════════════════════════════════════════
    //                  ERRORS
    // ═══════════════════════════════════════════

    error InvalidAmount();
    error InvalidUnlockTime();
    error AlreadyWithdrawn();
    error StillLocked();
    error NotBeneficiary();
    error NotOwner();
    error ZeroAddress();

    // ═══════════════════════════════════════════
    //              WRITE FUNCTIONS
    // ═══════════════════════════════════════════

    /**
     * @notice Lock LP tokens for specified duration
     * @param lpToken LP token contract address
     * @param amount Amount to lock
     * @param unlockTime Timestamp when tokens can be withdrawn
     * @param beneficiary Address that can withdraw tokens
     * @return lockId Unique identifier for this lock
     */
    function lockTokens(
        address lpToken,
        uint256 amount,
        uint256 unlockTime,
        address beneficiary
    ) external nonReentrant returns (uint256 lockId) {
        if (amount == 0) revert InvalidAmount();
        if (unlockTime <= block.timestamp) revert InvalidUnlockTime();
        if (beneficiary == address(0)) revert ZeroAddress();
        if (lpToken == address(0)) revert ZeroAddress();

        // Transfer tokens to this contract
        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        // Create lock
        lockId = _lockCount++;
        _locks[lockId] = Lock({
            lpToken: lpToken,
            owner: msg.sender,
            beneficiary: beneficiary,
            amount: amount,
            lockTime: block.timestamp,
            unlockTime: unlockTime,
            withdrawn: false
        });

        // Index for queries
        _beneficiaryLocks[beneficiary].push(lockId);
        _tokenLocks[lpToken].push(lockId);

        emit TokensLocked(lockId, lpToken, msg.sender, beneficiary, amount, unlockTime);
    }

    /**
     * @notice Withdraw locked tokens after unlock time
     * @param lockId ID of the lock to withdraw
     */
    function withdrawTokens(uint256 lockId) external nonReentrant {
        Lock storage lock = _locks[lockId];

        if (msg.sender != lock.beneficiary) revert NotBeneficiary();
        if (block.timestamp < lock.unlockTime) revert StillLocked();
        if (lock.withdrawn) revert AlreadyWithdrawn();

        lock.withdrawn = true;

        IERC20(lock.lpToken).safeTransfer(lock.beneficiary, lock.amount);

        emit TokensWithdrawn(lockId, lock.beneficiary, lock.amount);
    }

    /**
     * @notice Extend lock duration (beneficiary only, can only increase)
     * @param lockId ID of the lock to extend
     * @param newUnlockTime New unlock timestamp — must be later than current
     */
    function extendLock(uint256 lockId, uint256 newUnlockTime) external {
        Lock storage lock = _locks[lockId];

        if (msg.sender != lock.beneficiary) revert NotBeneficiary();
        if (lock.withdrawn) revert AlreadyWithdrawn();
        if (newUnlockTime <= lock.unlockTime) revert InvalidUnlockTime();

        uint256 oldUnlockTime = lock.unlockTime;
        lock.unlockTime = newUnlockTime;

        emit LockExtended(lockId, oldUnlockTime, newUnlockTime);
    }

    /**
     * @notice Transfer beneficiary rights (only by owner — launch contract)
     * @param lockId ID of the lock
     * @param newBeneficiary New beneficiary address
     */
    function transferBeneficiary(uint256 lockId, address newBeneficiary) external {
        Lock storage lock = _locks[lockId];

        if (msg.sender != lock.owner) revert NotOwner();
        if (lock.withdrawn) revert AlreadyWithdrawn();
        if (newBeneficiary == address(0)) revert ZeroAddress();

        address oldBeneficiary = lock.beneficiary;
        lock.beneficiary = newBeneficiary;

        // Update index
        _beneficiaryLocks[newBeneficiary].push(lockId);

        emit BeneficiaryTransferred(lockId, oldBeneficiary, newBeneficiary);
    }

    // ═══════════════════════════════════════════
    //              VIEW FUNCTIONS
    // ═══════════════════════════════════════════

    /**
     * @notice Get lock details
     */
    function getLock(uint256 lockId) external view returns (Lock memory) {
        return _locks[lockId];
    }

    /**
     * @notice Check if lock is currently active (not withdrawn + not expired)
     */
    function isLocked(uint256 lockId) external view returns (bool) {
        Lock memory lock = _locks[lockId];
        return !lock.withdrawn && block.timestamp < lock.unlockTime;
    }

    /**
     * @notice Get time remaining until unlock
     */
    function getTimeUntilUnlock(uint256 lockId) external view returns (uint256) {
        Lock memory lock = _locks[lockId];
        if (block.timestamp >= lock.unlockTime) {
            return 0;
        }
        return lock.unlockTime - block.timestamp;
    }

    /**
     * @notice Total number of locks ever created
     */
    function totalLockCount() external view returns (uint256) {
        return _lockCount;
    }

    /**
     * @notice Get all lock IDs for a beneficiary
     * @dev Returns all historical lock IDs — filter withdrawn in UI
     */
    function getLocksByBeneficiary(address beneficiary) external view returns (uint256[] memory) {
        return _beneficiaryLocks[beneficiary];
    }

    /**
     * @notice Get all lock IDs for a specific LP token
     */
    function getLocksByToken(address lpToken) external view returns (uint256[] memory) {
        return _tokenLocks[lpToken];
    }

    /**
     * @notice Batch get multiple locks (for UI efficiency)
     * @param lockIds Array of lock IDs to fetch
     */
    function getLocksMulti(uint256[] calldata lockIds) external view returns (Lock[] memory result) {
        result = new Lock[](lockIds.length);
        for (uint256 i = 0; i < lockIds.length; i++) {
            result[i] = _locks[lockIds[i]];
        }
    }
}
