// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SelsipadBCToken
 * @notice Minimal ERC-20 token with a hard MAX_SUPPLY cap.
 *         The entire supply is pre-minted to the factory at deployment.
 *         Buy/sell on the bonding curve use transfer — no further minting.
 */
contract SelsipadBCToken {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;

    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether; // 1 Billion tokens
    uint256 public totalSupply;

    address public immutable factory;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error OnlyFactory();
    error InsufficientBalance();
    error InsufficientAllowance();
    error MaxSupplyExceeded();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    constructor(string memory _name, string memory _symbol, address /* _creator */) {
        name    = _name;
        symbol  = _symbol;
        factory = msg.sender;
        // Pre-mint entire MAX_SUPPLY to the factory contract
        _mint(msg.sender, MAX_SUPPLY);
    }

    /* ─── Internal helpers ─── */

    function _mint(address to, uint256 amount) internal {
        if (totalSupply + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        balanceOf[to] += amount;
        totalSupply   += amount;
        emit Transfer(address(0), to, amount);
    }

    /* ─── Factory-only mint (disabled after initial pre-mint) ─── */

    function mintFromFactory(address to, uint256 amount) external onlyFactory {
        _mint(to, amount);
    }

    /* ─── ERC-20 standard ─── */

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        if (balanceOf[from] < amount)              revert InsufficientBalance();
        if (allowance[from][msg.sender] < amount)  revert InsufficientAllowance();
        balanceOf[from]                -= amount;
        allowance[from][msg.sender]    -= amount;
        balanceOf[to]                  += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
