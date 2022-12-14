//auto verification works on hardhat-etherscan
const { run } = require("hardhat")

const verify = async function verify(contractAddress, args) {
    console.log("Verifying Contract.....")
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
    } catch (error) {
        if (error.message.toLowerCase().includes("already verified")) {
            console.log(error)
        }
    }


}
module.exports = { verify }