// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SelsipadBCToken
 * @notice Minimal ERC-20 token minted by the BondingCurveFactory.
 *         The factory is the sole minter; once migration occurs no new
 *         tokens can be minted because the factory flips the migrated flag.
 */
contract SelsipadBCToken {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;
    uint256 public totalSupply;
    address public immutable factory;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error OnlyFactory();
    error InsufficientBalance();
    error InsufficientAllowance();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    constructor(string memory _name, string memory _symbol, address _creator) {
        name    = _name;
        symbol  = _symbol;
        factory = msg.sender;
        // Mint 1 token to creator as initial allocation
        _mint(_creator, 1 ether);
    }

    /* ─── Internal helpers ─── */

    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply   += amount;
        emit Transfer(address(0), to, amount);
    }

    /* ─── Factory-only mint ─── */

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
