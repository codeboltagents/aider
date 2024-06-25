const diff = require('diff');
const fs = require('fs');

function main() {
    if (process.argv.length !== 4) {
        console.log("Usage: node diffs.js file1 file2");
        process.exit(1);
    }

    let file_orig = process.argv[2];
    let file_updated = process.argv[3];

    let lines_orig = fs.readFileSync(file_orig, 'utf-8').split('\n');
    let lines_updated = fs.readFileSync(file_updated, 'utf-8').split('\n');

    for (let i = 0; i < lines_updated.length; i++) {
        let res = diff_partial_update(lines_orig, lines_updated.slice(0, i));
        console.log(res);
        process.stdin.resume();
    }
}

function create_progress_bar(percentage) {
    let block = "█";
    let empty = "░";
    let total_blocks = 30;
    let filled_blocks = Math.floor(total_blocks * percentage / 100);
    let empty_blocks = total_blocks - filled_blocks;
    let bar = block.repeat(filled_blocks) + empty.repeat(empty_blocks);
    return bar;
}

function assert_newlines(lines) {
    if (!lines) {
        return;
    }
    for (let i = 0; i < lines.length - 1; i++) {
        let line = lines[i];
        if (!line || line[line.length - 1] !== "\n") {
            throw new Error(line);
        }
    }
}

function diff_partial_update(lines_orig, lines_updated, final = false, fname = null) {
    assert_newlines(lines_orig);
    assert_newlines(lines_orig);

    let num_orig_lines = lines_orig.length;

    let last_non_deleted;
    if (final) {
        last_non_deleted = num_orig_lines;
    } else {
        last_non_deleted = find_last_non_deleted(lines_orig, lines_updated);
    }

    if (last_non_deleted === null) {
        return "";
    }

    let pct;
    if (num_orig_lines) {
        pct = last_non_deleted * 100 / num_orig_lines;
    } else {
        pct = 50;
    }
    let bar = create_progress_bar(pct);
    bar = ` ${last_non_deleted.toString().padStart(3, ' ')} / ${num_orig_lines.toString().padStart(3, ' ')} lines [${bar}] ${pct.toFixed(0)}%\n`;

    lines_orig = lines_orig.slice(0, last_non_deleted);

    if (!final) {
        lines_updated = lines_updated.slice(0, -1).concat([bar]);
    }

    let diffResult = diff.createPatch('', lines_orig.join('\n'), lines_updated.join('\n'), '', '', {
        context: 5
    });
    let diffLines = diffResult.split('\n').slice(2);

    let diffStr = diffLines.join('\n');
    if (!diffStr.endsWith("\n")) {
        diffStr += "\n";
    }

    let backticks;
    for (let i = 3; i < 10; i++) {
        backticks = "`".repeat(i);
        if (!diffStr.includes(backticks)) {
            break;
        }
    }

    let show = `${backticks}diff\n`;
    if (fname) {
        show += `--- ${fname} original\n`;
        show += `+++ ${fname} updated\n`;
    }

    show += diffStr;
    show += `${backticks}\n\n`;
    console.log(show);
    return show;
}

function find_last_non_deleted(lines_orig, lines_updated) {
    let diffResult = diff.diffLines(lines_orig.join('\n'), lines_updated.join('\n'));

    let num_orig = 0;
    let last_non_deleted_orig = null;

    for (let i = 0; i < diffResult.length; i++) {
        let part = diffResult[i];
        if (!part.added && !part.removed) {
            num_orig += part.count;
            last_non_deleted_orig = num_orig;
        } else if (part.removed) {
            num_orig += part.count;
        }
    }

    return last_non_deleted_orig;
}

// if (require.main === module) {
//     main();
// }

module.exports = {
    create_progress_bar,
    assert_newlines,
    diff_partial_update,
    find_last_non_deleted
}