// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MerkleVesting
 * @notice Scalable token vesting using Merkle tree for allocation proofs
 * @dev Prevents cross-round proof replay via salted leaf encoding
 */
contract MerkleVesting is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Immutable parameters
    address public immutable token;
    uint256 public immutable tgeUnlockBps;     // Basis points unlocked at TGE (1000 = 10%)
    uint256 public immutable cliffDuration;     // Seconds after TGE
    uint256 public immutable vestingDuration;   // Seconds of linear vesting
    bytes32 public immutable scheduleSalt;       // Unique salt for this schedule (hashed)
    
    // State
    bytes32 public merkleRoot;
    uint256 public tgeTimestamp;
    uint256 public totalAllocated;
    
    // Per-user claimed amounts
    mapping(address => uint256) public claimed;
    
    // Events
    event MerkleRootSet(bytes32 indexed merkleRoot, uint256 tgeTimestamp, uint256 totalAllocated);
    event Claimed(address indexed beneficiary, uint256 amount);
    
    // Errors
    error RootAlreadySet();
    error RootNotSet();
    error InvalidProof();
    error NothingToClaim();
    error InsufficientVaultBalance();
    error ZeroAllocation();
    
    constructor(
        address _token,
        uint256 _tgeUnlockBps,
        uint256 _cliffDuration,
        uint256 _vestingDuration,
        bytes32 _scheduleSalt,
        address _admin
    ) {
        token = _token;
        tgeUnlockBps = _tgeUnlockBps;
        cliffDuration = _cliffDuration;
        vestingDuration = _vestingDuration;
        scheduleSalt = _scheduleSalt;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }
    
    /**
     * @notice Set Merkle root (called once after presale finalization)
     * @param _merkleRoot Root of allocation Merkle tree
     * @param _totalAllocated Total tokens allocated (for vault balance check)
     */
    function setMerkleRoot(bytes32 _merkleRoot, uint256 _totalAllocated) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (merkleRoot != bytes32(0)) revert RootAlreadySet();
        if (_merkleRoot == bytes32(0)) revert InvalidProof();
        if (_totalAllocated == 0) revert ZeroAllocation();
        
        // CRITICAL: Ensure vault is funded before enabling claims
        uint256 vaultBalance = IERC20(token).balanceOf(address(this));
        if (vaultBalance < _totalAllocated) revert InsufficientVaultBalance();
        
        merkleRoot = _merkleRoot;
        tgeTimestamp = block.timestamp;
        totalAllocated = _totalAllocated;
        
        emit MerkleRootSet(_merkleRoot, tgeTimestamp, _totalAllocated);
    }
    
    /**
     * @notice Claim vested tokens with Merkle proof
     * @param totalAllocation Total tokens allocated to beneficiary
     * @param proof Merkle proof
     */
    function claim(uint256 totalAllocation, bytes32[] calldata proof) 
        external 
        nonReentrant 
    {
        if (merkleRoot == bytes32(0)) revert RootNotSet();
        
        // V2.1 PATCH: Salted leaf encoding to prevent cross-round replay
        bytes32 leaf = keccak256(abi.encodePacked(
            address(this),          // Contract address
            block.chainid,          // Chain ID
            scheduleSalt,           // Schedule salt (already bytes32)
            msg.sender,             // Beneficiary
            totalAllocation         // Allocation amount
        ));
        
        // Verify Merkle proof
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) {
            revert InvalidProof();
        }
        
        // Calculate claimable
        uint256 claimable = _calculateClaimable(totalAllocation);
        uint256 alreadyClaimed = claimed[msg.sender];
        
        if (claimable <= alreadyClaimed) revert NothingToClaim();
        
        uint256 toClaim = claimable - alreadyClaimed;
        
        // Update claimed
        claimed[msg.sender] = claimable;
        
        // Transfer tokens
        IERC20(token).safeTransfer(msg.sender, toClaim);
        
        emit Claimed(msg.sender, toClaim);
    }
    
    /**
     * @notice Calculate claimable amount
     * @dev TGE unlock + cliff + linear vesting
     */
    function _calculateClaimable(uint256 totalAllocation) 
        internal 
        view 
        returns (uint256) 
    {
        // TGE amount
        uint256 tgeAmount = (totalAllocation * tgeUnlockBps) / 10000;
        
        // Before cliff: only TGE unlocked
        uint256 cliffEnd = tgeTimestamp + cliffDuration;
        if (block.timestamp < cliffEnd) {
            return tgeAmount;
        }
        
        // After vesting ends: fully unlocked
        uint256 vestingEnd = cliffEnd + vestingDuration;
        if (block.timestamp >= vestingEnd) {
            return totalAllocation;
        }
        
        // Linear vesting
        uint256 vestedAmount = totalAllocation - tgeAmount;
        uint256 elapsed = block.timestamp - cliffEnd;
        uint256 vestedSoFar = (vestedAmount * elapsed) / vestingDuration;
        
        return tgeAmount + vestedSoFar;
    }
    
    /**
     * @notice View: Get claimable amount for beneficiary
     * @param beneficiary Beneficiary address
     * @param totalAllocation Total allocation for beneficiary
     */
    function getClaimable(address beneficiary, uint256 totalAllocation) 
        external 
        view 
        returns (uint256) 
    {
        if (merkleRoot == bytes32(0)) return 0;
        
        uint256 claimable = _calculateClaimable(totalAllocation);
        uint256 alreadyClaimed = claimed[beneficiary];
        
        return claimable > alreadyClaimed ? claimable - alreadyClaimed : 0;
    }
    
    /**
     * @notice View: Get vesting info
     */
    function getVestingInfo() external view returns (
        uint256 _tgeUnlockBps,
        uint256 _cliffDuration,
        uint256 _vestingDuration,
        uint256 _tgeTimestamp,
        bytes32 _merkleRoot
    ) {
        return (
            tgeUnlockBps,
            cliffDuration,
            vestingDuration,
            tgeTimestamp,
            merkleRoot
        );
    }
}
