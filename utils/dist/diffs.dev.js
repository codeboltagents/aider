"use strict";

var diff = require('diff');

var fs = require('fs');

function main() {
  if (process.argv.length !== 4) {
    console.log("Usage: node diffs.js file1 file2");
    process.exit(1);
  }

  var file_orig = process.argv[2];
  var file_updated = process.argv[3];
  var lines_orig = fs.readFileSync(file_orig, 'utf-8').split('\n');
  var lines_updated = fs.readFileSync(file_updated, 'utf-8').split('\n');

  for (var i = 0; i < lines_updated.length; i++) {
    var res = diff_partial_update(lines_orig, lines_updated.slice(0, i));
    console.log(res);
    process.stdin.resume();
  }
}

function create_progress_bar(percentage) {
  var block = "█";
  var empty = "░";
  var total_blocks = 30;
  var filled_blocks = Math.floor(total_blocks * percentage / 100);
  var empty_blocks = total_blocks - filled_blocks;
  var bar = block.repeat(filled_blocks) + empty.repeat(empty_blocks);
  return bar;
}

function assert_newlines(lines) {
  if (!lines) {
    return;
  }

  for (var i = 0; i < lines.length - 1; i++) {
    var line = lines[i];

    if (!line || line[line.length - 1] !== "\n") {
      throw new Error(line);
    }
  }
}

function diff_partial_update(lines_orig, lines_updated) {
  var _final = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  var fname = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
  assert_newlines(lines_orig);
  assert_newlines(lines_orig);
  var num_orig_lines = lines_orig.length;
  var last_non_deleted;

  if (_final) {
    last_non_deleted = num_orig_lines;
  } else {
    last_non_deleted = find_last_non_deleted(lines_orig, lines_updated);
  }

  if (last_non_deleted === null) {
    return "";
  }

  var pct;

  if (num_orig_lines) {
    pct = last_non_deleted * 100 / num_orig_lines;
  } else {
    pct = 50;
  }

  var bar = create_progress_bar(pct);
  bar = " ".concat(last_non_deleted.toString().padStart(3, ' '), " / ").concat(num_orig_lines.toString().padStart(3, ' '), " lines [").concat(bar, "] ").concat(pct.toFixed(0), "%\n");
  lines_orig = lines_orig.slice(0, last_non_deleted);

  if (!_final) {
    lines_updated = lines_updated.slice(0, -1).concat([bar]);
  }

  var diffResult = diff.createPatch('', lines_orig.join('\n'), lines_updated.join('\n'), '', '', {
    context: 5
  });
  var diffLines = diffResult.split('\n').slice(2);
  var diffStr = diffLines.join('\n');

  if (!diffStr.endsWith("\n")) {
    diffStr += "\n";
  }

  var backticks;

  for (var i = 3; i < 10; i++) {
    backticks = "`".repeat(i);

    if (!diffStr.includes(backticks)) {
      break;
    }
  }

  var show = "".concat(backticks, "diff\n");

  if (fname) {
    show += "--- ".concat(fname, " original\n");
    show += "+++ ".concat(fname, " updated\n");
  }

  show += diffStr;
  show += "".concat(backticks, "\n\n");
  console.log(show);
  return show;
}

function find_last_non_deleted(lines_orig, lines_updated) {
  var diffResult = diff.diffLines(lines_orig.join('\n'), lines_updated.join('\n'));
  var num_orig = 0;
  var last_non_deleted_orig = null;

  for (var i = 0; i < diffResult.length; i++) {
    var part = diffResult[i];

    if (!part.added && !part.removed) {
      num_orig += part.count;
      last_non_deleted_orig = num_orig;
    } else if (part.removed) {
      num_orig += part.count;
    }
  }

  return last_non_deleted_orig;
} // if (require.main === module) {
//     main();
// }


module.exports = {
  create_progress_bar: create_progress_bar,
  assert_newlines: assert_newlines,
  diff_partial_update: diff_partial_update,
  find_last_non_deleted: find_last_non_deleted
};