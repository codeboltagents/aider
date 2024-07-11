#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const { diff_match_patch } = require('diff-match-patch');
const yargs = require('yargs');


const os = require('os');


class RelativeIndenter {
    constructor(texts) {
        let chars = new Set();
        texts.forEach(text => {
            [...text].forEach(char => chars.add(char));
        });

        const ARROW = '←';
        this.marker = chars.has(ARROW) ? this.select_unique_marker(chars) : ARROW;
    }

    select_unique_marker(chars) {
        for (let codepoint = 0x10FFFF; codepoint >= 0x10000; codepoint--) {
            let marker = String.fromCodePoint(codepoint);
            if (!chars.has(marker)) {
                return marker;
            }
        }
        throw new Error("Could not find a unique marker");
    }

    make_relative(text) {
        if (text.includes(this.marker)) {
            throw new Error(`Text already contains the outdent marker: ${this.marker}`);
        }

        let lines = text.split(/\r?\n/);
        let output = [];
        let prev_indent = "";

        lines.forEach(line => {
            let line_without_end = line.trimEnd();
            let len_indent = line_without_end.length - line_without_end.trimStart().length;
            let indent = line.slice(0, len_indent);
            let change = len_indent - prev_indent.length;

            let cur_indent;
            if (change > 0) {
                cur_indent = indent.slice(-change);
            } else if (change < 0) {
                cur_indent = this.marker.repeat(-change);
            } else {
                cur_indent = "";
            }

            output.push(cur_indent + "\n" + line.slice(len_indent));
            prev_indent = indent;
        });

        return output.join('');
    }

    make_absolute(text) {
        let lines = text.split(/\r?\n/);
        let output = [];
        let prev_indent = "";

        for (let i = 0; i < lines.length; i += 2) {
            let dent = lines[i].trimEnd();
            let non_indent = lines[i + 1];

            let cur_indent;
            if (dent.startsWith(this.marker)) {
                let len_outdent = dent.length;
                cur_indent = prev_indent.slice(0, -len_outdent);
            } else {
                cur_indent = prev_indent + dent;
            }

            if (!non_indent.trim()) {
                output.push(non_indent);  // don't indent a blank line
            } else {
                output.push(cur_indent + non_indent);
            }

            prev_indent = cur_indent;
        }

        let res = output.join('');
        if (res.includes(this.marker)) {
            throw new Error("Error transforming text back to absolute indents");
        }

        return res;
    }
}

function map_patches(texts, patches, debug) {
    const [search_text, replace_text, original_text] = texts;
    let dmp = new diff_match_patch();
    dmp.Diff_Timeout = 5;

    let diff_so = dmp.diff_main(search_text, original_text);

    if (debug) {
        let html = dmp.diff_prettyHtml(diff_so);
        fs.writeFileSync("tmp.html", html);
        console.log(search_text.length);
        console.log(original_text.length);
    }

    patches.forEach(patch => {
        let start1 = patch.start1;
        let start2 = patch.start2;

        patch.start1 = dmp.diff_xIndex(diff_so, start1);
        patch.start2 = dmp.diff_xIndex(diff_so, start2);

        if (debug) {
            console.log();
            console.log(start1, JSON.stringify(search_text.slice(start1, start1 + 50)));
            console.log(patch.start1, JSON.stringify(original_text.slice(patch.start1, patch.start1 + 50)));
            console.log(patch.diffs);
            console.log();
        }
    });

    return patches;
}

function relative_indent(texts) {
    let ri = new RelativeIndenter(texts);
    texts = texts.map(text => ri.make_relative(text));
    return [ri, texts];
}

const line_padding = 100;

function line_pad(text) {
    let padding = "\n".repeat(line_padding);
    return padding + text + padding;
}

function line_unpad(text) {
    if (new Set(text.slice(0, line_padding) + text.slice(-line_padding)).size !== 1) {
        return;
    }
    return text.slice(line_padding, -line_padding);
}

