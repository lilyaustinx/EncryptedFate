// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedFate
/// @notice Four-step encrypted path game where the correct route is 1,1,1,2 and scores remain private.
contract EncryptedFate is ZamaEthereumConfig {
    uint8 private constant PATH_LENGTH = 4;

    euint32 private _startingScore;
    euint32 private _completionBonus;
    euint32 private _encryptedZero;
    euint32 private _encryptedOne;
    euint32[PATH_LENGTH] private _encryptedPath;

    struct PlayerState {
        euint32 score;
        euint32[PATH_LENGTH] choices;
        euint32[PATH_LENGTH] correctnessFlags;
        euint32 outcomeFlag;
        uint8 submittedSteps;
        bool finished;
    }

    mapping(address => PlayerState) private _players;

    event GameStarted(address indexed player, euint32 encryptedScore);
    event PathSubmitted(address indexed player, uint8 stepIndex, euint32 encryptedChoice);
    event PathCompleted(address indexed player, euint32 encryptedScore, euint32 encryptedOutcome);
    event ScoreUpdated(address indexed player, euint32 encryptedScore);

    constructor() {
        _startingScore = FHE.asEuint32(1000);
        _completionBonus = FHE.asEuint32(1000);
        _encryptedZero = FHE.asEuint32(0);
        _encryptedOne = FHE.asEuint32(1);

        _encryptedPath[0] = FHE.asEuint32(1);
        _encryptedPath[1] = FHE.asEuint32(1);
        _encryptedPath[2] = FHE.asEuint32(1);
        _encryptedPath[3] = FHE.asEuint32(2);

        for (uint8 i = 0; i < PATH_LENGTH; i++) {
            FHE.allowThis(_encryptedPath[i]);
        }

        FHE.allowThis(_startingScore);
        FHE.allowThis(_completionBonus);
        FHE.allowThis(_encryptedZero);
        FHE.allowThis(_encryptedOne);
    }

    /// @notice Initializes or resets the game for the caller with 1000 encrypted points.
    function startGame() external {
        address player = msg.sender;
        PlayerState storage state = _players[player];

        state.score = _startingScore;
        state.outcomeFlag = _encryptedZero;
        state.submittedSteps = 0;
        state.finished = false;

        for (uint8 i = 0; i < PATH_LENGTH; i++) {
            state.choices[i] = _encryptedZero;
            state.correctnessFlags[i] = _encryptedZero;
        }

        _refreshAccess(state, player);

        emit GameStarted(player, state.score);
        emit ScoreUpdated(player, state.score);
    }

    /// @notice Records the encrypted choice for the current step. Steps must be submitted in order.
    /// @param stepIndex Index of the path step (0-3).
    /// @param encryptedChoice Encrypted choice for the step.
    /// @param inputProof Proof produced by the Relayer SDK for the encrypted choice.
    function submitPathChoice(
        uint8 stepIndex,
        externalEuint32 encryptedChoice,
        bytes calldata inputProof
    ) external {
        PlayerState storage state = _players[msg.sender];
        require(!state.finished, "Game already completed");
        require(stepIndex == state.submittedSteps, "Submit the next step");
        require(stepIndex < PATH_LENGTH, "Invalid step");

        euint32 choice = FHE.fromExternal(encryptedChoice, inputProof);
        state.choices[stepIndex] = choice;
        FHE.allowThis(choice);
        FHE.allow(choice, msg.sender);

        ebool isCorrect = FHE.eq(choice, _encryptedPath[stepIndex]);
        euint32 correctness = FHE.select(isCorrect, _encryptedOne, _encryptedZero);
        state.correctnessFlags[stepIndex] = correctness;
        FHE.allowThis(correctness);
        FHE.allow(correctness, msg.sender);

        state.submittedSteps += 1;

        if (state.submittedSteps == PATH_LENGTH) {
            state.finished = true;
            _finalizeOutcome(state, msg.sender);
        }

        emit PathSubmitted(msg.sender, stepIndex, choice);
    }

    /// @notice Returns the encrypted score for a player.
    /// @param player Address of the player to inspect.
    function getEncryptedScore(address player) external view returns (euint32) {
        return _players[player].score;
    }

    /// @notice Returns the encrypted choice for a given player and step.
    /// @param player Address of the player.
    /// @param stepIndex Step index to inspect.
    function getEncryptedChoice(address player, uint8 stepIndex) external view returns (euint32) {
        require(stepIndex < PATH_LENGTH, "Invalid step");
        return _players[player].choices[stepIndex];
    }

    /// @notice Returns the encrypted outcome flag (1 if the full path was correct, 0 otherwise).
    /// @param player Address of the player.
    function getEncryptedOutcome(address player) external view returns (euint32) {
        return _players[player].outcomeFlag;
    }

    /// @notice Returns the submission progress for a player.
    /// @param player Address of the player.
    /// @return submittedSteps Count of submitted steps.
    /// @return finished Whether the player has submitted all steps.
    function getProgress(address player) external view returns (uint8 submittedSteps, bool finished) {
        PlayerState storage state = _players[player];
        return (state.submittedSteps, state.finished);
    }

    /// @notice Returns the length of the path.
    function getPathLength() external pure returns (uint8) {
        return PATH_LENGTH;
    }

    function _finalizeOutcome(PlayerState storage state, address player) private {
        ebool firstTwo = FHE.and(
            FHE.eq(state.correctnessFlags[0], _encryptedOne),
            FHE.eq(state.correctnessFlags[1], _encryptedOne)
        );
        ebool lastTwo = FHE.and(
            FHE.eq(state.correctnessFlags[2], _encryptedOne),
            FHE.eq(state.correctnessFlags[3], _encryptedOne)
        );
        ebool pathCorrect = FHE.and(firstTwo, lastTwo);

        state.score = FHE.select(pathCorrect, FHE.add(state.score, _completionBonus), state.score);
        FHE.allowThis(state.score);
        FHE.allow(state.score, player);

        state.outcomeFlag = FHE.select(pathCorrect, _encryptedOne, _encryptedZero);
        FHE.allowThis(state.outcomeFlag);
        FHE.allow(state.outcomeFlag, player);

        emit ScoreUpdated(player, state.score);
        emit PathCompleted(player, state.score, state.outcomeFlag);
    }

    function _refreshAccess(PlayerState storage state, address player) private {
        FHE.allowThis(state.score);
        FHE.allow(state.score, player);
        FHE.allowThis(state.outcomeFlag);
        FHE.allow(state.outcomeFlag, player);

        for (uint8 i = 0; i < PATH_LENGTH; i++) {
            FHE.allowThis(state.choices[i]);
            FHE.allow(state.choices[i], player);
            FHE.allowThis(state.correctnessFlags[i]);
            FHE.allow(state.correctnessFlags[i], player);
        }
    }
}
