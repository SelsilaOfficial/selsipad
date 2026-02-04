// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockFeeSplitter
 * @notice Mock fee splitter for testing
 */
contract MockFeeSplitter {
    mapping(address => bool) public hasPresaleRole;

    event PresaleRoleGranted(address indexed presale);
    event FeeDistributed(uint256 amount);

    function grantPresaleRole(address presale) external {
        hasPresaleRole[presale] = true;
        emit PresaleRoleGranted(presale);
    }

    function distributeFees() external payable {
        emit FeeDistributed(msg.value);
    }

    receive() external payable {}
}