function dmp_apply(texts, remap = true) {
    const debug = false;
    const [search_text, replace_text, original_text] = texts;
    let dmp = new diff_match_patch();
    dmp.Diff_Timeout = 5;

    if (remap) {
        dmp.Match_Threshold = 0.95;
        dmp.Match_Distance = 500;
        dmp.Match_MaxBits = 128;
        dmp.Patch_Margin = 32;
    } else {
        dmp.Match_Threshold = 0.5;
        dmp.Match_Distance = 100000;
        dmp.Match_MaxBits = 32;
        dmp.Patch_Margin = 8;
    }

    let diff = dmp.diff_main(search_text, replace_text, null);
    dmp.diff_cleanupSemantic(diff);
    dmp.diff_cleanupEfficiency(diff);

    let patches = dmp.patch_make(search_text, diff);

    if (debug) {
        let html = dmp.diff_prettyHtml(diff);
        fs.writeFileSync("tmp.search_replace_diff.html", html);

        diff.forEach(d => console.log(d[0], JSON.stringify(d[1])));

        patches.forEach(patch => {
            let start1 = patch.start1;
            console.log();
            console.log(start1, JSON.stringify(search_text.slice(start1, start1 + 10)));
            console.log(start1, JSON.stringify(replace_text.slice(start1, start1 + 10)));
            console.log(patch.diffs);
        });

        console.log(original_text);
        console.log(search_text);
    }

    if (remap) {
        patches = map_patches(texts, patches, debug);
    }

    let patches_text = dmp.patch_toText(patches);
    let [new_text, success] = dmp.patch_apply(patches, original_text);

    let all_success = success.every(s => s);

    if (debug) {
        console.log(new_text);
        console.log(success);
        console.log(all_success);
    }

    if (!all_success) {
        return;
    }

    return new_text;
}

function lines_to_chars(lines, mapping) {
    return lines.map(char => mapping[char.charCodeAt(0)]).join('');
}

function dmp_lines_apply(texts, remap = true) {
    const debug = false;
    texts.forEach(t => {
        if (!t.endsWith("\n")) {
            throw new Error(t);
        }
    });

    const [search_text, replace_text, original_text] = texts;
    let dmp = new diff_match_patch();
    dmp.Diff_Timeout = 5;

    dmp.Match_Threshold = 0.1;
    dmp.Match_Distance = 100000;
    dmp.Match_MaxBits = 32;
    dmp.Patch_Margin = 1;

    let all_text = search_text + replace_text + original_text;
    let [all_lines, _, mapping] = dmp.diff_linesToChars(all_text, "");
    if (all_lines.length !== all_text.split(/\r?\n/).length) {
        throw new Error("Mismatch in lines length");
    }

    let search_num = search_text.split(/\r?\n/).length;
    let replace_num = replace_text.split(/\r?\n/).length;
    let original_num = original_text.split(/\r?\n/).length;

    let search_lines = all_lines.slice(0, search_num);
    let replace_lines = all_lines.slice(search_num, search_num + replace_num);
    let original_lines = all_lines.slice(search_num + replace_num);

    if (search_lines.length !== search_num ||
        replace_lines.length !== replace_num ||
        original_lines.length !== original_num) {
        throw new Error("Mismatch in lines length");
    }

    let diff_lines = dmp.diff_main(search_lines, replace_lines, null);
    dmp.diff_cleanupSemantic(diff_lines);
    dmp.diff_cleanupEfficiency(diff_lines);

    let patches = dmp.patch_make(search_lines, diff_lines);

    if (debug) {
        let diff = Array.from(diff_lines);
        dmp.diff_charsToLines(diff, mapping);
        let html = dmp.diff_prettyHtml(diff);
        fs.writeFileSync("tmp.search_replace_diff.html", html);

        diff.forEach(d => console.log(d[0], JSON.stringify(d[1])));
    }

    let [new_lines, success] = dmp.patch_apply(patches, original_lines);
    let new_text = lines_to_chars(new_lines, mapping);

    let all_success = success.every(s => s);

    if (debug) {
        console.log(new_text);
        console.log(success);
        console.log(all_success);
    }

    if (!all_success) {
        return;
    }

    return new_text;
}

