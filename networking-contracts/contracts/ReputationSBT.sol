// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title ReputationSBT — reputação soulbound (não transferível)
contract ReputationSBT is ERC721, ERC2771Context {
    struct Reputation {
        uint256 tokenId;
        address recipient;
        address from;
        uint8 score;
        string comment;
        uint256 serviceId;
        uint256 issuedAt;
    }

    event ReputationIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed from,
        uint8 score,
        uint256 serviceId
    );

    address public escrowContract;
    uint256 private _nextTokenId = 1;

    mapping(uint256 => Reputation) private _reputations;
    mapping(address => uint256[]) private _tokensByRecipient;
    mapping(address => uint256) private _scoreSum;
    mapping(address => uint256) private _scoreCount;

    error OnlyEscrow();
    error InvalidScore();
    error SoulboundTransfer();
    error NotTokenOwner();

    modifier onlyEscrow() {
        if (_msgSender() != escrowContract) revert OnlyEscrow();
        _;
    }

    constructor(address trustedForwarder)
        ERC721("FIPECAFI Reputation", "FREP")
        ERC2771Context(trustedForwarder)
    {}

    function setEscrowContract(address escrow) external {
        require(escrowContract == address(0), "Escrow already set");
        require(escrow != address(0), "Invalid escrow");
        escrowContract = escrow;
    }

    function issueReputation(
        address recipient,
        address from,
        uint8 score,
        string calldata comment,
        uint256 serviceId
    ) external onlyEscrow {
        if (score < 1 || score > 5) revert InvalidScore();

        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);

        _reputations[tokenId] = Reputation({
            tokenId: tokenId,
            recipient: recipient,
            from: from,
            score: score,
            comment: comment,
            serviceId: serviceId,
            issuedAt: block.timestamp
        });

        _tokensByRecipient[recipient].push(tokenId);
        _scoreSum[recipient] += score;
        _scoreCount[recipient] += 1;

        emit ReputationIssued(tokenId, recipient, from, score, serviceId);
    }

    function burnReputation(uint256 tokenId) external {
        if (ownerOf(tokenId) != _msgSender()) revert NotTokenOwner();
        _burn(tokenId);
    }

    function getReputationScore(address user)
        external
        view
        returns (uint256 averageScaled, uint256 total)
    {
        total = _scoreCount[user];
        if (total == 0) return (0, 0);
        averageScaled = (_scoreSum[user] * 100) / total;
    }

    function getReputations(address user) external view returns (Reputation[] memory) {
        uint256[] storage ids = _tokensByRecipient[user];
        Reputation[] memory list = new Reputation[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            list[i] = _reputations[ids[i]];
        }
        return list;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Reputation memory rep = _reputations[tokenId];

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">',
            '<rect width="256" height="256" fill="#4f46e5"/>',
            '<text x="50%" y="45%" fill="white" font-size="48" text-anchor="middle" font-family="sans-serif">',
            Strings.toString(rep.score),
            "</text>",
            '<text x="50%" y="65%" fill="#c7d2fe" font-size="14" text-anchor="middle" font-family="sans-serif">FIPECAFI Rep</text>',
            "</svg>"
        );

        string memory json = string.concat(
            '{"name":"Reputation #',
            Strings.toString(tokenId),
            '","description":"Soulbound reputation score ',
            Strings.toString(rep.score),
            '","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert SoulboundTransfer();
        return super._update(to, tokenId, auth);
    }

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength()
        internal
        view
        override(Context, ERC2771Context)
        returns (uint256)
    {
        return ERC2771Context._contextSuffixLength();
    }
}
