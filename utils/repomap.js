// const fs = require('fs');
const fs = require('fs-extra');
const path = require('path');
const NodeCache = require('node-cache');

var detect = require('language-detect');

const esprima = require('esprima');

// const language = require('tree-sitter-javascript');
const {
    query
} = require('tree-sitter-query');


const centrality = require('graphology-metrics/centrality');
const _ = require('lodash');

const Graph = require('graphology');

const pagerank = require('graphology-pagerank');


const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const {
    join
} = require('path');

const filenameToLang = (fname) => {
    // Implement logic to determine language from filename
    if (fname.endsWith('.js')) {
      return 'javascript';
    }
    return null;
  };
  
  const getLanguage = (lang) => {
    // Implement logic to return the language module
    if (lang === 'javascript') {
      return JavaScript;
    }
    return null;
  };
  
  const getParser = (lang) => {
    const parser = new Parser();
    const language = getLanguage(lang);
    parser.setLanguage(language);
    return parser;
  };

class RepoMap {
    maxMapTokens = 1024;
    maxContextWindow = null;

    constructor(maxMapTokens = 1024, maxContextWindow = null) {
        this.maxMapTokens = maxMapTokens;
        this.maxContextWindow = maxContextWindow;
        this.root = '.';
        this.TAGS_CACHE_DIR = '.aider.tags.cache.v3';
        this.cacheMissing = false;
        this.TAGS_CACHE = new NodeCache();
        // this.tokenCount=1000
    }
    tokenCount(code) {
        // Parse the code into tokens
        const tokens = esprima.tokenize(code);

        // Return the number of tokens
        return tokens.length;
    }
    getRelFname(fname) {
        return path.relative(this.root, fname);
    }
    toTree(tags, chat_rel_fnames) {
        if (!tags || tags.length === 0) {
            return "";
        }

        tags = tags.filter(tag => !chat_rel_fnames.includes(tag[0]));
        tags.sort();

        let cur_fname = null;
        let cur_abs_fname = null;
        let lois = null;
        let output = "";

        // add a bogus tag at the end so we trip the this_fname != cur_fname...
        let dummy_tag = [null];
        tags.push(dummy_tag);

        for (let tag of tags) {
            let this_rel_fname = tag[0];

            // ... here ... to output the final real entry in the list
            if (this_rel_fname !== cur_fname) {
                if (lois !== null) {
                    output += "\n";
                    output += cur_fname + ":\n";
                    output += this.render_tree(cur_abs_fname, cur_fname, lois);
                    lois = null;
                } else if (cur_fname) {
                    output += "\n" + cur_fname + "\n";
                }
                if (tag instanceof Tag) {
                    lois = [];
                    cur_abs_fname = tag.fname;
                }
                cur_fname = this_rel_fname;
            }

            if (lois !== null) {
                lois.push(tag.line);
            }
        }

        // truncate long lines, in case we get minified js or something else crazy
        output = output.split('\n').map(line => line.substring(0, 100)).join('\n') + "\n";

        return output;
    }
    //This method aims to generate a tree structure of ranked tags from a list of files, optimizing the tree to fit within a specified token limit 
   async getRankedTagsMap(chatFnames, otherFnames = [], maxMapTokens = this.maxMapTokens, mentionedFnames = [], mentionedIdents = {}) {
        let rankedTags = await this.getRankedTags(chatFnames, otherFnames, mentionedFnames, mentionedIdents);

        let numTags = rankedTags.length;
        let lowerBound = 0;
        let upperBound = numTags;
        let bestTree = null;
        let bestTreeTokens = 0;

        //TODO: Check
        let chatRelFnames = chatFnames.map(fname => this.getRelFname(fname));

        //Using binary tree algorithm
        // Guess a small starting number to help with giant repos
        let middle = Math.min(Math.floor(maxMapTokens / 25), numTags);

        this.treeCache = {};

        while (lowerBound <= upperBound) {
            let tree = this.toTree(rankedTags.slice(0, middle), chatRelFnames);
            let numTokens = this.tokenCount(tree);

            if (numTokens < maxMapTokens && numTokens > bestTreeTokens) {
                bestTree = tree;
                bestTreeTokens = numTokens;
            }

            if (numTokens < maxMapTokens) {
                lowerBound = middle + 1;
            } else {
                upperBound = middle - 1;
            }

            middle = Math.floor((lowerBound + upperBound) / 2);
        }

        return bestTree;
    }

