// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IReputationSBT} from "./interfaces/IReputationSBT.sol";

/// @title ServiceEscrow — marketplace com escrow em USDC
contract ServiceEscrow is Ownable, ReentrancyGuard, ERC2771Context {
    using SafeERC20 for IERC20;

    enum ServiceStatus {
        Open,
        InProgress,
        Delivered,
        Completed,
        Disputed,
        Cancelled
    }

    struct Service {
        uint256 id;
        address payable provider;
        address payable client;
        uint256 amount;
        ServiceStatus status;
        string title;
        string description;
        uint256 createdAt;
        uint256 deadline;
        bool clientApproved;
        bool hasDispute;
    }

    event ServiceCreated(
        uint256 indexed serviceId,
        address indexed provider,
        string title,
        uint256 amount
    );
    event ServiceHired(uint256 indexed serviceId, address indexed client, uint256 amount);
    event ServiceDelivered(uint256 indexed serviceId);
    event ServiceCompleted(
        uint256 indexed serviceId,
        address indexed provider,
        address indexed client,
        uint256 amount
    );
    event DisputeOpened(uint256 indexed serviceId);
    event DisputeResolved(uint256 indexed serviceId, bool favorProvider);
    event ServiceCancelled(uint256 indexed serviceId);
    event PlatformFeeUpdated(uint256 feeBps);
    event TreasuryUpdated(address treasury);

    IERC20 public immutable paymentToken;
    IReputationSBT public immutable reputationSBT;

    address public treasury;
    uint256 public platformFeeBps;

    uint256 public constant MAX_FEE_BPS = 1000; // 10%
    uint256 private _nextServiceId = 1;

    mapping(uint256 => Service) public services;

    error InvalidFee();
    error InvalidAmount();
    error InvalidDeadline();
    error ServiceNotFound();
    error InvalidStatus();
    error NotProvider();
    error NotClient();
    error NotAuthorized();
    error TransferFailed();

    constructor(
        address usdc,
        address reputation,
        address treasury_,
        uint256 platformFeeBps_,
        address trustedForwarder
    ) Ownable(msg.sender) ERC2771Context(trustedForwarder) {
        if (platformFeeBps_ > MAX_FEE_BPS) revert InvalidFee();
        paymentToken = IERC20(usdc);
        reputationSBT = IReputationSBT(reputation);
        treasury = treasury_;
        platformFeeBps = platformFeeBps_;
    }

    function setPlatformFee(uint256 feeBps) external onlyOwner {
        if (feeBps > MAX_FEE_BPS) revert InvalidFee();
        platformFeeBps = feeBps;
        emit PlatformFeeUpdated(feeBps);
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "Invalid treasury");
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function createService(
        string calldata title,
        string calldata description,
        uint256 amount,
        uint256 deadline
    ) external returns (uint256 serviceId) {
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        serviceId = _nextServiceId++;
        services[serviceId] = Service({
            id: serviceId,
            provider: payable(_msgSender()),
            client: payable(address(0)),
            amount: amount,
            status: ServiceStatus.Open,
            title: title,
            description: description,
            createdAt: block.timestamp,
            deadline: deadline,
            clientApproved: false,
            hasDispute: false
        });

        emit ServiceCreated(serviceId, _msgSender(), title, amount);
    }

    function hireService(uint256 serviceId) external nonReentrant {
        Service storage s = _getService(serviceId);
        if (s.status != ServiceStatus.Open) revert InvalidStatus();

        s.client = payable(_msgSender());
        s.status = ServiceStatus.InProgress;

        paymentToken.safeTransferFrom(_msgSender(), address(this), s.amount);

        emit ServiceHired(serviceId, _msgSender(), s.amount);
    }

    function markDelivered(uint256 serviceId) external {
        Service storage s = _getService(serviceId);
        if (_msgSender() != s.provider) revert NotProvider();
        if (s.status != ServiceStatus.InProgress) revert InvalidStatus();

        s.status = ServiceStatus.Delivered;
        emit ServiceDelivered(serviceId);
    }

    function approveDelivery(uint256 serviceId, uint8 score, string calldata comment)
        external
        nonReentrant
    {
        Service storage s = _getService(serviceId);
        if (_msgSender() != s.client) revert NotClient();
        if (s.status != ServiceStatus.Delivered) revert InvalidStatus();

        s.clientApproved = true;
        s.status = ServiceStatus.Completed;

        _releasePayment(s);

        reputationSBT.issueReputation(s.provider, s.client, score, comment, serviceId);

        emit ServiceCompleted(serviceId, s.provider, s.client, s.amount);
    }

    function openDispute(uint256 serviceId) external {
        Service storage s = _getService(serviceId);
        if (s.status != ServiceStatus.Delivered) revert InvalidStatus();
        if (_msgSender() != s.client && _msgSender() != s.provider) revert NotAuthorized();

        s.hasDispute = true;
        s.status = ServiceStatus.Disputed;
        emit DisputeOpened(serviceId);
    }

    function resolveDispute(uint256 serviceId, bool favorProvider) external onlyOwner nonReentrant {
        Service storage s = _getService(serviceId);
        if (s.status != ServiceStatus.Disputed) revert InvalidStatus();

        if (favorProvider) {
            _releasePayment(s);
        } else {
            paymentToken.safeTransfer(s.client, s.amount);
        }

        s.status = ServiceStatus.Completed;
        emit DisputeResolved(serviceId, favorProvider);
    }

    function cancelService(uint256 serviceId) external {
        Service storage s = _getService(serviceId);
        if (_msgSender() != s.provider) revert NotProvider();
        if (s.status != ServiceStatus.Open) revert InvalidStatus();

        s.status = ServiceStatus.Cancelled;
        emit ServiceCancelled(serviceId);
    }

    function getServicesByProvider(address provider)
        external
        view
        returns (Service[] memory result)
    {
        uint256 count;
        for (uint256 i = 1; i < _nextServiceId; i++) {
            if (services[i].provider == provider) count++;
        }

        result = new Service[](count);
        uint256 idx;
        for (uint256 i = 1; i < _nextServiceId; i++) {
            if (services[i].provider == provider) {
                result[idx++] = services[i];
            }
        }
    }

    function _releasePayment(Service storage s) internal {
        uint256 fee = (s.amount * platformFeeBps) / 10_000;
        uint256 providerAmount = s.amount - fee;

        paymentToken.safeTransfer(s.provider, providerAmount);
        if (fee > 0) {
            paymentToken.safeTransfer(treasury, fee);
        }
    }

    function _getService(uint256 serviceId) internal view returns (Service storage s) {
        s = services[serviceId];
        if (s.id == 0) revert ServiceNotFound();
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
