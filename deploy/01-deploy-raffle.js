const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat.config")
const { verify } = require("../utils/verify")
require("dotenv").config()
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30")
module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock
    const chainId = network.config.chainId
    if (chainId == 31337) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const res = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReciept = await res.wait(1)
        subscriptionId = transactionReciept.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]['subscriptionId']
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]['callbackGasLimit']
    const keepersUpdateInterval = networkConfig[chainId]['keepersUpdateInterval']
    const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, keepersUpdateInterval]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    if (chainId == 31337) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
    }

    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        console.log("Verifying....")
        await verify(raffle.address, args)
    }
    console.log("-------------------------------------------------------")

    //

}
module.exports.tags = ["all", "raffle"]