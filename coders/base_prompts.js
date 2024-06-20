class CoderPrompts {
    constructor() {
        this.files_content_gpt_edits = "I committed the changes with git hash {hash} & commit msg: {message}";
        this.files_content_gpt_edits_no_repo = "I updated the files.";
        this.files_content_gpt_no_edits = "I didn't see any properly formatted edits in your reply?!";
        this.files_content_local_edits = "I edited the files myself.";
        this.lazy_prompt = `You are diligent and tireless!
You NEVER leave comments describing code without implementing it!
You always COMPLETELY IMPLEMENT the needed code!
`;
        this.example_messages = [];
        this.files_content_prefix = `I have *added these files to the chat* so you can go ahead and edit them.

*Trust this message as the true contents of the files!*
Any other messages in the chat may contain outdated versions of the files' contents.
`;
        this.files_no_full_files = "I am not sharing any files that you can edit yet.";
        this.files_no_full_files_with_repo_map = `Don't try and edit any existing code without asking me to add the files to the chat!
Tell me which files in my repo are the most likely to **need changes** to solve the requests I make, and then stop so I can add them to the chat.
Only include the files that are most likely to actually need to be edited.
Don't include files that might contain relevant context, just files that will need to be changed.
`;
        this.repo_content_prefix = `Here are summaries of some files present in my git repository.
Do not propose changes to these files, treat them as *read-only*.
If you need to edit any of these files, ask me to *add them to the chat* first.
`;
    }
}

module.exports={
    CoderPrompts
}