    //This gets the Ranked tags from the files
   async getRankedTags(chatFnames, otherFnames, mentionedFnames, mentionedIdents) {
        let defines = [];
        let references = [];
        let definitions = [];
        let personalization = [];

        let fnames = [...chatFnames, ...otherFnames].sort();
        let chatRelFnames = new Set();

        if (fnames.length === 0) {
            throw new Error("No files provided. Please provide at least one file.");
        }
        let personalize = 10 / fnames.length;

        for (let fname of fnames) {
            if (!fs.existsSync(fname) || !fs.lstatSync(fname).isFile()) {
                if (!this.warnedFiles.has(fname)) {
                    console.error(`Repo-map can't include ${fname}, it is not a normal file or it no longer exists`);
                    this.warnedFiles.add(fname);
                }
                continue;
            }

            let relFname = fname;

            if (chatFnames.includes(fname)) {
                personalization[relFname] = personalize;
                chatRelFnames.add(relFname);
            }

            if (mentionedFnames.includes(fname)) {
                personalization[relFname] = personalize;
            }

            let tags = await this.getTags(fname, relFname);
            if (tags === null) {
                continue;
            }

            for (let tag of tags) {
                if (tag.kind === "def") {
                    if (!defines.has(tag.name)) {
                        defines.set(tag.name, new Set());
                    }
                    defines.get(tag.name).add(relFname);
                    let key = [relFname, tag.name];
                    if (!definitions.has(key)) {
                        definitions.set(key, new Set());
                    }
                    definitions.get(key).add(tag);
                }

                if (tag.kind === "ref") {
                    if (!references.has(tag.name)) {
                        references.set(tag.name, []);
                    }
                    references.get(tag.name).push(relFname);
                }
            }
        }

        if (references.size === 0) {
            references = new Map(Array.from(defines.entries()).map(([k, v]) => [k, Array.from(v)]));
        }
        let idents = new Set([...Object.keys(defines), ...Object.keys(references)]);

        const G = new Graph.DirectedGraph();

        for (const ident of idents) {
            const definers = defines[ident];
            const mul = mentionedIdents.has(ident) ? 10 : 1;
            for (const [referencer, numRefs] of Object.entries(references[ident])) {
                for (const definer of definers) {
                    if (G.hasEdge(referencer, definer)) {
                        const existingWeight = G.getEdgeAttribute(referencer, definer, 'weight');
                        G.setEdgeAttribute(referencer, definer, 'weight', existingWeight + mul * numRefs);
                    } else {
                        G.addEdgeWithKey(referencer, definer, {
                            weight: mul * numRefs,
                            ident: ident
                        });
                    }
                }
            }
        }
        const ranked = pagerank(G, {
            weight: 'weight',
            personalized: personalization,
            damping: 0.85
        });
        // const ranked = pagerank(G, {weight: 'weight', personalized: personalization});
        let ranked_definitions = new Map();
        for (let src of G.nodes()) {
            let src_rank = ranked[src];
            let total_weight = _.sumBy(Array.from(G.edges(src)), edge => G.getEdgeAttribute(edge, 'weight'));
            for (let edge of G.edges(src)) {
                let dst = G.target(edge);
                let data = G.getEdgeAttributes(edge);
                data.rank = src_rank * data.weight / total_weight;
                let ident = data.ident;
                let key = [dst, ident];
                if (!ranked_definitions.has(key)) {
                    ranked_definitions.set(key, 0);
                }
                ranked_definitions.set(key, ranked_definitions.get(key) + data.rank);
            }
        }

        let ranked_tags = [];
        let ranked_definitions_array = Array.from(ranked_definitions.entries());
        ranked_definitions_array.sort((a, b) => b[1] - a[1]);

        for (let [
                [fname, ident], rank
            ] of ranked_definitions_array) {
            if (chat_rel_fnames.has(fname)) {
                continue;
            }
            ranked_tags.push(...definitions.get([fname, ident]) || []);
        }

        let rel_other_fnames_without_tags = new Set(other_fnames.map(fname => this.get_rel_fname(fname)));
        let fnames_already_included = new Set(ranked_tags.map(rt => rt[0]));

        let top_rank = _.sortBy(Array.from(ranked.entries()), ([node, rank]) => -rank);
        for (let [rank, fname] of top_rank) {
            if (rel_other_fnames_without_tags.has(fname)) {
                rel_other_fnames_without_tags.delete(fname);
            }
            if (!fnames_already_included.has(fname)) {
                ranked_tags.push([fname]);
            }
        }

        for (let fname of rel_other_fnames_without_tags) {
            ranked_tags.push([fname]);
        }

        return ranked_tags;

    }

