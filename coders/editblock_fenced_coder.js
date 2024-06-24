
const EditBlockCoder = require('./editblock_coder');
const EditBlockFencedPrompts = require('./editblock_fenced_prompts');

class EditBlockFencedCoder extends EditBlockCoder {
    constructor(...args) {
        super(...args);
        this.edit_format = "diff-fenced";
        this.gpt_prompts = new EditBlockFencedPrompts();
    }
}

module.exports=EditBlockFencedCoder

