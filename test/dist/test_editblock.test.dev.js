"use strict";

var _require = require('chai'),
    expect = _require.expect;

var fs = require('fs');

var path = require('path');

var sinon = require('sinon');

var tmp = require('tmp');

var _require2 = require('./../utils/codeEdit'),
    codeEdit = _require2.codeEdit;

var replace_most_similar_chunk = codeEdit.replace_most_similar_chunk,
    strip_quoted_wrapping = codeEdit.strip_quoted_wrapping,
    find_original_update_blocks = codeEdit.find_original_update_blocks; // Adjust the import path as necessary
// describe('TestUtils', function() {
//     let GPT35;
//     // beforeEach(function() {
//     //     GPT35 = new Model("gpt-3.5-turbo");
//     // });

it('test_replace_most_similar_chunk', function () {
  var whole = "This is a sample text.\nAnother line of text.\nYet another line.\n";
  var part = "This is a sample text\n";
  var replace = "This is a replaced text.\n";
  var expectedOutput = "This is a replaced text.\nAnother line of text.\nYet another line.\n";
  var result = replace_most_similar_chunk(whole, part, replace); // console.log(result)

  expect(result).to.equal(expectedOutput);
});
it('test_replace_most_similar_chunk_not_perfect_match', function () {
  var whole = "This is a sample text.\nAnother line of text.\nYet another line.\n";
  var part = "This was a sample text.\nAnother line of txt\n";
  var replace = "This is a replaced text.\nModified line of text.\n";
  var expectedOutput = "This is a replaced text.\nModified line of text.\nYet another line.\n";
  var result = replace_most_similar_chunk(whole, part, replace); // console.log(result)

  expect(result).to.equal(expectedOutput);
});
it('test_strip_quoted_wrapping', function () {
  var inputText = "filename.ext\n```\nWe just want this content\nNot the filename and triple quotes\n```";
  var expectedOutput = "We just want this content\nNot the filename and triple quotes\n";
  var result = strip_quoted_wrapping(inputText, "filename.ext");
  expect(result).to.equal(expectedOutput);
});
it('test_strip_quoted_wrapping_no_filename', function () {
  var inputText = "```\nWe just want this content\nNot the triple quotes\n```";
  var expectedOutput = "We just want this content\nNot the triple quotes\n";
  var result = strip_quoted_wrapping(inputText);
  expect(result).to.equal(expectedOutput);
});
it('test_strip_quoted_wrapping_no_wrapping', function () {
  var inputText = "We just want this content\nNot the triple quotes\n";
  var expectedOutput = "We just want this content\nNot the triple quotes\n";
  var result = strip_quoted_wrapping(inputText);
  expect(result).to.equal(expectedOutput);
});
it('test_find_original_update_blocks', function () {
  var edit = "\nHere's the change:\n\n```text\nfoo.txt\n<<<<<<< SEARCH\nTwo\n=======\nTooooo\n>>>>>>> REPLACE\n```\n\nHope you like it!\n        ";
  var edits = Array.from(find_original_update_blocks(edit)); // console.log(edits)

  expect(edits).to.deep.equal([["foo.txt", "Two\n", "Tooooo\n"]]);
});
it('find_original_update_blocks_mangled_filename_w_source_tag', function () {
  var source = 'source';
  var edit = "\nHere's the change:\n\n<".concat(source, ">foo.txt\n<<<<<<< SEARCH\nOne\n=======\nTwo\n>>>>>>> REPLACE\n</").concat(source, ">\n\nHope you like it!\n");
  var fence = ["<".concat(source, ">"), "</".concat(source, ">")];
  expect(function () {
    var edits = Array.from(find_original_update_blocks(edit, fence));
  }).to["throw"](Error, "missing filename");
}); // it('test_find_original_update_blocks_quote_below_filename', function() {
//     let edit = `
//     Here's the change:
//     foo.txt
//     \`\`\`text
//     Two
//     Tooooo
//     \`\`\`
//     Hope you like it!
//     `;
//     const edits = Array.from(find_original_update_blocks(edit));
//     expect(edits).to.deep.equal([["foo.txt", "Two\n", "Tooooo\n"]]);
// });

