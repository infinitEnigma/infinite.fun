// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Infinite Token Vesting
/// @notice Multi-beneficiary linear vesting contract with optional revocation and cliff support.
contract TokenVesting is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Vesting schedule configuration and accounting for a beneficiary.
    struct VestingSchedule {
        address beneficiary;
        uint256 totalAmount;
        uint64 startTime;
        uint64 cliffDuration;
        uint64 vestingDuration;
        uint256 released;
        bool revocable;
        bool revoked;
    }

    /// @notice INF token distributed by vesting schedules.
    IERC20 public immutable token;

    /// @notice Stores all vesting schedules by their deterministic identifier.
    mapping(bytes32 => VestingSchedule) public schedules;

    /// @notice Stores schedule IDs created for each beneficiary.
    mapping(address => bytes32[]) public beneficiarySchedules;

    /// @notice Cumulative amount of tokens assigned into schedules.
    uint256 public totalVested;

    error ZeroAddress();
    error InvalidAmount();
    error InvalidDuration();
    error ScheduleExists();
    error ScheduleNotFound();
    error NothingToRelease();
    error NotRevocable();
    error AlreadyRevoked();
    error ScheduleIsRevocable();

    /// @notice Emitted when a new vesting schedule is created.
    /// @param scheduleId Unique identifier of the schedule.
    /// @param beneficiary Schedule beneficiary.
    /// @param amount Total vested token amount for the schedule.
    /// @param startTime Vesting start timestamp.
    /// @param cliffDuration Cliff duration in seconds.
    /// @param vestingDuration Total vesting duration in seconds.
    event ScheduleCreated(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount,
        uint64 startTime,
        uint64 cliffDuration,
        uint64 vestingDuration
    );

    /// @notice Emitted when vested tokens are released to a beneficiary.
    /// @param scheduleId Schedule identifier.
    /// @param beneficiary Recipient beneficiary.
    /// @param amount Amount transferred.
    event TokensReleased(bytes32 indexed scheduleId, address indexed beneficiary, uint256 amount);

    /// @notice Emitted when a schedule is revoked and unvested tokens are returned.
    /// @param scheduleId Schedule identifier.
    /// @param unvestedReturned Amount of unvested tokens returned to owner.
    event ScheduleRevoked(bytes32 indexed scheduleId, uint256 unvestedReturned);

    /// @notice Creates the vesting contract.
    /// @param _token INF token address used for vesting.
    /// @param initialOwner Owner address authorized to create and revoke schedules.
    constructor(address _token, address initialOwner) Ownable(initialOwner) {
        if (_token == address(0) || initialOwner == address(0)) revert ZeroAddress();
        token = IERC20(_token);
    }

    /// @notice Creates a new vesting schedule and transfers funding into this contract.
    /// @param beneficiary Recipient of vested tokens.
    /// @param amount Total token amount to vest.
    /// @param startTime Unix timestamp when vesting starts.
    /// @param cliffDuration Cliff period in seconds before any unlock.
    /// @param vestingDuration Total vesting duration in seconds from `startTime`.
    /// @param revocable Whether the owner can revoke unvested tokens.
    /// @return scheduleId Deterministic ID assigned to the new schedule.
    function createSchedule(
        address beneficiary,
        uint256 amount,
        uint64 startTime,
        uint64 cliffDuration,
        uint64 vestingDuration,
        bool revocable
    ) external onlyOwner returns (bytes32 scheduleId) {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (vestingDuration == 0 || cliffDuration > vestingDuration) revert InvalidDuration();

        scheduleId = keccak256(abi.encodePacked(beneficiary, startTime, vestingDuration, totalVested));
        if (schedules[scheduleId].beneficiary != address(0)) revert ScheduleExists();

        token.safeTransferFrom(msg.sender, address(this), amount);

        schedules[scheduleId] = VestingSchedule({
            beneficiary: beneficiary,
            totalAmount: amount,
            startTime: startTime,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            released: 0,
            revocable: revocable,
            revoked: false
        });

        beneficiarySchedules[beneficiary].push(scheduleId);
        totalVested += amount;

        emit ScheduleCreated(scheduleId, beneficiary, amount, startTime, cliffDuration, vestingDuration);
    }

    /// @notice Releases vested and unreleased tokens to the schedule beneficiary.
    /// @dev    Permissionless — anyone may trigger release; funds always go to beneficiary.
    ///         This prevents permanent lock-up when the beneficiary is a contract without
    ///         a dedicated release caller, or when a third party is paying gas on behalf.
    /// @param scheduleId Identifier of the vesting schedule.
    function release(bytes32 scheduleId) external {
        VestingSchedule storage schedule = schedules[scheduleId];
        if (schedule.beneficiary == address(0)) revert ScheduleNotFound();

        uint256 releasable = vestedAmount(scheduleId) - schedule.released;
        if (releasable == 0) revert NothingToRelease();

        schedule.released += releasable;
        token.safeTransfer(schedule.beneficiary, releasable);

        emit TokensReleased(scheduleId, schedule.beneficiary, releasable);
    }

    /// @notice Emergency rescue of fully-vested tokens for a non-revocable schedule
    ///         where the beneficiary key is provably lost (e.g. zero address, dead wallet).
    /// @dev    Only callable by owner. Requires schedule to be 100% vested AND fully elapsed
    ///         by at least RESCUE_DELAY seconds (730 days) after vesting end. Sends tokens
    ///         back to the owner, not to an arbitrary address.
    /// @param scheduleId Identifier of the vesting schedule.
    function rescueStuckTokens(bytes32 scheduleId) external onlyOwner {
        VestingSchedule storage schedule = schedules[scheduleId];
        if (schedule.beneficiary == address(0)) revert ScheduleNotFound();
        if (schedule.revocable) revert ScheduleIsRevocable(); // use revoke() for revocable schedules

        uint256 vestingEnd = uint256(schedule.startTime) + uint256(schedule.vestingDuration);
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= vestingEnd + 730 days, "TokenVesting: rescue delay not elapsed");

        uint256 stuck = schedule.totalAmount - schedule.released;
        if (stuck == 0) revert NothingToRelease();

        schedule.released = schedule.totalAmount;
        token.safeTransfer(owner(), stuck);

        emit TokensReleased(scheduleId, owner(), stuck);
    }

    /// @notice Revokes a revocable schedule and returns unvested tokens to the owner.
    /// @param scheduleId Identifier of the vesting schedule.
    function revoke(bytes32 scheduleId) external onlyOwner {
        VestingSchedule storage schedule = schedules[scheduleId];
        if (schedule.beneficiary == address(0)) revert ScheduleNotFound();
        if (!schedule.revocable) revert NotRevocable();
        if (schedule.revoked) revert AlreadyRevoked();

        uint256 vestedNow = _vestedAmountLinear(schedule);
        uint256 vestedUnreleased = vestedNow - schedule.released;
        if (vestedUnreleased > 0) {
            schedule.released = vestedNow;
            token.safeTransfer(schedule.beneficiary, vestedUnreleased);
            emit TokensReleased(scheduleId, schedule.beneficiary, vestedUnreleased);
        }

        uint256 unvested = schedule.totalAmount - vestedNow;
        schedule.revoked = true;

        if (unvested > 0) {
            token.safeTransfer(owner(), unvested);
        }

        emit ScheduleRevoked(scheduleId, unvested);
    }

    /// @notice Returns the vested amount for a schedule at the current timestamp.
    /// @dev If revoked, returns `released` so no additional vesting accrues.
    /// @param scheduleId Identifier of the vesting schedule.
    /// @return amount Current vested token amount.
    function vestedAmount(bytes32 scheduleId) public view returns (uint256 amount) {
        VestingSchedule storage schedule = schedules[scheduleId];
        if (schedule.beneficiary == address(0)) revert ScheduleNotFound();

        if (schedule.revoked) {
            return schedule.released;
        }

        return _vestedAmountLinear(schedule);
    }

    /// @notice Returns the releasable token amount for a schedule.
    /// @param scheduleId Identifier of the vesting schedule.
    /// @return amount Vested but unreleased token amount.
    function releasableAmount(bytes32 scheduleId) external view returns (uint256 amount) {
        VestingSchedule storage schedule = schedules[scheduleId];
        if (schedule.beneficiary == address(0)) revert ScheduleNotFound();

        return vestedAmount(scheduleId) - schedule.released;
    }

    /// @notice Returns the full vesting schedule for an ID.
    /// @param scheduleId Identifier of the vesting schedule.
    /// @return schedule Struct containing all schedule fields.
    function getSchedule(bytes32 scheduleId) external view returns (VestingSchedule memory schedule) {
        schedule = schedules[scheduleId];
        if (schedule.beneficiary == address(0)) revert ScheduleNotFound();
    }

    /// @notice Returns all schedule IDs associated with a beneficiary.
    /// @param beneficiary Beneficiary address.
    /// @return scheduleIds Array of schedule IDs.
    function getBeneficiarySchedules(address beneficiary) external view returns (bytes32[] memory scheduleIds) {
        return beneficiarySchedules[beneficiary];
    }

    /// @dev Computes non-revoked vesting progression using cliff + linear vesting.
    function _vestedAmountLinear(VestingSchedule storage schedule) internal view returns (uint256) {
        uint256 start = uint256(schedule.startTime);
        uint256 cliffEnd = start + uint256(schedule.cliffDuration);
        uint256 end = start + uint256(schedule.vestingDuration);

        if (block.timestamp < cliffEnd) {
            return 0;
        }

        if (block.timestamp >= end) {
            return schedule.totalAmount;
        }

        uint256 elapsed = block.timestamp - start;
        return (schedule.totalAmount * elapsed) / uint256(schedule.vestingDuration);
    }
}
