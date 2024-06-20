const codebolt = require('@codebolt/codeboltjs').default;
const {Coder} = require("./coders/base_coder");

const {EditBlockFencedCoder} = require("./coders/editblock_fenced_coder");
const {UnifiedDiffCoder} = require("./coders/udiff_coder");
const {WholeFileCoder} = require("./coders/wholefile_coder");
const {EditBlockCoder} = require("./coders/editblock_coder");

function create(main_model = null, edit_format = null, io = null, from_coder = null, kwargs = {}) {


    if (!main_model) {
        if (from_coder) {
            main_model = from_coder.main_model;
        } else {
            main_model = new models.Model(models.DEFAULT_MODEL_NAME);
        }
    }

    if (edit_format === null) {
        if (from_coder) {
            edit_format = from_coder.edit_format;
        } else {
            edit_format = main_model.edit_format;
        }
    }

    if (!io && from_coder) {
        io = from_coder.io;
    }

    if (from_coder) {
        let use_kwargs = {
            ...from_coder.original_kwargs
        }; // copy orig kwargs

        let done_messages = from_coder.done_messages;
        if (edit_format !== from_coder.edit_format && done_messages) {
            done_messages = from_coder.summarizer.summarize_all(done_messages);
        }

        // Bring along context from the old Coder
        let update = {
            fnames: from_coder.get_inchat_relative_files(),
            done_messages: done_messages,
            cur_messages: from_coder.cur_messages,
        };

        use_kwargs = {
            ...use_kwargs,
            ...update,
            ...kwargs
        }; // override to complete the switch and passed kwargs

        kwargs = use_kwargs;
    }

    let res;
    switch (edit_format) {
        case "diff":
            res = new EditBlockCoder(main_model, io, kwargs);
            break;
        case "diff-fenced":
            res = new EditBlockFencedCoder(main_model, io, kwargs);
            break;
        case "whole":
            res = new WholeFileCoder(main_model, io, kwargs);
            break;
        case "udiff":
            res = new UnifiedDiffCoder(main_model, io, kwargs);
            break;
        default:
            throw new Error(`Unknown edit format ${edit_format}`);
    }

    res.original_kwargs = {
        ...kwargs
    };

    return res;
}



async function execute() {
    await codebolt.waitForConnection();

    const args = {};

    const userChangerequest = await codebolt.chat.waitforReply("Please let me know what changes do you want to be done in the application?");

    const Coder = create();

}

(async () => {
    await execute();
})();