    to_tree(tags, chat_rel_fnames) {
        if (!tags) {
            return "";
        }

        tags = tags.filter(tag => tag[0] !== chat_rel_fnames);
        tags.sort();

        let cur_fname = null;
        let cur_abs_fname = null;
        let lois = null;
        let output = "";

        // add a bogus tag at the end so we trip the this_rel_fname != cur_fname...
        let dummy_tag = [null];
        for (let tag of [...tags, dummy_tag]) {
            let this_rel_fname = tag[0];

            // ... here ... to output the final real entry in the list
            if (this_rel_fname !== cur_fname) {
                if (lois !== null) {
                    output += "\n";
                    output += cur_fname + ":\n";
                    output += this.render_tree(cur_abs_fname, cur_fname, lois);
                    lois = null;
                } else if (cur_fname) {
                    output += "\n" + cur_fname + "\n";
                }
                if (tag instanceof Tag) {
                    lois = [];
                    cur_abs_fname = tag.fname;
                }
                cur_fname = this_rel_fname;
            }

            if (lois !== null) {
                lois.push(tag.line);
            }
        }

        // truncate long lines, in case we get minified js or something else crazy
        output = output.split('\n').map(line => line.substring(0, 100)).join('\n') + "\n";

        return output;
    }

   async getTags(fname, rel_fname) {
        // Check if the file is in the cache and if the modification time has not changed
        let file_mtime = this.get_mtime(fname);
        if (file_mtime === null) {
            return [];
        }

        let cache_key = fname;
        if (cache_key in this.TAGS_CACHE && this.TAGS_CACHE[cache_key]["mtime"] === file_mtime) {
            return this.TAGS_CACHE[cache_key]["data"];
        }

        // miss!

        let data = Array.from( await this.get_tags_raw(fname, rel_fname));

        // Update the cache
        this.TAGS_CACHE[cache_key] = {
            "mtime": file_mtime,
            "data": data
        };
        this.save_tags_cache();
        return data;
    }
    save_tags_cache() {
        // TODO: Implement the functionality here
    }

