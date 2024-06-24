"use strict";

// COMMIT
var commit_system = "You are an expert software engineer.\nReview the provided context and diffs which are about to be committed to a git repo.\nGenerate a *SHORT* 1 line, 1 sentence commit message that describes the purpose of the changes.\nThe commit message MUST be in the past tense.\nIt must describe the changes *which have been made* in the diffs!\nReply with JUST the commit message, without quotes, comments, questions, etc!"; // COMMANDS

var undo_command_reply = "I did `git reset --hard HEAD~1` to discard the last edits. Please wait for further\ninstructions before attempting that change again. Feel free to ask relevant questions about\nwhy the changes were reverted.";
var added_files = "I added these files to the chat: {fnames}.\n\nIf you need to propose edits to other existing files not already added to the chat, you *MUST* tell the me their full path names and ask me to *add the files to the chat*. End your reply and wait for my approval. You can keep asking if you then decide you need to edit more files.";
var run_output = "I ran this command:\n\n{command}\n\nAnd got this output:\n\n{output}"; // CHAT HISTORY

var summarize = "*Briefly* summarize this partial conversation about programming.\nInclude less detail about older parts and more detail about the most recent messages.\nStart a new paragraph every time the topic changes!\n\nThis is only part of a longer conversation so *DO NOT* conclude the summary with language like \"Finally, ...\". Because the conversation continues after the summary.\nThe summary *MUST* include the function names, libraries, packages that are being discussed.\nThe summary *MUST* include the filenames that are being referenced by the assistant inside the ```...``` fenced code blocks!\nThe summaries *MUST NOT* include ```...``` fenced code blocks!\n\nPhrase the summary with the USER in first person, telling the ASSISTANT about the conversation.\nWrite *as* the user.\nThe user should refer to the assistant as *you*.\nStart the summary with \"I asked you...\".";
var summary_prefix = "I spoke to you previously about a number of things.\n";
module.exports = {
  commit_system: commit_system,
  undo_command_reply: undo_command_reply,
  summarize: summarize,
  added_files: added_files,
  run_output: run_output,
  summary_prefix: summary_prefix
};