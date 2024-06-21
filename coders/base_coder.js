const codebolt = require('@codebolt/codeboltjs').default;
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"];
const fs = require('fs');
const path = require('path');
class Coder {
    constructor(fnames) {
        // this.cur_messages = []
        // this.chat_completion_call_hashes = []
        // this.chat_completion_response_hashes = []
        // this.need_commit_before_edits = new Set()
        // this.done_messages = []
        // this.verbose = undefined
        // this.abs_fnames = new Set()


        if (!fnames) {
            fnames = [];
        }

        // if (!io) {
        //     io = new InputOutput();
        // }

        this.chat_completion_call_hashes = [];
        this.chat_completion_response_hashes = [];
        this.need_commit_before_edits = new Set();

        this.verbose = undefined;
        this.abs_fnames = new Set();

        // if (cur_messages) {
        //     this.cur_messages = cur_messages;
        // } else {
        //     this.cur_messages = [];
        // }
        this.cur_messages = [];
        // if (done_messages) {
        //     this.done_messages = done_messages;
        // } else {
        //     this.done_messages = [];
        // }
        this.done_messages = [];
        // this.io = io;
        // this.stream = stream;

        // if (!auto_commits) {
        //     dirty_commits = false;
        // }

        this.auto_commits = false;
        this.dirty_commits = false;
        // this.assistant_output_color = assistant_output_color;
        // this.code_theme = code_theme;

        // this.dry_run = dry_run;
        // this.pretty = pretty;

        // if (pretty) {
        //     this.console = new Console();
        // } else {
        //     this.console = new Console({force_terminal: false, no_color: true});
        // }

        // this.main_model = main_model;

        // this.show_diffs = show_diffs;

        // this.commands = new Commands(this.io, this, voice_language);

        // if (use_git) {
        //     try {
        //         this.repo = new GitRepo(
        //             this.io,
        //             fnames,
        //             git_dname,
        //             aider_ignore_file,
        //             {models: main_model.commit_message_models()},
        //         );
        //         this.root = this.repo.root;
        //     } catch (error) {
        //         if (error instanceof FileNotFoundError) {
        //             this.repo = null;
        //         } else {
        //             throw error;
        //         }
        //     }
        // }

        for (let fname of fnames) {


            if (!fs.existsSync(fname)) {
                this.io.tool_output(`Creating empty file ${fname}`);
                fs.mkdirSync(path.dirname(fname), {
                    recursive: true
                });
                fs.closeSync(fs.openSync(fname, 'w'));
            }

            if (!fs.lstatSync(fname).isFile()) {
                throw new ValueError(`${fname} is not a file`);
            }

            fname = path.resolve(fname);

            if (this.repo && this.repo.ignored_file(fname)) {
                this.io.tool_error(`Skipping ${fname} that matches aiderignore spec.`);
                continue;
            }

            this.abs_fnames.add(fname);
            this.check_added_files();
        }

        // if (!this.repo) {
        //     this.find_common_root();
        // }
        let main_model = undefined
        if (main_model && main_model.use_repo_map && this.repo && this.gpt_prompts.repo_content_prefix) {
            this.repo_map = new RepoMap(
                map_tokens,
                this.root,
                this.main_model,
                io,
                this.gpt_prompts.repo_content_prefix,
                this.verbose,
                this.main_model.info.get("max_input_tokens"),
            );
        }

        // if (max_chat_history_tokens === null) {
        //     max_chat_history_tokens = this.main_model.max_chat_history_tokens;
        // }
        // this.summarizer = new ChatSummary(
        //     this.main_model.weak_model,
        //     max_chat_history_tokens,
        // );

        this.summarizer_thread = null;
        this.summarized_done_messages = [];

        // if (!this.done_messages && restore_chat_history) {
        //     let history_md = this.io.read_text(this.io.chat_history_file);
        //     if (history_md) {
        //         this.done_messages = utils.split_chat_history_markdown(history_md);
        //         this.summarize_start();
        //     }
        // }

        // Linting and testing
        // this.linter = new Linter({root: this.root, encoding: io.encoding});
        // this.auto_lint = auto_lint;
        // this.setup_lint_cmds(lint_cmds);

        // this.auto_test = auto_test;
        // this.test_cmd = test_cmd;

        // validate the functions jsonschema
        // if (this.functions) {
        //     for (let func of this.functions) {
        //         Draft7Validator.check_schema(func);
        //     }

        //     if (this.verbose) {
        //         this.io.tool_output("JSON Schema:");
        //         this.io.tool_output(JSON.stringify(this.functions, null, 4));
        //     }
        // }
    }
    wrapFence = (name) => {
        return [`<${name}>`, `</${name}>`];
    }

