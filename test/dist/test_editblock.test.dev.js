// const {
//     expect
// } = require('chai');
// const fs = require('fs');
// const path = require('path');
// const sinon = require('sinon');
// const tmp = require('tmp');
// const {
//     codeEdit
// } = require('./../utils/codeEdit');
// const {
//     replace_most_similar_chunk,
//     strip_quoted_wrapping,
//     find_original_update_blocks
// } = codeEdit // Adjust the import path as necessary
// // describe('TestUtils', function() {
// //     let GPT35;
// //     // beforeEach(function() {
// //     //     GPT35 = new Model("gpt-3.5-turbo");
// //     // });
// it('test_replace_most_similar_chunk', function () {
//     const whole = "This is a sample text.\nAnother line of text.\nYet another line.\n";
//     const part = "This is a sample text\n";
//     const replace = "This is a replaced text.\n";
//     const expectedOutput = "This is a replaced text.\nAnother line of text.\nYet another line.\n";
//     const result = replace_most_similar_chunk(whole, part, replace);
//     // console.log(result)
//     expect(result).to.equal(expectedOutput);
// });
// it('test_replace_most_similar_chunk_not_perfect_match', function () {
//     const whole = "This is a sample text.\nAnother line of text.\nYet another line.\n";
//     const part = "This was a sample text.\nAnother line of txt\n";
//     const replace = "This is a replaced text.\nModified line of text.\n";
//     const expectedOutput = "This is a replaced text.\nModified line of text.\nYet another line.\n";
//     const result = replace_most_similar_chunk(whole, part, replace);
//     // console.log(result)
//     expect(result).to.equal(expectedOutput);
// });
// it('test_strip_quoted_wrapping', function () {
//     const inputText = "filename.ext\n```\nWe just want this content\nNot the filename and triple quotes\n```";
//     const expectedOutput = "We just want this content\nNot the filename and triple quotes\n";
//     const result = strip_quoted_wrapping(inputText, "filename.ext");
//     expect(result).to.equal(expectedOutput);
// });
// it('test_strip_quoted_wrapping_no_filename', function () {
//     const inputText = "```\nWe just want this content\nNot the triple quotes\n```";
//     const expectedOutput = "We just want this content\nNot the triple quotes\n";
//     const result = strip_quoted_wrapping(inputText);
//     expect(result).to.equal(expectedOutput);
// });
// it('test_strip_quoted_wrapping_no_wrapping', function () {
//     const inputText = "We just want this content\nNot the triple quotes\n";
//     const expectedOutput = "We just want this content\nNot the triple quotes\n";
//     const result = strip_quoted_wrapping(inputText);
//     expect(result).to.equal(expectedOutput);
// });
// it('test_find_original_update_blocks', function () {
//     const edit = `
// Here's the change:
// \`\`\`text
// foo.txt
// <<<<<<< SEARCH
// Two
// =======
// Tooooo
// >>>>>>> REPLACE
// \`\`\`
// Hope you like it!
//         `;
//     const edits = Array.from(find_original_update_blocks(edit));
//     // console.log(edits)
//     expect(edits).to.deep.equal([
//         ["foo.txt", "Two\n", "Tooooo\n"]
//     ]);
// });
// it('find_original_update_blocks_mangled_filename_w_source_tag', () => {
//     const source = 'source';
// const edit = `
// Here's the change:
// <${source}>foo.txt
// <<<<<<< SEARCH
// One
// =======
// Two
// >>>>>>> REPLACE
// </${source}>
// Hope you like it!
// `;
// const fence = [`<${source}>`, `</${source}>`];
// expect(() => {
//     const edits = Array.from(find_original_update_blocks(edit, fence));
// }).to.throw(Error, "missing filename");
// });
// // it('test_find_original_update_blocks_quote_below_filename', function() {
// //     let edit = `
// //     Here's the change:
// //     foo.txt
// //     \`\`\`text
// //     Two
// //     Tooooo
// //     \`\`\`
// //     Hope you like it!
// //     `;
// //     const edits = Array.from(find_original_update_blocks(edit));
// //     expect(edits).to.deep.equal([["foo.txt", "Two\n", "Tooooo\n"]]);
// // });
// it('test_find_original_update_blocks_unclosed', function () {
//     const edit = `
// Here's the change:
// \`\`\`text
// foo.txt
// <<<<<<< SEARCH
// Two
// =======
// Tooooo
// oops!
//         `;
//     expect(() => Array.from(find_original_update_blocks(edit))).to.throw('Incomplete');
// });
// it('test_find_original_update_blocks_missing_filename', function () {
//     const edit = `
// Here's the change:
// \`\`\`text
// <<<<<<< SEARCH
// Two
// =======
// Tooooo
// oops!
//         `;
//     expect(() => Array.from(find_original_update_blocks(edit))).to.throw('filename');
// });
// it('test_find_original_update_blocks_no_final_newline', function () {
//     const edit = `
// aider/coder.py
// <<<<<<< SEARCH
//             self.console.print("[red]^C again to quit")
// =======
//             self.io.tool_error("^C again to quit")
// >>>>>>> REPLACE
// aider/coder.py
// <<<<<<< SEARCH
//             self.io.tool_error("Malformed ORIGINAL/UPDATE blocks, retrying...")
//             self.io.tool_error(err)
// =======
//             self.io.tool_error("Malformed ORIGINAL/UPDATE blocks, retrying...")
//             self.io.tool_error(str(err))
// >>>>>>> REPLACE
// aider/coder.py
// <<<<<<< SEARCH
//             self.console.print("[red]Unable to get commit message from gpt-3.5-turbo. Use /commit to try again.\n")
// =======
//             self.io.tool_error("Unable to get commit message from gpt-3.5-turbo. Use /commit to try again.")
// >>>>>>> REPLACE
// aider/coder.py
// <<<<<<< SEARCH
//             self.console.print("[red]Skipped commmit.")
// =======
//             self.io.tool_error("Skipped commmit.")
// >>>>>>> REPLACE`;
//     // Should not raise a ValueError
//     Array.from(find_original_update_blocks(edit));
// });
// it('test_incomplete_edit_block_missing_filename', function () {
//     const edit = `
// No problem! Here are the changes to patch \`subprocess.check_output\` instead of \`subprocess.run\` in both tests:
// \`\`\`python
// tests/test_repomap.py
// <<<<<<< SEARCH
//     def test_check_for_ctags_failure(self):
//         with patch("subprocess.run") as mock_run:
//             mock_run.side_effect = Exception("ctags not found")
// =======
//     def test_check_for_ctags_failure(self):
//         with patch("subprocess.check_output") as mock_check_output:
//             mock_check_output.side_effect = Exception("ctags not found")
// >>>>>>> REPLACE
// <<<<<<< SEARCH
//     def test_check_for_ctags_success(self):
//         with patch("subprocess.run") as mock_run:
//             mock_run.return_value = CompletedProcess(args=["ctags", "--version"], returncode=0, stdout='''{
//   "_type": "tag",
//   "name": "status",
//   "path": "aider/main.py",
//   "pattern": "/^    status = main()$/",
//   "kind": "variable"
// }''')
// =======
//     def test_check_for_ctags_success(self):
//         with patch("subprocess.check_output") as mock_check_output:
//             mock_check_output.return_value = '''{
//   "_type": "tag",
//   "name": "status",
//   "path": "aider/main.py",
//   "pattern": "/^    status = main()$/",
//   "kind": "variable"
// }'''
// >>>>>>> REPLACE
// \`\`\`
// These changes replace the \`subprocess.run\` patches with \`subprocess.check_output\` patches in both \`test_check_for_ctags_failure\` and \`test_check_for_ctags_success\` tests.
//         `;
//     const editBlocks = Array.from(find_original_update_blocks(edit));
//     expect(editBlocks.length).to.equal(2);
//     // expect(editBlocks[0][0]).to.equal("tests/test_repomap.py");
//     // expect(editBlocks[1][0]).to.equal("tests/test_repomap.py");
// });
// it('test_replace_part_with_missing_varied_leading_whitespace', function () {
//     let whole = `
//     line1
//     line2
//         line3
//     line4
// `;
// let part = "line2\n    line3\n";
// let replace = "new_line2\n    new_line3\n";
// let expected_output = `
//     line1
//     new_line2
//         new_line3
//     line4
// `;
// // Note: JavaScript doesn't have a built-in function similar to Python's replace_most_similar_chunk.
// // You would need to implement this functionality yourself or use a library that provides this functionality.
//     const result = replace_most_similar_chunk(whole, part, replace);
//     expect(result).to.equal(expected_output);
// });
// it('test_replace_part_with_missing_leading_whitespace', function () {
//     const whole = "    line1\n    line2\n    line3\n";
//     const part = "line1\nline2\n";
//     const replace = "new_line1\nnew_line2\n";
//     const expectedOutput = "    new_line1\n    new_line2\n    line3\n";
//     const result = replace_most_similar_chunk(whole, part, replace);
//     console.log(result);
//     expect(result).to.equal(expectedOutput);
// });
// it('test_replace_part_with_just_some_missing_leading_whitespace', function () {
//     const whole = "    line1\n    line2\n    line3\n";
//     const part = " line1\n line2\n";
//     const replace = " new_line1\n     new_line2\n";
//     const expectedOutput = "    new_line1\n        new_line2\n    line3\n";
//     const result = replace_most_similar_chunk(whole, part, replace);
//     expect(result).to.equal(expectedOutput);
// });
// it('test_replace_part_with_missing_leading_whitespace_including_blank_line', function () {
//     const whole = "    line1\n    line2\n    line3\n";
//     const part = "\n  line1\n  line2\n";
//     const replace = "  new_line1\n  new_line2\n";
//     const expectedOutput = "    new_line1\n    new_line2\n    line3\n";
//     const result = replace_most_similar_chunk(whole, part, replace);
//     expect(result).to.equal(expectedOutput);
// });
// //     it('test_full_edit', function(done) {
// //         temp.open('tempfile', function(err, info) {
// //             if (err) throw err;
// //             fs.write(info.fd, 'one\ntwo\nthree\n', () => {
// //                 fs.close(info.fd, () => {
// //                     const file1 = info.path;
// //                     const files = [file1];
// //                     const coder = Coder.create(GPT35, 'diff', { io: new InputOutput(), fnames: files });
// //                     const mockSend = function() {
// //                         coder.partial_response_content = `
// // Do this:
// // ${path.basename(file1)}
// // <<<<<<< SEARCH
// // two
// // =======
// // new
// // >>>>>>> REPLACE
// //                         `;
// //                         coder.partial_response_function_call = {};
// //                         return [];
// //                     };
// //                     coder.send = mockSend;
// //                     coder.run('hi').then(() => {
// //                         const content = fs.readFileSync(file1, 'utf-8');
// //                         expect(content).to.equal('one\nnew\nthree\n');
// //                         temp.cleanupSync();
// //                         done();
// //                     });
// //                 });
// //             });
// //         });
// //     });
// //     it('test_full_edit_dry_run', function(done) {
// //         temp.open('tempfile', function(err, info) {
// //             if (err) throw err;
// //             const origContent = 'one\ntwo\nthree\n';
// //             fs.write(info.fd, origContent, () => {
// //                 fs.close(info.fd, () => {
// //                     const file1 = info.path;
// //                     const files = [file1];
// //                     const coder = Coder.create(GPT35, 'diff', {
// //                         io: new InputOutput({ dry_run: true }),
// //                         fnames: files,
// //                         dry_run: true
// //                     });
// //                     const mockSend = function() {
// //                         coder.partial_response_content = `
// // Do this:
// // ${path.basename(file1)}
// // <<<<<<< SEARCH
// // two
// // =======
// // new
// // >>>>>>> REPLACE
// //                         `;
// //                         coder.partial_response_function_call = {};
// //                         return [];
// //                     };
// //                     coder.send = mockSend;
// //                     coder.run('hi').then(() => {
// //                         const content = fs.readFileSync(file1, 'utf-8');
// //                         expect(content).to.equal(origContent);
// //                         temp.cleanupSync();
// //                         done();
// //                     });
// //                 });
// //             });
// //         });
// //     });
// it('test_find_original_update_blocks_multiple_same_file', function () {
//     const edit = `
// Here's the change:
// \`\`\`text
// foo.txt
// <<<<<<< SEARCH
// one
// =======
// two
// >>>>>>> REPLACE
// ...
// <<<<<<< SEARCH
// three
// =======
// four
// >>>>>>> REPLACE
// \`\`\`
// Hope you like it!
//         `;
//     const edits = Array.from(find_original_update_blocks(edit));
//     expect(edits).to.deep.equal([
//         ["foo.txt", "one\n", "two\n"],
//         ["foo.txt", "three\n", "four\n"]
//     ]);
// });
"use strict";