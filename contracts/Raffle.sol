//Raffle

// Endter lottery

// pick a random winner

// Select winner every N minutes

//Chainlink oracle
// randomness
// automated execution

// event storedNumber(
//     address indexed n1,
//     address sender
// );
// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

//Errors
error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailled();
error Raffle__NotOpen();
error RAFFLE__UpKeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

//Raffle Contract
contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    //Raffle State
    enum RaffleState {
        OPEN,
        CALCULATING
    }
    // State Variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    // vrfCoordinator decl
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;

    // Randomness coordinator variables
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1; //random numbers to generate
    address private s_recentWinner; //stores the recent winner todo: make a leader board for a day
    RaffleState private s_raffleState; //toggle the raffle state
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval; //time interval

    //Event declr
    event RaffleEnter(address indexed player);
    event RequestRaffleWinner(uint256 indexed requiestId);
    event WinnerPicked(address recentWinner);

    constructor(
        address vrfCoordinatorV2, //External contract
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        //Test min cond then revert if error
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        //Events
        // Using RaffleEnter Event
        emit RaffleEnter(msg.sender);
    }

    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = (block.timestamp - s_lastTimeStamp) > i_interval;
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upkeepNeeded, "0x00");
    }

    // chainlink and chainlink VRF for randomness
    //Two step calls
    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert RAFFLE__UpKeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestRaffleWinner(requestId);
        //request the rand num
        //use it
        //2 transaction process to prevent bruteforce
    }

    function fulfillRandomWords(
        uint256,
        uint256[] memory randomWords
    ) internal override {
        //s_players array amd random no  is 202 ;202 % 10 using modulo
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailled();
        }

        emit WinnerPicked(recentWinner);
    }

    // View pure functions
    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getPlayer(uint256 ind) public view returns (address) {
        return s_players[ind];
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getPlayersNum() public view returns (uint256) {
        return s_players.length;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    //getters for constants are always pure
}