    fences = [
        ["``" + "`", "``" + "`"],
        this.wrapFence("source"),
        this.wrapFence("code"),
        this.wrapFence("pre"),
        this.wrapFence("codeblock"),
        this.wrapFence("sourcecode"),
    ];
    fence = this.fences[0];

    check_added_files() {
        //TODO:check it later
        return
        if (this.warning_given) {
            return;
        }

        const warn_number_of_files = 4;
        const warn_number_of_tokens = 20 * 1024;

        const num_files = this.abs_fnames.length;
        if (num_files < warn_number_of_files) {
            return;
        }

        let tokens = 0;
        for (let fname of this.abs_fnames) {
            const relative_fname = this.get_rel_fname(fname);
            if (is_image_file(relative_fname)) {
                continue;
            }
            const content = this.io.read_text(fname);
            tokens += this.main_model.token_count(content);
        }

        if (tokens < warn_number_of_tokens) {
            return;
        }

        // this.io.tool_error("Warning: it's best to only add files that need changes to the chat.");
        // this.io.tool_error(urls.edit_errors);
        this.warning_given = true;
    }
    init_before_message() {
        this.reflected_message = null;
        this.num_reflections = 0;
        this.lint_outcome = null;
        this.test_outcome = null;
        this.edit_outcome = null;
    }
    render_incremental_response(final) {
        return this.partial_response_content;
    }
    show_send_output(completion) {
        // if (this.verbose) {
        //     console.log(completion);
        // }

        // if (!completion.choices) {
        //     this.io.tool_error(String(completion));
        //     return;
        // }

        let show_func_err = null;
        let show_content_err = null;
        // try {
        //     this.partial_response_function_call = completion.choices[0].message.function_call;
        // } catch (func_err) {
        //     show_func_err = func_err;
        // }

        try {
            this.partial_response_content = completion //completion.choices[0].message.content;
        } catch (content_err) {
            show_content_err = content_err;
        }

        // let resp_hash = {
        //     function_call: this.partial_response_function_call,
        //     content: this.partial_response_content,
        // };
        // resp_hash = crypto.createHash('sha1').update(JSON.stringify(resp_hash, null, 2)).digest('hex');
        // this.chat_completion_response_hashes.push(resp_hash);

        if (show_func_err && show_content_err) {
            // this.io.tool_error(show_func_err);
            // this.io.tool_error(show_content_err);
            throw new Error("No data found in openai response!");
        }

        let tokens = null;
        // if (completion.hasOwnProperty('usage') && completion.usage !== null) {
        //     let prompt_tokens = completion.usage.prompt_tokens;
        //     let completion_tokens = completion.usage.completion_tokens;

        //     tokens = `${prompt_tokens} prompt tokens, ${completion_tokens} completion tokens`;
        //     if (this.main_model.info.hasOwnProperty('input_cost_per_token')) {
        //         let cost = prompt_tokens * this.main_model.info['input_cost_per_token'];
        //         if (this.main_model.info.hasOwnProperty('output_cost_per_token')) {
        //             cost += completion_tokens * this.main_model.info['output_cost_per_token'];
        //         }
        //         tokens += `, $${cost.toFixed(6)} cost`;
        //         this.total_cost += cost;
        //     }
        // }

        let show_resp = this.render_incremental_response(true);
        // if (this.show_pretty()) {
        //     show_resp = new Markdown(show_resp, {style: this.assistant_output_color, code_theme: this.code_theme});
        // } else {
        //     show_resp = new Text(show_resp || "<no response>");
        // }
        show_resp = show_resp || "<no response>";
        // console.log(show_resp)

        // this.io.console.print(show_resp);

        // if (tokens !== null) {
        //     this.io.tool_output(tokens);
        // }
    }
    async run_loop() {
        return
        let inp = await this.io.get_input(
            this.root,
            this.get_inchat_relative_files(),
            this.get_addable_relative_files(),
            this.commands,
        );

        if (!inp) {
            return;
        }

        if (this.commands.is_command(inp)) {
            return this.commands.run(inp);
        }

        this.check_for_file_mentions(inp);
        inp = this.check_for_urls(inp);

        return inp;
    }
    async run(with_message = null) {
        //  while (true) {
        this.init_before_message();

        try {
            let new_user_message;
            if (with_message) {
                new_user_message = with_message;
                // this.io.user_input(with_message);
            } else {
                new_user_message = await this.run_loop();
            }

            if (new_user_message) {
                this.reflected_message = null;
                await this.send_new_user_message(new_user_message);

                new_user_message = null;
                if (this.reflected_message) {
                    if (this.num_reflections < this.max_reflections) {
                        this.num_reflections += 1;
                        new_user_message = this.reflected_message;
                    } else {
                        // this.io.tool_error(`Only ${this.max_reflections} reflections allowed, stopping.`);
                    }
                }

                if (with_message) {
                    return this.partial_response_content;
                }
            }
        } catch (error) {
            console.log(error)
            //  if (error instanceof Error) {
            //      this.keyboard_interrupt();
            //  } else if (error instanceof EOFError) {
            //      return;
            //  } else {
            //      throw error;
            //  }
        }
        //  }
    }
    async send(messages, model = null, functions = null) {


        this.partial_response_content = "";
        this.partial_response_function_call = {};

        let interrupted = false;
        try {

            // console.log(messages)
            let {
                message
            } = await codebolt.llm.inference(messages);
            //    console.log(message);
            //  const [hash_object, completion] = await send_with_retries(
            //      model, messages, functions, this.stream, this.temperature
            //  );
            //  this.chat_completion_call_hashes.push(hash_object.hexdigest());

            //  if (this.stream) {
            //      for await (const output of this.show_send_output_stream(completion)) {
            //          yield output;
            //      }
            //  } else {
            //      this.show_send_output(completion);
            //  }
            this.show_send_output(message);

        } catch (error) {
            console.log(error)
            if (error instanceof KeyboardInterrupt) {
                this.keyboard_interrupt();
                interrupted = true;
            }
        }

        if (this.partial_response_content) {
            codebolt.chat.sendMessage(this.partial_response_content);
            //  this.io.ai_output(this.partial_response_content);
        } else if (this.partial_response_function_call) {
            // TODO: push this into subclasses
            //  const args = this.parse_partial_args();
            //  if (args) {
            //      this.io.ai_output(JSON.stringify(args, null, 4));
            //  }
        }

        if (interrupted) {
            throw new KeyboardInterrupt();
        }
    }
    async send_new_user_message(inp) {
        this.aider_edited_files = null;

        this.cur_messages.push({
            role: "user",
            content: inp
        });

        let messages = await this.format_messages();

        if (this.verbose) {
            utils.show_messages(messages, this.functions);
        }

        let exhausted = false;
        let interrupted = false;
        try {
            await this.send(messages, this.functions);
        } catch (err) {
            console.log(err);
            if (err instanceof KeyboardInterrupt) {
                interrupted = true;
            } else if (err instanceof ExhaustedContextWindow) {
                exhausted = true;
            } else if (err instanceof litellm.exceptions.BadRequestError) {
                this.io.tool_error(`BadRequestError: ${err}`);
                return;
            } else if (err instanceof openai.BadRequestError) {
                if (err.toString().includes("maximum context length")) {
                    exhausted = true;
                } else {
                    throw err;
                }
            }

            if (exhausted) {
                this.num_exhausted_context_windows += 1;
                this.io.tool_error("The chat session is larger than the context window!\n");
                this.commands.cmd_tokens("");
                this.io.tool_error("\nTo reduce token usage:");
                this.io.tool_error(" - Use /drop to remove unneeded files from the chat session.");
                this.io.tool_error(" - Use /clear to clear chat history.");
                return;
            }

            let content = "";
            if (this.partial_response_function_call) {
                let args = this.parse_partial_args();
                if (args) {
                    content = args["explanation"];
                }
            } else if (this.partial_response_content) {
                content = this.partial_response_content;
            }

            this.io.tool_output();

            if (interrupted) {
                content += "\n^C KeyboardInterrupt";
                this.cur_messages.push({
                    role: "assistant",
                    content: content
                });
                return;
            }

            let edited = await this.apply_updates();
            if (this.reflected_message) {
                this.edit_outcome = false;
                this.update_cur_messages(new Set());
                return;
            }
            if (edited) {
                this.edit_outcome = true;

                if (edited && this.auto_lint) {
                    let lint_errors = this.lint_edited(edited);
                    this.lint_outcome = !lint_errors;
                    if (lint_errors) {
                        let ok = this.io.confirm_ask("Attempt to fix lint errors?");
                        if (ok) {
                            this.reflected_message = lint_errors;
                            this.update_cur_messages(new Set());
                            return;
                        }
                    }
                }

                if (edited && this.auto_test) {
                    let test_errors = this.commands.cmd_test(this.test_cmd);
                    this.test_outcome = !test_errors;
                    if (test_errors) {
                        let ok = this.io.confirm_ask("Attempt to fix test errors?");
                        if (ok) {
                            this.reflected_message = test_errors;
                            this.update_cur_messages(new Set());
                            return;
                        }
                    }
                }

                this.update_cur_messages(edited);
            }
        }
    }
    async get_abs_fnames_content() {
        let contents = [];
        for (let i = 0; i < this.abs_fnames.size; i++) {
            let fname = Array.from(this.abs_fnames)[i];
            let content = await codebolt.fs.readFile(fname)

            if (content === null) {
                let relative_fname = this.get_rel_fname(fname);
                this.io.tool_error(`Dropping ${relative_fname} from the chat.`);
                this.abs_fnames.delete(fname);
                i--; // adjust index after removal
            } else {
                contents.push({
                    fname,
                    content
                });
            }
        }
        return contents;
    }
    async choose_fence() {
        let all_content = "";
        let contents = await this.get_abs_fnames_content();
        for (let {
                content
            } of contents) {
            all_content += content + "\n";
        }

        let good = false;
        let fence_open, fence_close;
        for (let fence of this.fences) {
            [fence_open, fence_close] = fence;
            if (all_content.includes(fence_open) || all_content.includes(fence_close)) {
                continue;
            }
            good = true;
            break;
        }

        if (good) {
            this.fence = [fence_open, fence_close];
        } else {
            this.fence = this.fences[0];
            console.error(
                `Unable to find a fencing strategy! Falling back to: ${this.fence[0]}...${this.fence[1]}`
            );
        }
    }
    fmt_system_prompt(prompt) {
        let lazy_prompt = "" //this.main_model.lazy ? this.gpt_prompts.lazy_prompt : "";

        prompt = prompt.replace("{fence}", this.fence).replace("{lazy_prompt}", lazy_prompt);
        return prompt;
    }
    summarize_end() {
        if (this.summarizer_thread === null || this.summarizer_thread == undefined) {
            return;
        }

        this.summarizer_thread.join();
        this.summarizer_thread = null;

        this.done_messages = this.summarized_done_messages;
        this.summarized_done_messages = [];
    }
    is_image_file(file_name) {
        /**
         * Check if the given file name has an image file extension.
         *
         * @param {string} file_name - The name of the file to check.
         * @return {boolean} - True if the file is an image, False otherwise.
         */
        file_name = String(file_name); // Convert file_name to string
        return IMAGE_EXTENSIONS.some(ext => file_name.endsWith(ext));
    }
    get_rel_fname(fname) {
        return path.relative(fname, this.root);
    }
    async get_files_content(fnames = null) {
        if (!fnames) {
            fnames = this.abs_fnames;
        }

        let prompt = "";
        let absFnamesContent = await this.get_abs_fnames_content();
        for (let {fname, content} of absFnamesContent) {
            if (!this.is_image_file(fname)) {
                let relative_fname = this.get_rel_fname(fname);
                prompt += "\n";
                prompt += relative_fname;
                prompt += "\n" + this.fence[0] + "\n";

                prompt += content;

                // let lines = content.splitlines(true);
                // lines = lines.map((line, i) => `${i+1:03}:${line}`);
                // prompt += lines.join("");

                prompt += this.fence[1] + "\n";
            }
        }
        return prompt;
    }