it('test_find_original_update_blocks_unclosed', function () {
  var edit = "\nHere's the change:\n\n```text\nfoo.txt\n<<<<<<< SEARCH\nTwo\n=======\nTooooo\n\n\noops!\n        ";
  expect(function () {
    return Array.from(find_original_update_blocks(edit));
  }).to["throw"]('Incomplete');
});
it('test_find_original_update_blocks_missing_filename', function () {
  var edit = "\nHere's the change:\n\n```text\n<<<<<<< SEARCH\nTwo\n=======\nTooooo\n\n\noops!\n        ";
  expect(function () {
    return Array.from(find_original_update_blocks(edit));
  }).to["throw"]('filename');
});
it('test_find_original_update_blocks_no_final_newline', function () {
  var edit = "\naider/coder.py\n<<<<<<< SEARCH\n            self.console.print(\"[red]^C again to quit\")\n=======\n            self.io.tool_error(\"^C again to quit\")\n>>>>>>> REPLACE\n\naider/coder.py\n<<<<<<< SEARCH\n            self.io.tool_error(\"Malformed ORIGINAL/UPDATE blocks, retrying...\")\n            self.io.tool_error(err)\n=======\n            self.io.tool_error(\"Malformed ORIGINAL/UPDATE blocks, retrying...\")\n            self.io.tool_error(str(err))\n>>>>>>> REPLACE\n\naider/coder.py\n<<<<<<< SEARCH\n            self.console.print(\"[red]Unable to get commit message from gpt-3.5-turbo. Use /commit to try again.\n\")\n=======\n            self.io.tool_error(\"Unable to get commit message from gpt-3.5-turbo. Use /commit to try again.\")\n>>>>>>> REPLACE\n\naider/coder.py\n<<<<<<< SEARCH\n            self.console.print(\"[red]Skipped commmit.\")\n=======\n            self.io.tool_error(\"Skipped commmit.\")\n>>>>>>> REPLACE"; // Should not raise a ValueError

  Array.from(find_original_update_blocks(edit));
});
it('test_incomplete_edit_block_missing_filename', function () {
  var edit = "\nNo problem! Here are the changes to patch `subprocess.check_output` instead of `subprocess.run` in both tests:\n\n```python\ntests/test_repomap.py\n<<<<<<< SEARCH\n    def test_check_for_ctags_failure(self):\n        with patch(\"subprocess.run\") as mock_run:\n            mock_run.side_effect = Exception(\"ctags not found\")\n=======\n    def test_check_for_ctags_failure(self):\n        with patch(\"subprocess.check_output\") as mock_check_output:\n            mock_check_output.side_effect = Exception(\"ctags not found\")\n>>>>>>> REPLACE\n\n<<<<<<< SEARCH\n    def test_check_for_ctags_success(self):\n        with patch(\"subprocess.run\") as mock_run:\n            mock_run.return_value = CompletedProcess(args=[\"ctags\", \"--version\"], returncode=0, stdout='''{\n  \"_type\": \"tag\",\n  \"name\": \"status\",\n  \"path\": \"aider/main.py\",\n  \"pattern\": \"/^    status = main()$/\",\n  \"kind\": \"variable\"\n}''')\n=======\n    def test_check_for_ctags_success(self):\n        with patch(\"subprocess.check_output\") as mock_check_output:\n            mock_check_output.return_value = '''{\n  \"_type\": \"tag\",\n  \"name\": \"status\",\n  \"path\": \"aider/main.py\",\n  \"pattern\": \"/^    status = main()$/\",\n  \"kind\": \"variable\"\n}'''\n>>>>>>> REPLACE\n```\n\nThese changes replace the `subprocess.run` patches with `subprocess.check_output` patches in both `test_check_for_ctags_failure` and `test_check_for_ctags_success` tests.\n        ";
  var editBlocks = Array.from(find_original_update_blocks(edit));
  expect(editBlocks.length).to.equal(2); // expect(editBlocks[0][0]).to.equal("tests/test_repomap.py");
  // expect(editBlocks[1][0]).to.equal("tests/test_repomap.py");
});
it('test_replace_part_with_missing_varied_leading_whitespace', function () {
  var whole = "\n    line1\n    line2\n        line3\n    line4\n";
  var part = "line2\n    line3\n";
  var replace = "new_line2\n    new_line3\n";
  var expected_output = "\n    line1\n    new_line2\n        new_line3\n    line4\n"; // Note: JavaScript doesn't have a built-in function similar to Python's replace_most_similar_chunk.
  // You would need to implement this functionality yourself or use a library that provides this functionality.

  var result = replace_most_similar_chunk(whole, part, replace);
  expect(result).to.equal(expected_output);
});
it('test_replace_part_with_missing_leading_whitespace', function () {
  var whole = "    line1\n    line2\n    line3\n";
  var part = "line1\nline2\n";
  var replace = "new_line1\nnew_line2\n";
  var expectedOutput = "    new_line1\n    new_line2\n    line3\n";
  var result = replace_most_similar_chunk(whole, part, replace);
  console.log(result);
  expect(result).to.equal(expectedOutput);
});
it('test_replace_part_with_just_some_missing_leading_whitespace', function () {
  var whole = "    line1\n    line2\n    line3\n";
  var part = " line1\n line2\n";
  var replace = " new_line1\n     new_line2\n";
  var expectedOutput = "    new_line1\n        new_line2\n    line3\n";
  var result = replace_most_similar_chunk(whole, part, replace);
  expect(result).to.equal(expectedOutput);
});
it('test_replace_part_with_missing_leading_whitespace_including_blank_line', function () {
  var whole = "    line1\n    line2\n    line3\n";
  var part = "\n  line1\n  line2\n";
  var replace = "  new_line1\n  new_line2\n";
  var expectedOutput = "    new_line1\n    new_line2\n    line3\n";
  var result = replace_most_similar_chunk(whole, part, replace);
  expect(result).to.equal(expectedOutput);
}); //     it('test_full_edit', function(done) {
//         temp.open('tempfile', function(err, info) {
//             if (err) throw err;
//             fs.write(info.fd, 'one\ntwo\nthree\n', () => {
//                 fs.close(info.fd, () => {
//                     const file1 = info.path;
//                     const files = [file1];
//                     const coder = Coder.create(GPT35, 'diff', { io: new InputOutput(), fnames: files });
//                     const mockSend = function() {
//                         coder.partial_response_content = `
// Do this:
// ${path.basename(file1)}
// <<<<<<< SEARCH
// two
// =======
// new
// >>>>>>> REPLACE
//                         `;
//                         coder.partial_response_function_call = {};
//                         return [];
//                     };
//                     coder.send = mockSend;
//                     coder.run('hi').then(() => {
//                         const content = fs.readFileSync(file1, 'utf-8');
//                         expect(content).to.equal('one\nnew\nthree\n');
//                         temp.cleanupSync();
//                         done();
//                     });
//                 });
//             });
//         });
//     });
//     it('test_full_edit_dry_run', function(done) {
//         temp.open('tempfile', function(err, info) {
//             if (err) throw err;
//             const origContent = 'one\ntwo\nthree\n';
//             fs.write(info.fd, origContent, () => {
//                 fs.close(info.fd, () => {
//                     const file1 = info.path;
//                     const files = [file1];
//                     const coder = Coder.create(GPT35, 'diff', {
//                         io: new InputOutput({ dry_run: true }),
//                         fnames: files,
//                         dry_run: true
//                     });
//                     const mockSend = function() {
//                         coder.partial_response_content = `
// Do this:
// ${path.basename(file1)}
// <<<<<<< SEARCH
// two
// =======
// new
// >>>>>>> REPLACE
//                         `;
//                         coder.partial_response_function_call = {};
//                         return [];
//                     };
//                     coder.send = mockSend;
//                     coder.run('hi').then(() => {
//                         const content = fs.readFileSync(file1, 'utf-8');
//                         expect(content).to.equal(origContent);
//                         temp.cleanupSync();
//                         done();
//                     });
//                 });
//             });
//         });
//     });

it('test_find_original_update_blocks_multiple_same_file', function () {
  var edit = "\nHere's the change:\n\n```text\nfoo.txt\n<<<<<<< SEARCH\none\n=======\ntwo\n>>>>>>> REPLACE\n\n...\n\n<<<<<<< SEARCH\nthree\n=======\nfour\n>>>>>>> REPLACE\n```\n\nHope you like it!\n        ";
  var edits = Array.from(find_original_update_blocks(edit));
  expect(edits).to.deep.equal([["foo.txt", "one\n", "two\n"], ["foo.txt", "three\n", "four\n"]]);
});