function diff_lines(search_text, replace_text) {
    let dmp = new diff_match_patch();
    dmp.Diff_Timeout = 5;
    let [search_lines, replace_lines] = dmp.diff_linesToChars(search_text, replace_text);
    let diff_lines = dmp.diff_main(search_lines, replace_lines, null);
    dmp.diff_cleanupSemantic(diff_lines);
    dmp.diff_cleanupEfficiency(diff_lines);
    return dmp.diff_charsToLines(diff_lines, search_text.split(/\r?\n/));
}

async function main() {
    const argv = yargs(process.argv.slice(2))
        .option('repository', {
            alias: 'r',
            describe: 'Path to the repository',
            type: 'string',
            demandOption: true
        })
        .option('filename', {
            alias: 'f',
            describe: 'Path to the file',
            type: 'string',
            demandOption: true
        })
        .option('branch', {
            alias: 'b',
            describe: 'Branch to operate on',
            type: 'string',
            demandOption: true
        })
        .argv;

    const repository = path.resolve(argv.repository);
    const filename = argv.filename;
    const branch = argv.branch;

    const git = simpleGit();

    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repo-'));
    await git.clone(repository, tmp);

    const repoGit = simpleGit(tmp);
    await repoGit.checkout(branch);

    const originalPath = path.join(tmp, filename);
    const originalText = fs.readFileSync(originalPath, 'utf8');

    let search_text = "";  // Implement the logic to get search_text
    let replace_text = "";  // Implement the logic to get replace_text

    [search_text, replace_text, original_text] = relative_indent([search_text, replace_text, originalText]);
    const new_text = dmp_lines_apply([search_text, replace_text, originalText], true);
    const final_text = line_unpad(new_text);

    if (final_text) {
        fs.writeFileSync(originalPath, final_text);
        await repoGit.add(filename);
        await repoGit.commit('Apply patch');
        await repoGit.push('origin', branch);
    } else {
        console.log("Failed to apply patch");
    }
}



function search_and_replace(texts) {
    const [search_text, replace_text, original_text] = texts;

    const num = (original_text.match(new RegExp(search_text, 'g')) || []).length;
    if (num === 0) {
        return;
    }

    const new_text = original_text.replace(new RegExp(search_text, 'g'), replace_text);
    return new_text;
}

async function git_cherry_pick_osr_onto_o(texts) {
    const [search_text, replace_text, original_text] = texts;

    const dname = fs.mkdtempSync(path.join(os.tmpdir(), 'git-'));
    const repo = simpleGit(dname);
    const fname = path.join(dname, 'file.txt');

    fs.writeFileSync(fname, original_text);
    await repo.init();
    await repo.add(fname);
    await repo.commit('original');
    const original_hash = (await repo.log()).latest.hash;

    fs.writeFileSync(fname, search_text);
    await repo.add(fname);
    await repo.commit('search');

    fs.writeFileSync(fname, replace_text);
    await repo.add(fname);
    await repo.commit('replace');
    const replace_hash = (await repo.log()).latest.hash;

    await repo.checkout(original_hash);

    try {
        await repo.raw(['cherry-pick', replace_hash, '--minimal']);
    } catch (err) {
        return;
    }

    const new_text = fs.readFileSync(fname, 'utf8');
    return new_text;
}

async function git_cherry_pick_sr_onto_so(texts) {
    const [search_text, replace_text, original_text] = texts;

    const dname = fs.mkdtempSync(path.join(os.tmpdir(), 'git-'));
    const repo = simpleGit(dname);
    const fname = path.join(dname, 'file.txt');

    fs.writeFileSync(fname, search_text);
    await repo.init();
    await repo.add(fname);
    await repo.commit('search');
    const search_hash = (await repo.log()).latest.hash;

    fs.writeFileSync(fname, replace_text);
    await repo.add(fname);
    await repo.commit('replace');
    const replace_hash = (await repo.log()).latest.hash;

    await repo.checkout(search_hash);

    fs.writeFileSync(fname, original_text);
    await repo.add(fname);
    await repo.commit('original');

    try {
        await repo.raw(['cherry-pick', replace_hash, '--minimal']);
    } catch (err) {
        return;
    }

    const new_text = fs.readFileSync(fname, 'utf8');
    return new_text;
}