    get_repo_map() {
        if (!this.repo_map) {
            return;
        }

        let cur_msg_text = this.get_cur_message_text();
        let mentioned_fnames = this.get_file_mentions(cur_msg_text);
        let mentioned_idents = this.get_ident_mentions(cur_msg_text);

        let other_files = new Set([...this.get_all_abs_files()].filter(x => !this.abs_fnames.has(x)));
        let repo_content = this.repo_map.get_repo_map(
            this.abs_fnames,
            other_files,
            mentioned_fnames,
            mentioned_idents,
        );

        // fall back to global repo map if files in chat are disjoint from rest of repo
        if (!repo_content) {
            repo_content = this.repo_map.get_repo_map(
                new Set(),
                new Set(this.get_all_abs_files()),
                mentioned_fnames,
                mentioned_idents,
            );
        }

        // fall back to completely unhinted repo
        if (!repo_content) {
            repo_content = this.repo_map.get_repo_map(
                new Set(),
                new Set(this.get_all_abs_files()),
            );
        }

        return repo_content;
    }
    get_images_message() {
        return null
        if (!this.main_model.accepts_images) {
            return null;
        }

        let image_messages = [];
        for (let [fname, content] of this.get_abs_fnames_content()) {
            if (is_image_file(fname)) {
                let image_url = `data:image/${Path(fname).suffix.slice(1)};base64,${content}`;
                image_messages.push({
                    "type": "image_url",
                    "image_url": {
                        "url": image_url,
                        "detail": "high"
                    }
                });
            }
        }

        if (!image_messages.length) {
            return null;
        }

        return {
            "role": "user",
            "content": image_messages
        };
    }
    async get_files_messages() {
        let files_messages = [];

        let repo_content = this.get_repo_map();
        if (repo_content) {
            files_messages.push({
                role: "user",
                content: repo_content
            }, {
                role: "assistant",
                content: "Ok, I won't try and edit those files without asking first.",
            });
        }

        let files_content, files_reply;
        if (this.abs_fnames) {
            files_content = this.gpt_prompts.files_content_prefix;
            files_content += await this.get_files_content();
            files_reply = "Ok, any changes I propose will be to those files.";
        } else if (repo_content) {
            files_content = this.gpt_prompts.files_no_full_files_with_repo_map;
            files_reply = "Ok, based on your requests I will suggest which files need to be edited and then stop and wait for your approval.";
        } else {
            files_content = this.gpt_prompts.files_no_full_files;
            files_reply = "Ok.";
        }

        files_messages.push({
            role: "user",
            content: files_content
        }, {
            role: "assistant",
            content: files_reply
        });

        let images_message = this.get_images_message();
        if (images_message !== null) {
            files_messages.push(
                images_message, {
                    role: "assistant",
                    content: "Ok."
                }
            );
        }

        return files_messages;
    }

