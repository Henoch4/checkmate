// @openzeppelin/contracts/utils/StorageSlot.sol
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

pragma solidity ^0.8.20;

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}

// @openzeppelin/contracts/utils/ReentrancyGuard.sol
// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;


/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}

// Checkmate.sol
pragma solidity ^0.8.20;


contract Checkmate is ReentrancyGuard {
    struct Game {
        address white;
        address black;
        uint256 wager;
        uint256 moveCount;
        uint8 toMove;
        bool joined;
        bool finished;
        address winner;
        string lastFEN;
        uint256 createdAt;
        uint256 lastMoveAt;
    }

    Game[] public games;
    uint256 public activeGames;
    uint256 public totalWagered;

    event GameCreated(uint256 indexed gameId, address indexed white, address indexed black, uint256 wager);
    event GameJoined(uint256 indexed gameId, address indexed black);
    event MoveSubmitted(uint256 indexed gameId, address indexed by, uint256 moveIndex, string san, uint8 toMoveAfter);
    event GameFinished(uint256 indexed gameId, address indexed winner, uint256 wager, string reason);

    constructor() {}

    function createGame(address opponent, string calldata initialFEN) external payable {
        require(opponent != address(0) && opponent != msg.sender, "Bad opponent");
        Game storage g = games.push();
        g.white = msg.sender;
        g.black = opponent;
        g.wager = msg.value;
        g.toMove = 0;
        g.lastFEN = initialFEN;
        g.createdAt = block.timestamp;
        g.lastMoveAt = block.timestamp;
        activeGames += 1;
        totalWagered += msg.value;
        emit GameCreated(games.length - 1, msg.sender, opponent, msg.value);
    }

    function joinGame(uint256 gameId) external payable {
        Game storage g = games[gameId];
        require(!g.joined, "Already joined");
        require(msg.sender == g.black, "Not the opponent");
        require(msg.value == g.wager, "Wager mismatch");
        g.joined = true;
        emit GameJoined(gameId, msg.sender);
    }

    function submitMove(uint256 gameId, string calldata san, string calldata fenAfter, bool isMate) external nonReentrant {
        Game storage g = games[gameId];
        require(g.joined, "Not joined");
        require(!g.finished, "Finished");
        address expected = g.toMove == 0 ? g.white : g.black;
        require(msg.sender == expected, "Not your turn");

        g.lastFEN = fenAfter;
        g.moveCount += 1;
        g.toMove = g.toMove == 0 ? 1 : 0;
        g.lastMoveAt = block.timestamp;
        emit MoveSubmitted(gameId, msg.sender, g.moveCount, san, g.toMove);

        if (isMate) {
            g.finished = true;
            g.winner = msg.sender;
            activeGames -= 1;
            if (g.wager > 0) {
                (bool ok, ) = payable(msg.sender).call{value: g.wager * 2}("");
                require(ok, "Payout failed");
            }
            emit GameFinished(gameId, msg.sender, g.wager * 2, "checkmate");
        }
    }

    function cancelGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(!g.joined && !g.finished, "Joined or finished");
        require(msg.sender == g.white, "Creator only");
        g.finished = true;
        g.winner = msg.sender;
        activeGames -= 1;
        if (g.wager > 0) {
            (bool ok, ) = payable(msg.sender).call{value: g.wager}("");
            require(ok, "Refund failed");
        }
        emit GameFinished(gameId, msg.sender, 0, "cancelled");
    }

    function resign(uint256 gameId) external nonReentrant {
        Game storage g = games[gameId];
        require(g.joined, "Not joined");
        require(!g.finished, "Finished");
        require(msg.sender == g.white || msg.sender == g.black, "Not a player");
        g.finished = true;
        g.winner = msg.sender == g.white ? g.black : g.white;
        activeGames -= 1;
        if (g.wager > 0) {
            (bool ok, ) = payable(g.winner).call{value: g.wager * 2}("");
            require(ok, "Payout failed");
        }
        emit GameFinished(gameId, g.winner, g.wager * 2, "resign");
    }

    function claimTimeout(uint256 gameId) external nonReentrant {
        Game storage g = games[gameId];
        require(g.joined, "Not joined");
        require(!g.finished, "Finished");
        require(block.timestamp > g.lastMoveAt + 24 hours, "No timeout");
        address loser = g.toMove == 0 ? g.white : g.black;
        g.finished = true;
        g.winner = loser == g.white ? g.black : g.white;
        activeGames -= 1;
        if (g.wager > 0) {
            (bool ok, ) = payable(g.winner).call{value: g.wager * 2}("");
            require(ok, "Payout failed");
        }
        emit GameFinished(gameId, g.winner, g.wager * 2, "timeout");
    }

    function getGame(uint256 gameId)
        external
        view
        returns (address, address, uint256, uint256, uint8, bool, bool, address, string memory, uint256)
    {
        Game storage g = games[gameId];
        return (g.white, g.black, g.wager, g.moveCount, g.toMove, g.joined, g.finished, g.winner, g.lastFEN, g.lastMoveAt);
    }
}