class SearchTextNotUnique extends Error {
    constructor() {
        super("Search text is not unique");
    }
}

const all_preprocs = [
    [false, false, false],
    [true, false, false],
    [false, true, false],
    [true, true, false],
];

const always_relative_indent = [
    [false, true, false],
    [true, true, false],
];

const editblock_strategies = [
    [search_and_replace, all_preprocs],
    [git_cherry_pick_osr_onto_o, all_preprocs],
    [dmp_lines_apply, all_preprocs],
];

const never_relative = [
    [false, false],
    [true, false],
];

const udiff_strategies = [
    [search_and_replace, all_preprocs],
    [git_cherry_pick_osr_onto_o, all_preprocs],
    [dmp_lines_apply, all_preprocs],
];

async function flexible_search_and_replace(texts, strategies) {
    for (let [strategy, preprocs] of strategies) {
        for (let preproc of preprocs) {
            let res = await try_strategy(texts, strategy, preproc);
            if (res) {
                return res;
            }
        }
    }
}

function reverse_lines(text) {
    return text.split('\n').reverse().join('\n');
}

async function try_strategy(texts, strategy, preproc) {
    let [preproc_strip_blank_lines, preproc_relative_indent, preproc_reverse] = preproc;

    if (preproc_strip_blank_lines) {
        texts = strip_blank_lines(texts);
    }
    if (preproc_relative_indent) {
        texts = relative_indent(texts);
    }
    if (preproc_reverse) {
        texts = texts.map(reverse_lines);
    }

    let res = await strategy(texts);

    if (res && preproc_reverse) {
        res = reverse_lines(res);
    }

    if (res && preproc_relative_indent) {
        try {
            res = make_absolute(res);
        } catch (err) {
            return;
        }
    }

    return res;
}

function strip_blank_lines(texts) {
    return texts.map(text => text.trim() + '\n');
}

function read_text(fname) {
    return fs.readFileSync(fname, 'utf8');
}

async function proc(dname) {
    dname = path.resolve(dname);

    let search_text, replace_text, original_text;
    try {
        search_text = read_text(path.join(dname, 'search'));
        replace_text = read_text(path.join(dname, 'replace'));
        original_text = read_text(path.join(dname, 'original'));
    } catch (err) {
        return;
    }

    const texts = [search_text, replace_text, original_text];

    const strategies = [
        [dmp_lines_apply, all_preprocs],
    ];

    const short_names = {
        search_and_replace: 'sr',
        git_cherry_pick_osr_onto_o: 'cp_o',
        git_cherry_pick_sr_onto_so: 'cp_so',
        dmp_apply: 'dmp',
        dmp_lines_apply: 'dmpl',
    };

    const patched = {};
    for (let [strategy, preprocs] of strategies) {
        for (let preproc of preprocs) {
            let method = short_names[strategy.name];

            let [strip_blank, rel_indent, rev_lines] = preproc;
            if (strip_blank || rel_indent) method += '_';
            if (strip_blank) method += 's';
            if (rel_indent) method += 'i';
            if (rev_lines) method += 'r';

            let res = await try_strategy(texts, strategy, preproc);
            patched[method] = res;
        }
    }

    const results = [];
    for (let [method, res] of Object.entries(patched)) {
        const out_fname = path.join(dname, `original.${method}`);
        if (fs.existsSync(out_fname)) {
            fs.unlinkSync(out_fname);
        }

        if (res) {
            fs.writeFileSync(out_fname, res);

            const correct = fs.readFileSync(path.join(dname, 'correct'), 'utf8');
            if (res === correct) {
                res = 'pass';
            } else {
                res = 'WRONG';
            }
        } else {
            res = 'fail';
        }

        results.push([method, res]);
    }

    return results;
}

function colorize_result(result) {
    const colors = {
        pass: '\x1b[42;30mpass\x1b[0m',
        WRONG: '\x1b[41;30mWRONG\x1b[0m',
        fail: '\x1b[43;30mfail\x1b[0m',
    };
    return colors[result] || result;
}

module.exports={
    SearchTextNotUnique
}

if (require.main === module) {
    main();
}