    get_mtime(fname) {
        try {
            return fs.statSync(fname).mtime;
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.io.tool_error(`File not found error: ${fname}`);
            } else {
                throw error;
            }
        }
    }
    loadTagsCache() {
        const cachePath = path.join(this.root, this.TAGS_CACHE_DIR);
        if (!fs.existsSync(cachePath)) {
            this.cacheMissing = true;
        }
        // Load cache from file
        const rawData = fs.readFileSync(cachePath, 'utf8');
        const data = JSON.parse(rawData);
        this.TAGS_CACHE.mset(data);
    }



    async get_tags_raw(fname, rel_fname) {

        // let lang = detect.sync(fname); //filename_to_lang(fname);
        // if (!lang) {
        //     return;
        // }
        const lang = filenameToLang(fname);
        if (!lang) return [];

        const language = getLanguage(lang);
        const parser = getParser(lang);

        // Load the tags queries
        const scmFname = join(__dirname, 'queries', `tree-sitter-${lang}-tags.scm`);
        if (!await fs.pathExists(scmFname)) return [];

        const queryScm = await fs.readFile(scmFname, 'utf8');
        const code = await fs.readFile(fname, 'utf8');
        if (!code) return [];

        const tree = parser.parse(code);

        const query = new Parser.Query(language, queryScm);
        let captures = query.captures(tree.rootNode);


        captures = Array.from(captures);

        let saw = new Set();
        let results = [];
        for (let capture of captures) {
            let node = capture[0];
            let tag = capture[1];
            let kind;
            if (tag && tag.startsWith("name.definition.")) {
                kind = "def";
            } else if (tag && tag.startsWith("name.reference.")) {
                kind = "ref";
            } else {
                continue;
            }

            saw.add(kind);

            let result = new Tag(
                rel_fname,
                fname,
                node.text.toString("utf-8"),
                kind,
                node.start_point[0],
            );

            results.push(result);
        }

        if (saw.has("ref")) {
            return results;
        }
        if (!saw.has("def")) {
            return results;
        }

        // We saw defs, without any refs
        // Some tags files only provide defs (cpp, for example)
        // Use pygments to backfill refs

        let lexer;
        try {
            lexer = guess_lexer_for_filename(fname, code);
        } catch (error) {
            if (error instanceof ClassNotFound) {
                return results;
            }
            throw error;
        }

        let tokens = Array.from(lexer.get_tokens(code));
        tokens = tokens.map(token => token[1]).filter(token => token[0] in Token.Name);

        for (let token of tokens) {
            results.push(new Tag(
                rel_fname,
                fname,
                token,
                "ref",
                -1,
            ));
        }

        return results;
    }

    // Here Chat Files are the files already included in the chat, 
    // other files are the files that are passed. Ideally might be all tracked files.
    // Mentioned FileNames are the file Names mentioned in the chat.
    // Mentioned Identifiers are the identifiers mentioned in the chat.
    getRepoMap(chatFiles, otherFiles, mentionedFnames = [], mentionedIdents = []) {
        if (this.maxMapTokens <= 0) {
            return;
        }
        if (!otherFiles) {
            return;
        }

        let maxMapTokens = this.maxMapTokens;

        // With no files in the chat, give a bigger view of the entire repo
        const MUL = 16;
        const padding = 4096;
        let target;
        if (maxMapTokens && this.maxContextWindow) {
            target = Math.min(maxMapTokens * MUL, this.maxContextWindow - padding);
        } else {
            target = 0;
        }
        if (!chatFiles && this.maxContextWindow && target > 0) {
            maxMapTokens = target;
        }

        let filesListing;
        try {
            filesListing = this.getRankedTagsMap(
                chatFiles, otherFiles, maxMapTokens, mentionedFnames, mentionedIdents
            );
        } catch (error) {
            if (error instanceof RecursionError) {
                this.io.toolError("Disabling repo map, git repo too large?");
                this.maxMapTokens = 0;
                return;
            }
            throw error;
        }

        if (!filesListing) {
            return;
        }

        const numTokens = this.tokenCount(filesListing);
        if (this.verbose) {
            this.io.toolOutput(`Repo-map: ${(numTokens/1024).toFixed(1)} k-tokens`);
        }

        let other = chatFiles ? "other " : "";

        let repoContent = this.repoContentPrefix ? this.repoContentPrefix.replace('{other}', other) : "";

        repoContent += filesListing;

        return repoContent;
    }

    treeCache = {};
}

module.exports = {
    RepoMap
}