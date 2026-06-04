// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title CredentialNFT — credenciais acadêmicas/profissionais verificáveis
contract CredentialNFT is ERC721, AccessControl, ERC2771Context {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Credential {
        uint256 tokenId;
        address recipient;
        string credentialType;
        string institution;
        string title;
        uint256 issueDate;
        uint256 expiryDate;
        string metadataURI;
        bool revoked;
    }

    event CredentialIssued(uint256 indexed tokenId, address indexed recipient, string institution);
    event CredentialRevoked(uint256 indexed tokenId);

    uint256 private _nextTokenId = 1;
    mapping(uint256 => Credential) private _credentials;
    mapping(address => uint256[]) private _tokensByRecipient;

    constructor(address trustedForwarder, address admin)
        ERC721("FIPECAFI Credential", "FCRED")
        ERC2771Context(trustedForwarder)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    function issueCredential(
        address recipient,
        string calldata credentialType,
        string calldata institution,
        string calldata title,
        uint256 issueDate,
        uint256 expiryDate,
        string calldata metadataURI
    ) external onlyRole(ISSUER_ROLE) returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);

        _credentials[tokenId] = Credential({
            tokenId: tokenId,
            recipient: recipient,
            credentialType: credentialType,
            institution: institution,
            title: title,
            issueDate: issueDate,
            expiryDate: expiryDate,
            metadataURI: metadataURI,
            revoked: false
        });

        _tokensByRecipient[recipient].push(tokenId);
        emit CredentialIssued(tokenId, recipient, institution);
    }

    function revokeCredential(uint256 tokenId) external onlyRole(ISSUER_ROLE) {
        _requireOwned(tokenId);
        _credentials[tokenId].revoked = true;
        emit CredentialRevoked(tokenId);
    }

    function verifyCredential(uint256 tokenId)
        external
        view
        returns (bool isValid, Credential memory credential)
    {
        _requireOwned(tokenId);
        credential = _credentials[tokenId];
        if (credential.revoked) return (false, credential);
        if (credential.expiryDate != 0 && block.timestamp > credential.expiryDate) {
            return (false, credential);
        }
        return (true, credential);
    }

    function grantIssuerRole(address institution) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ISSUER_ROLE, institution);
    }

    function getCredentialsByRecipient(address recipient)
        external
        view
        returns (Credential[] memory)
    {
        uint256[] storage ids = _tokensByRecipient[recipient];
        Credential[] memory list = new Credential[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            list[i] = _credentials[ids[i]];
        }
        return list;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _credentials[tokenId].metadataURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
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
