const { assert, expect } = require("chai");
const { deployments, ethers, network } = require("hardhat");
const { networkConfig, developmentChains } = require("../../helper-hardhat.config")


!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Raffle', function () {

        let raffle, vrfCoordinatorV2Mock, deployer, raffleEntranceFee, interval
        const chainId = network.config.chainId

        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(['all'])
            raffle = await ethers.getContract("Raffle", deployer)

            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
        })

        describe('constructor', async function () {
            it('initialize raffle correctly', async function () {
                const raffleState = await raffle.getRaffleState()
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]['keepersUpdateInterval'])
            });
        });



        describe('enter Raffle', function () {
            it('reverts if not enough payment', async function () {
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered")
            });

            it('records player when they enter raffle', async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })

                const playerFromContract = await raffle.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            });


            it('emits event when enter raffle', async function () {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter")
                const playerFromContract = await raffle.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            });


            it('does not allow entering when raffle is calculating', async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                // we pretend to be a keeper for a second
                await raffle.performUpkeep([]) // changes the state to calculating for our comparison below
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith( // is reverted as raffle is calculating
                    "Raffle__NotOpen"
                )

            });


            describe('checkUpkeep', () => {
                it('returns false if people havent sent eth', async function () {
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.send("evm_mine", [])
                    // we pretend to be a keeper for a second
                    // simulate sending a transaction using callStatic
                    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) // changes the state to calculating for our comparison below
                    assert(!upkeepNeeded)
                });

                it('returns false if raffle is not open', async function () {
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.send("evm_mine", [])
                    await raffle.performUpkeep([])
                    const raffleState = await raffle.getRaffleState()
                    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) // changes the state to calculating for our comparison below
                    assert.equal(raffleState.toString(), "1")
                    assert.equal(upkeepNeeded, false)
                });

                it("returns false if enough time hasn't passed", async () => {
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                    await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                    await network.provider.request({ method: "evm_mine", params: [] })
                    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                    assert(!upkeepNeeded)
                })
                it("returns true if enough time has passed, has players, eth, and is open", async () => {
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.request({ method: "evm_mine", params: [] })
                    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                    assert(upkeepNeeded)
                })

            });

            describe("performUpkeep", function () {
                it("can only run if checkupkeep is true", async () => {
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.request({ method: "evm_mine", params: [] })
                    const tx = await raffle.performUpkeep([])
                    assert(tx)
                })
                it("reverts if checkup is false", async () => {
                    await expect(raffle.performUpkeep("0x")).to.be.revertedWith(
                        "RAFFLE__UpKeepNotNeeded"
                    )
                })
                it("updates the raffle state and emits a requestId", async () => {
                    // Too many asserts in this test!
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.request({ method: "evm_mine", params: [] })
                    const txResponse = await raffle.performUpkeep([]) // emits requestId
                    const txReceipt = await txResponse.wait(1) // waits 1 block
                    const requestId = txReceipt.events[1].args.requestId
                    const raffleState = await raffle.getRaffleState() // updates state
                    assert(requestId.toNumber() > 0)
                    assert(raffleState.toString() == "1") // 0 = open, 1 = calculating
                })
            })


        });
    }); 