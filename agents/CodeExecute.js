const codebolt = require("@codebolt/codeboltjs").default

const {readFileSync} = require("fs")
const {compile} = require("handlebars")
const path = require("path")

const os = require("os")
const  CodeExecute = async (message) => {

    let templatePath = `${__dirname}/prompt.handlebars`;
    const PROMPT = readFileSync(templatePath, "utf-8").trim();
    let template = compile(PROMPT);

    let renderedTemplate = template({message:message})

    let llmresponse = await codebolt.llm.inference(renderedTemplate);
    const response =  llmresponse.message.trim().replace(/```/g, '');
   
    return response

}

module.exports  =  {
    CodeExecute
}