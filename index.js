const codebolt = require("@codebolt/codeboltjs").default;
const path = require("path")
const {CodeExecute} = require("./agents/CodeExecute")
async function execute() {

    await codebolt.waitForConnection();
    var message = await codebolt.chat.waitforReply("Hi, I am AI Software Developer Agent,how can I assist you.");
    codebolt.chat.processStarted();
 
    const GetExecute = await CodeExecute(message.message);
    codebolt.chat.stopProcess();

    var message = await codebolt.chat.waitforReply(GetExecute);
    await execute();
}

(async () => {
	await execute();
})();
