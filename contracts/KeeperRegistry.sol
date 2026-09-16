// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title infinite.fun Keeper Registry
/// @notice Stores launch metadata, coin wiring, and graduation state.
contract KeeperRegistry {
    struct CoinInfo {
        address creator;
        string market;
        uint64 leverage;
        address feeDest;
        bool burnMode;
        uint256 launchedAt;
        bool graduated;
    }

    address public keeper;
    address public treasury;
    address public factory;

    mapping(address => address) public coinToSubWallet;
    mapping(address => address) public coinToCurve;
    mapping(address => CoinInfo) private _coinInfo;
    address[] private _coins;

    error NotKeeper();
    error NotFactory();
    error UnauthorizedGraduationMarker();
    error AlreadyRegistered();
    error ZeroAddress();

    event CoinRegistered(address indexed coin, address indexed creator, string market);
    event CoinGraduated(address indexed coin);

    /// @notice Initializes registry roles.
    /// @param _keeper Keeper role address.
    /// @param _treasury Treasury recipient.
    constructor(address _keeper, address _treasury) {
        if (_keeper == address(0) || _treasury == address(0)) revert ZeroAddress();
        keeper = _keeper;
        treasury = _treasury;
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    /// @notice Sets the trusted factory address.
    /// @param _factory Factory authorized to register coins.
    function setFactory(address _factory) external onlyKeeper {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
    }

    /// @notice Registers a newly launched coin and metadata.
    /// @param coin Coin token address.
    /// @param subWallet Coin SubWallet address.
    /// @param curve BondingCurve address.
    /// @param creator Launch creator address.
    /// @param market Market label for perp routing.
    /// @param leverage Chosen leverage.
    /// @param feeDest Destination for fee split destination slice.
    /// @param burnMode Whether destination slice should be buyback+burn.
    function registerCoin(
        address coin,
        address subWallet,
        address curve,
        address creator,
        string calldata market,
        uint64 leverage,
        address feeDest,
        bool burnMode
    ) external onlyFactory {
        if (coin == address(0) || subWallet == address(0) || curve == address(0) || creator == address(0) || feeDest == address(0)) {
            revert ZeroAddress();
        }
        if (coinToSubWallet[coin] != address(0)) revert AlreadyRegistered();

        coinToSubWallet[coin] = subWallet;
        coinToCurve[coin] = curve;
        _coinInfo[coin] = CoinInfo({
            creator: creator,
            market: market,
            leverage: leverage,
            feeDest: feeDest,
            burnMode: burnMode,
            launchedAt: block.timestamp,
            graduated: false
        });
        _coins.push(coin);

        emit CoinRegistered(coin, creator, market);
    }

    /// @notice Returns the SubWallet linked to a coin.
    /// @param coin Coin token address.
    /// @return subWallet SubWallet address.
    function getCoinSubWallet(address coin) external view returns (address subWallet) {
        subWallet = coinToSubWallet[coin];
    }

    /// @notice Returns the BondingCurve linked to a coin.
    /// @param coin Coin token address.
    /// @return curve BondingCurve address.
    function getCoinCurve(address coin) external view returns (address curve) {
        curve = coinToCurve[coin];
    }

    /// @notice Returns metadata for a coin.
    /// @param coin Coin token address.
    /// @return creator Coin creator.
    /// @return market Market label.
    /// @return leverage Configured leverage.
    /// @return feeDest Fee destination.
    /// @return burnMode Burn-mode flag.
    /// @return launchedAt Launch timestamp.
    /// @return graduated Graduation state.
    function getCoinInfo(address coin)
        external
        view
        returns (
            address creator,
            string memory market,
            uint64 leverage,
            address feeDest,
            bool burnMode,
            uint256 launchedAt,
            bool graduated
        )
    {
        CoinInfo storage info = _coinInfo[coin];
        return (info.creator, info.market, info.leverage, info.feeDest, info.burnMode, info.launchedAt, info.graduated);
    }

    /// @notice Marks a coin as graduated.
    /// @param coin Coin token address.
    function markGraduated(address coin) external {
        address subWallet = coinToSubWallet[coin];
        if (msg.sender != factory && msg.sender != subWallet) revert UnauthorizedGraduationMarker();

        CoinInfo storage info = _coinInfo[coin];
        if (!info.graduated) {
            info.graduated = true;
            emit CoinGraduated(coin);
        }
    }

    /// @notice Returns all registered coin addresses.
    /// @return coins Array of coin addresses.
    function getCoins() external view returns (address[] memory coins) {
        coins = _coins;
    }

    /// @notice Returns number of registered coins.
    /// @return count Number of launched coins.
    function coinCount() external view returns (uint256 count) {
        count = _coins.length;
    }
}
