const codebolt = require('@codebolt/codeboltjs').default;

async function execute() {
    await codebolt.waitForConnection();

    const args= {};

    const userChangerequest = await codebolt.chat.waitforReply("Please let me know what changes do you want to be done in the application?");

    //Ideally this userChangerequest should be a json. So if it has 


}

(async () => { await execute(); })();