// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReputationSBT {
    function issueReputation(
        address recipient,
        address from,
        uint8 score,
        string calldata comment,
        uint256 serviceId
    ) external;
}
