// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
