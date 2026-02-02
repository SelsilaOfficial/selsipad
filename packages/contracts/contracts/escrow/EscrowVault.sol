// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EscrowVault
 * @notice Holds tokens for projects pending admin deployment
 * @dev This contract escrows tokens until admin deploys the fairlaunch/presale contract
 */
contract EscrowVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    struct Deposit {
        address tokenAddress;
        uint256 amount;
        address depositor;
        uint256 timestamp;
        bool released;
        bool refunded;
    }
    
    // projectId => Deposit
    mapping(bytes32 => Deposit) public deposits;
    
    // Events
    event Deposited(
        bytes32 indexed projectId,
        address indexed tokenAddress,
        uint256 amount,
        address indexed depositor
    );
    
    event Released(
        bytes32 indexed projectId,
        address indexed toContract,
        uint256 amount
    );
    
    event Refunded(
        bytes32 indexed projectId,
        address indexed to,
        uint256 amount
    );
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Deposit tokens for a project
     * @param projectId Unique identifier for the project
     * @param tokenAddress Address of the token to escrow
     * @param amount Amount of tokens to escrow
     */
    function deposit(
        bytes32 projectId,
        address tokenAddress,
        uint256 amount
    ) external nonReentrant {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0, "Amount must be > 0");
        require(deposits[projectId].amount == 0, "Project already has deposit");
        
        // Transfer tokens from depositor to this contract
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
        
        // Record deposit
        deposits[projectId] = Deposit({
            tokenAddress: tokenAddress,
            amount: amount,
            depositor: msg.sender,
            timestamp: block.timestamp,
            released: false,
            refunded: false
        });
        
        emit Deposited(projectId, tokenAddress, amount, msg.sender);
    }
    
    /**
     * @notice Release escrowed tokens to deployed contract (admin only)
     * @param projectId Project identifier
     * @param toContract Address of the deployed fairlaunch/presale contract
     */
    function release(
        bytes32 projectId,
        address toContract
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        Deposit storage dep = deposits[projectId];
        
        require(dep.amount > 0, "No deposit found");
        require(!dep.released, "Already released");
        require(!dep.refunded, "Already refunded");
        require(toContract != address(0), "Invalid contract address");
        
        // Mark as released
        dep.released = true;
        
        // Transfer tokens to deployed contract
        IERC20(dep.tokenAddress).safeTransfer(toContract, dep.amount);
        
        emit Released(projectId, toContract, dep.amount);
    }
    
    /**
     * @notice Refund escrowed tokens to depositor (admin only)
     * @param projectId Project identifier
     */
    function refund(bytes32 projectId) external onlyRole(ADMIN_ROLE) nonReentrant {
        Deposit storage dep = deposits[projectId];
        
        require(dep.amount > 0, "No deposit found");
        require(!dep.released, "Already released");
        require(!dep.refunded, "Already refunded");
        
        // Mark as refunded
        dep.refunded = true;
        
        // Return tokens to original depositor
        IERC20(dep.tokenAddress).safeTransfer(dep.depositor, dep.amount);
        
        emit Refunded(projectId, dep.depositor, dep.amount);
    }
    
    /**
     * @notice Get deposit details
     * @param projectId Project identifier
     * @return Deposit struct
     */
    function getDeposit(bytes32 projectId) external view returns (Deposit memory) {
        return deposits[projectId];
    }
    
    /**
     * @notice Get balance of specific project
     * @param projectId Project identifier
     * @return amount Amount currently escrowed
     */
    function getBalance(bytes32 projectId) external view returns (uint256) {
        Deposit memory dep = deposits[projectId];
        if (dep.released || dep.refunded) {
            return 0;
        }
        return dep.amount;
    }
    
    /**
     * @notice Check if deposit exists and is pending
     * @param projectId Project identifier
     * @return bool True if deposit exists and hasn't been released/refunded
     */
    function isPending(bytes32 projectId) external view returns (bool) {
        Deposit memory dep = deposits[projectId];
        return dep.amount > 0 && !dep.released && !dep.refunded;
    }
}
