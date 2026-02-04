// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleToken
 * @notice Standard ERC20 token with fixed supply
 * @dev No mint, no pause, no tax - perfectly safe for launchpads
 */
contract SimpleToken is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint8 decimals_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        _decimals = decimals_;
        _mint(owner_, totalSupply_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

/**
 * @title SimpleTokenFactory
 * @notice Factory for creating standard ERC20 tokens with platform fee
 * @dev Tokens created here are automatically whitelisted (skip SC scan)
 */
contract SimpleTokenFactory {
    // Platform treasury
    address public immutable treasury;
    
    // Token creation fee
    uint256 public creationFee;
    
    // Registry of created tokens
    mapping(address => bool) public isCreatedByPlatform;
    address[] public allCreatedTokens;
    
    // Events
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        uint8 decimals
    );
    
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    
    constructor(address treasury_, uint256 creationFee_) {
        require(treasury_ != address(0), "Invalid treasury");
        treasury = treasury_;
        creationFee = creationFee_;
    }
    
    /**
     * @notice Create a new ERC20 token
     * @param name Token name
     * @param symbol Token symbol
     * @param totalSupply Total supply (in wei, e.g., 1M * 10^18 for 1M tokens with 18 decimals)
     * @param decimals Token decimals (usually 18)
     * @return token Address of the created token
     */
    function createToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint8 decimals
    ) external payable returns (address token) {
        require(msg.value >= creationFee, "Insufficient creation fee");
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");
        require(totalSupply > 0, "Supply must be > 0");
        require(decimals <= 18, "Decimals too high");
        
        // Deploy token (sender becomes owner)
        SimpleToken newToken = new SimpleToken(
            name,
            symbol,
            totalSupply,
            decimals,
            msg.sender
        );
        
        token = address(newToken);
        
        // Register token
        isCreatedByPlatform[token] = true;
        allCreatedTokens.push(token);
        
        // Send fee to treasury
        if (msg.value > 0) {
            (bool success, ) = treasury.call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }
        
        emit TokenCreated(
            token,
            msg.sender,
            name,
            symbol,
            totalSupply,
            decimals
        );
    }
    
    /**
     * @notice Get total number of created tokens
     */
    function totalCreatedTokens() external view returns (uint256) {
        return allCreatedTokens.length;
    }
    
    /**
     * @notice Check if token was created by platform
     */
    function isPlatformToken(address token) external view returns (bool) {
        return isCreatedByPlatform[token];
    }
}
