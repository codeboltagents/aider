const codebolt = require('@codebolt/codeboltjs').default; 
 
 class Coder {
     constructor() {
         this.cur_messages = []
         this.chat_completion_call_hashes = []
         this.chat_completion_response_hashes = []
         this.need_commit_before_edits = new Set()
         this.done_messages = []
         this.verbose = undefined
         this.abs_fnames = new Set()

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
     init_before_message() {
         this.reflected_message = null;
         this.num_reflections = 0;
         this.lint_outcome = null;
         this.test_outcome = null;
         this.edit_outcome = null;
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

            console.log(messages)
           let {message}= await codebolt.llm.inference(messages);
           console.log(message);
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
         } catch (error) {
            console.log(error)
             if (error instanceof KeyboardInterrupt) {
                 this.keyboard_interrupt();
                 interrupted = true;
             }
         }

         if (this.partial_response_content) {
             this.io.ai_output(this.partial_response_content);
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

             let messages = this.format_messages();

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
         * get_abs_fnames_content() {
             for (let i = 0; i < this.abs_fnames.length; i++) {
                 let fname = this.abs_fnames[i];
                 let content = this.io.readText(fname);

                 if (content === null) {
                     let relative_fname = this.get_rel_fname(fname);
                     this.io.tool_error(`Dropping ${relative_fname} from the chat.`);
                     this.abs_fnames.splice(i, 1);
                     i--; // adjust index after removal
                 } else {
                     yield {
                         fname,
                         content
                     };
                 }
             }
         }
     choose_fence() {
         let all_content = "";
         for (let [_fname, content] of this.get_abs_fnames_content()) {
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
         console.log(this.summarizer_thread)
         this.summarizer_thread.join();
         this.summarizer_thread = null;

         this.done_messages = this.summarized_done_messages;
         this.summarized_done_messages = [];
     }
     format_messages() {
         this.choose_fence();
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
         //  messages = messages.concat(this.get_files_messages());

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

         // let final = messages[messages.length - 1];

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