    async format_messages() {
       await this.choose_fence();
        //  console.log(this.gpt_prompts)
        let main_sys = this.fmt_system_prompt(this.gpt_prompts.main_system);

        let example_messages = [];
        if (this.main_model?.examples_as_sys_msg) {
            main_sys += "\n# Example conversations:\n\n";
            for (let msg of this.gpt_prompts.example_messages) {
                let role = msg["role"];
                let content = this.fmt_system_prompt(msg["content"]);
                main_sys += `## ${role.toUpperCase()}: ${content}\n\n`;
            }
            main_sys = main_sys.trim();
        } else {
            for (let msg of this.gpt_prompts.example_messages) {
                example_messages.push({
                    role: msg["role"],
                    content: this.fmt_system_prompt(msg["content"]),
                });
            }
            if (this.gpt_prompts.example_messages.length > 0) {
                example_messages.push({
                    role: "user",
                    content: "I switched to a new code base. Please don't consider the above files or try to edit them any longer.",
                });
                example_messages.push({
                    role: "assistant",
                    content: "Ok.",
                });
            }
        }

        main_sys += "\n" + this.fmt_system_prompt(this.gpt_prompts.system_reminder);
        let messages = [{
                role: "system",
                content: main_sys
            },
            ...example_messages
        ];

        this.summarize_end();
        messages = messages.concat(this.done_messages);
        messages = messages.concat(await this.get_files_messages());

        let reminder_message = [{
            role: "system",
            content: this.fmt_system_prompt(this.gpt_prompts.system_reminder)
        }, ];

        // TODO review impact of token count on image messages
        // let messages_tokens = this.main_model.token_count(messages);
        // let reminder_tokens = this.main_model.token_count(reminder_message);
        // let cur_tokens = this.main_model.token_count(this.cur_messages);

        // let total_tokens = 0;
        // if (messages_tokens !== null && reminder_tokens !== null && cur_tokens !== null) {
        //     total_tokens = messages_tokens + reminder_tokens + cur_tokens;
        // }

        messages = messages.concat(this.cur_messages);

        let final = messages[messages.length - 1];

        //TODO:we can move this logic to main server

        // let max_input_tokens = this.main_model.info.get("max_input_tokens");
        // // Add the reminder prompt if we still have room to include it.
        // if (max_input_tokens === null || total_tokens < max_input_tokens) {
        //     if (this.main_model.reminder_as_sys_msg) {
        //         messages = messages.concat(reminder_message);
        //     } else if (final["role"] === "user") {
        //         // stuff it into the user message
        //         let new_content = final["content"] + "\n\n" + this.fmt_system_prompt(this.gpt_prompts.system_reminder);
        //         messages[messages.length - 1] = { role: final["role"], content: new_content };
        //     }
        // }

        return messages;
    }


}

module.exports = {
    Coder
}