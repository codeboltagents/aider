const fs = require('fs');
const path = require('path');
const TreeSitter = require('tree-sitter');
const TreeSitterPython = require('tree-sitter-python');
const TreeSitterJavaScript = require('tree-sitter-javascript'); // Add more languages as needed

const {
  MultiDirectedGraph,
  DirectedGraph
} = require('graphology');
const pagerank = require('graphology-pagerank');

const _ = require('lodash');


// Ignore FutureWarnings
process.on('warning', (warning) => {
  if (warning.name === 'FutureWarning') {
    // Ignore FutureWarning
  } else {
    console.warn(warning);
  }
});
// const Tag = NamedTuple('Tag', ['rel_fname', 'fname', 'line', 'name', 'kind']);

// const Tag = namedtuple('Tag', ['rel_fname', 'fname', 'line', 'name', 'kind']);
class Counter {
  constructor(iterable = []) {
    this.counts = new Map();
    for (const item of iterable) {
      this.increment(item);
    }
  }

  increment(item) {
    this.counts.set(item, (this.counts.get(item) || 0) + 1);
  }

  entries() {
    return [...this.counts.entries()];
  }

  items() {
    return this.entries();
  }
}



class RepoMap {
  static CACHE_VERSION = 3;
  static TAGS_CACHE_DIR = `.aider.tags.cache.v${RepoMap.CACHE_VERSION}`;

  cache_missing = false;
  warned_files = new Set();

  constructor(map_tokens = 1024, root = null, main_model = null, io = null, repo_content_prefix = null, verbose = false, max_context_window = null) {
    this.io = io;
    this.verbose = verbose;

    if (!root) {
      root = process.cwd();
    }
    this.root = root;

    this.load_tags_cache();

    this.max_map_tokens = map_tokens;
    this.max_context_window = max_context_window;

    this.token_count = 0 //main_model.token_count;
    this.repo_content_prefix = repo_content_prefix;
  }
  render_tree(abs_fname, rel_fname, lois) {
    const key = `${rel_fname}:${lois.slice().sort().join(',')}`;

    if (this.tree_cache.has(key)) {
      return this.tree_cache.get(key);
    }

    let code = this.io.readText(abs_fname) || "";
    if (!code.endsWith("\n")) {
      code += "\n";
    }

    const context = new TreeContext({
      rel_fname,
      code,
      color: false,
      line_number: false,
      child_context: false,
      last_line: false,
      margin: 0,
      mark_lois: false,
      loi_pad: 0,
      // header_max: 30,
      show_top_of_file_parent_scope: false
    });

    context.add_lines_of_interest(lois);
    context.add_context();
    const res = context.format();
    this.tree_cache.set(key, res);
    return res;
  }

  to_tree(tags, chat_rel_fnames) {
    if (!tags.length) {
      return "";
    }

    tags = tags.filter(tag => !chat_rel_fnames.includes(tag[0]));
    tags = tags.sort();

    let cur_fname = null;
    let cur_abs_fname = null;
    let lois = null;
    let output = "";

    // Add a bogus tag at the end to trigger the final real entry in the list
    const dummy_tag = [null];
    for (const tag of [...tags, dummy_tag]) {
      const this_rel_fname = tag[0];

      // Output the final real entry in the list
      if (this_rel_fname !== cur_fname) {
        if (lois !== null) {
          output += "\n";
          output += `${cur_fname}:\n`;
          output += this.render_tree(cur_abs_fname, cur_fname, lois);
          lois = null;
        } else if (cur_fname) {
          output += `\n${cur_fname}\n`;
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

    // Truncate long lines to handle cases like minified JS
    output = output.split('\n').map(line => line.slice(0, 100)).join('\n') + "\n";

    return output;
  }
  get_repo_map(chat_files, other_files, mentioned_fnames = new Set(), mentioned_idents = new Set()) {
    if (this.max_map_tokens <= 0 || !other_files.length) return;

    const max_map_tokens = this.max_map_tokens;
    const MUL = 16;
    const padding = 4096;
    const target = Math.min(max_map_tokens * MUL, this.max_context_window - padding);

    let files_listing;
    try {
      files_listing = this.get_ranked_tags_map(chat_files, other_files, target, mentioned_fnames, mentioned_idents);
    } catch (err) {
      if (err instanceof RangeError) {
        this.io.tool_error('Disabling repo map, git repo too large?');
        this.max_map_tokens = 0;
        return;
      }
      throw err;
    }

    if (!files_listing) return;

    const num_tokens = 20000 // this.token_count(files_listing);
    if (this.verbose) {
      this.io.tool_output(`Repo-map: ${(num_tokens / 1024).toFixed(1)} k-tokens`);
    }

    let repo_content = this.repo_content_prefix ? this.repo_content_prefix.replace('{other}', chat_files.length ? 'other ' : '') : '';
    repo_content += files_listing;

    return repo_content;
  }

  get_rel_fname(fname) {
    return path.relative(this.root, fname);
  }

  split_path(filePath) {
    const relPath = path.relative(this.root, filePath);
    return [`${relPath}:`];
  }

  load_tags_cache() {
    const cachePath = path.join(this.root, RepoMap.TAGS_CACHE_DIR);
    if (!fs.existsSync(cachePath)) {
      RepoMap.cache_missing = true;
    }
    this.TAGS_CACHE = new Map();
    // this.TAGS_CACHE.set(cache_key, { mtime: file_mtime, data });
    // this.TAGS_CACHE = new Cache(cachePath);
  }

  save_tags_cache() {
    // Implement save functionality if needed
  }

  get_mtime(fname) {
    try {
      return fs.statSync(fname).mtimeMs;
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.io.tool_error(`File not found error: ${fname}`);
      } else {
        throw err;
      }
    }
  }

  get_tags(fname, rel_fname) {
    const file_mtime = this.get_mtime(fname);
    if (file_mtime === undefined) return [];

    const cache_key = fname;
    if (this.TAGS_CACHE && this.TAGS_CACHE.has(cache_key) && this.TAGS_CACHE.get(cache_key).mtime === file_mtime) {
      return this.TAGS_CACHE.get(cache_key).data;
    }


    const data = Array.from(this.get_tags_raw(fname, rel_fname));
    this.TAGS_CACHE.set(cache_key, {
      mtime: file_mtime,
      data
    });
    this.save_tags_cache();

    return data;
  }

  get_tags_raw(fname, rel_fname) {
    // Determine language based on file extension or other means
    let language = null;
    if (fname.endsWith('.py')) {
      language = TreeSitterPython;
    } else if (fname.endsWith('.js')) {
      language = TreeSitterJavaScript;
    }
    // Add more languages as needed

    if (!language) return [];

    const Parser = new TreeSitter();
    Parser.setLanguage(language);

    const code = fs.readFileSync(fname, 'utf-8');
    // console.log(code)
    if (!code) return [];

    const tree = Parser.parse(code);

    const query_scm_path = path.join(__dirname, 'queries', `tree-sitter-${language.name}-tags.scm`);
    if (!fs.existsSync(query_scm_path)) return [];
    const query_scm = fs.readFileSync(query_scm_path, 'utf8');

    // const query = language.query(query_scm);
    const query = new TreeSitter.Query(language, query_scm);
    const captures = query.captures(tree.rootNode);
    const results = [];
    const saw = new Set();
    for (const {
        name: tag,
        node
      } of captures) {
      let kind;
      if (tag.startsWith('name.definition.')) {
        kind = 'def';
      } else if (tag.startsWith('name.reference.')) {
        kind = 'ref';
      } else {
        continue;
      }

      saw.add(kind);

      const result = {
        rel_fname,
        fname,
        line: node.startPosition.row,
        name: node.text,
        kind
      };
      results.push(result);
    }

    if (saw.has('ref')) return results;
    if (!saw.has('def')) return results;

    const tokens = code.match(/\b\w+\b/g) || [];

    for (const token of tokens) {
      results.push({
        rel_fname: rel_fname,
        fname: fname,
        name: token,
        kind: 'ref',
        line: -1,
      });
    }

    return results;

    // Token extraction logic here (e.g., from a lexer)

  }

  async get_ranked_tags_old(chat_fnames, other_fnames, mentioned_fnames, mentioned_idents) {
    const defines = {};
    const references = {};
    const definitions = {};

    const personalization = {};
    const fnames = new Set([...chat_fnames, ...other_fnames]);
    const chat_rel_fnames = new Set();

    const sorted_fnames = [...fnames].sort();

    const personalize = 10 / sorted_fnames.length;

    for (const fname of sorted_fnames) {
      if (!fs.existsSync(fname)) {
        continue;
      }

      const rel_fname = this.get_rel_fname(fname); // Implement get_rel_fname function

      if (chat_fnames.includes(fname)) {
        personalization[rel_fname] = personalize;
        chat_rel_fnames.add(rel_fname);
      }

      if (mentioned_fnames.includes(fname)) {
        personalization[rel_fname] = personalize;
      }

      const tags = this.get_tags(fname, rel_fname); // Implement get_tags function
      if (!tags) continue;

      for (const tag of tags) {
        if (tag.kind === "def") {
          if (!defines[tag.name]) defines[tag.name] = new Set();
          defines[tag.name].add(rel_fname);
          const key = `${rel_fname}-${tag.name}`;
          if (!definitions[key]) definitions[key] = new Set();
          definitions[key].add(tag);
        }

        if (tag.kind === "ref") {
          if (!references[tag.name]) references[tag.name] = [];
          references[tag.name].push(rel_fname);
        }
      }
    }

    if (Object.keys(references).length === 0) {
      for (const k in defines) {
        references[k] = [...defines[k]];
      }
    }

    const idents = new Set([...Object.keys(defines)].filter(ident => references[ident]));

    const multiGraph = new MultiDirectedGraph();

    // Add nodes to the graph
    sorted_fnames.forEach((fname) => {
      multiGraph.addNode(this.get_rel_fname(fname));
    });

    for (const ident of idents) {
      const definers = defines[ident];
      const mul = mentioned_idents.includes(ident) ? 10 : 1;

      const refCount = new Counter(references[ident]);
      for (const [referencer, num_refs] of refCount.entries()) {
        for (const definer of definers) {
          const weight = mul * num_refs;
          multiGraph.addEdge(referencer, definer, {
            weight,
            ident
          });
        }
      }
    }

    // Convert MultiDirectedGraph to DirectedGraph with aggregated weights
    const directedGraph = new DirectedGraph();
    multiGraph.forEachEdge((edge, attributes, source, target) => {
      if (typeof source !== 'string' || typeof target !== 'string') {
        console.error(`Invalid edge: source or target is not a string.`, {
          source,
          target
        });
        return;
      }

      // Ensure nodes are in the DirectedGraph
      if (!directedGraph.hasNode(source)) directedGraph.addNode(source);
      if (!directedGraph.hasNode(target)) directedGraph.addNode(target);

      // Aggregate weights
      if (directedGraph.hasEdge(source, target)) {
        const existingWeight = directedGraph.getEdgeAttribute(source, target, 'weight') || 0;
        directedGraph.setEdgeAttribute(source, target, 'weight', existingWeight + attributes.weight);
      } else {
        directedGraph.addEdge(source, target, {
          weight: attributes.weight
        });
      }
    });

    const pers_args = Object.keys(personalization).length ? {
      personalization
    } : {};

    let ranked;
    try {
      ranked = pagerank(directedGraph, {
        getEdgeWeight: 'weight',
        personalization: pers_args.personalization,
        damping: 0.85,
        maxIterations: 100,
        tolerance: 1e-6,
      });
    } catch (e) {
      if (e instanceof ZeroDivisionError) {
        return [];
      }
      throw e;
    }

    const ranked_definitions = {};
    directedGraph.forEachNode((src) => {
      const src_rank = ranked[src];
      let total_weight = 0;
      directedGraph.forEachOutboundEdge(src, (src, dst, attrs) => {
        total_weight += attrs.weight;
      });

      directedGraph.forEachOutboundEdge(src, (src, dst, attrs) => {
        try {
          const edgeAttributes = directedGraph.getEdgeAttributes(src, dst);
          if (edgeAttributes) {
            edgeAttributes.rank = (src_rank * attrs.weight) / total_weight;
            const ident = edgeAttributes.ident;
            const key = `${dst}-${ident}`;
            if (!ranked_definitions[key]) ranked_definitions[key] = 0;
            ranked_definitions[key] += edgeAttributes.rank;
          }
        } catch (error) {
          console.error(`Error processing edge from ${src} to ${dst}:`, error);
        }
      });
    });

    const ranked_tags = [];
    const sorted_ranked_definitions = Object.entries(ranked_definitions).sort((a, b) => b[1] - a[1]);

    for (const [key, rank] of sorted_ranked_definitions) {
      const [fname, ident] = key.split('-');
      if (chat_rel_fnames.has(fname)) continue;
      ranked_tags.push(...(definitions[key] || []));
    }

    const rel_other_fnames_without_tags = new Set(other_fnames.map(fname => get_rel_fname(fname)));
    const fnames_already_included = new Set(ranked_tags.map(rt => rt[0]));

    const top_rank = Object.entries(ranked).sort((a, b) => b[1] - a[1]);
    for (const [fname, rank] of top_rank) {
      if (rel_other_fnames_without_tags.has(fname)) {
        rel_other_fnames_without_tags.delete(fname);
      }
      if (!fnames_already_included.has(fname)) {
        ranked_tags.push([fname]);
      }
    }

    for (const fname of rel_other_fnames_without_tags) {
      ranked_tags.push([fname]);
    }

    return ranked_tags;

  }
  async get_ranked_tags(chat_fnames, other_fnames, mentioned_fnames = [], mentioned_idents) {
    const defines = new Map();
    let references = new Map();
    const definitions = new Map();
    const personalization = new Map();

    const fnames = new Set([...chat_fnames, ...other_fnames]);
    const chat_rel_fnames = new Set();

    const sortedFnames = Array.from(fnames).sort();
    const personalize = 10 / sortedFnames.length;

    if (this.cache_missing) {
      // This assumes you are using some sort of progress indicator
      // You might need to implement a similar progress indicator for JavaScript
    }
    this.cache_missing = false;

    for (const fname of sortedFnames) {
      if (!require('fs').existsSync(fname)) {
        if (!this.warned_files.has(fname)) {
          if (require('fs').existsSync(fname)) {
            console.error(`Repo-map can't include ${fname}, it is not a normal file`);
          } else {
            console.error(`Repo-map can't include ${fname}, it no longer exists`);
          }
          this.warned_files.add(fname);
        }
        continue;
      }

      const rel_fname = this.get_rel_fname(fname);

      if (chat_fnames.includes(fname)) {
        personalization.set(rel_fname, personalize);
        chat_rel_fnames.add(rel_fname);
      }

      if (mentioned_fnames.includes(fname)) {
        personalization.set(rel_fname, personalize);
      }

      const tags = this.get_tags(fname, rel_fname);
      if (tags === null) {
        continue;
      }

      for (const tag of tags) {
        if (tag.kind === "def") {
          if (!defines.has(tag.name)) defines.set(tag.name, new Set());
          defines.get(tag.name).add(rel_fname);
          const key = [rel_fname, tag.name];
          if (!definitions.has(key)) definitions.set(key, new Set());
          definitions.get(key).add(tag);
        }

        if (tag.kind === "ref") {
          if (!references.has(tag.name)) references.set(tag.name, []);
          references.get(tag.name).push(rel_fname);
        }
      }
    }

    if (references.size === 0) {
      references = new Map([...defines.entries()].map(([k, v]) => [k, Array.from(v)]));
    }

    const idents = new Set([...defines.keys()].filter(k => references.has(k)));

    const multiGraph = new MultiDirectedGraph();

    for (const ident of idents) {
      const definers = defines.get(ident);
      const mul = mentioned_idents.includes(ident) ? 10 : 1;
      const refCount = new Counter(references.get(ident));

      for (const [referencer, num_refs] of refCount.entries()) {
        for (const definer of definers) {
          if (!multiGraph.hasNode(referencer)) multiGraph.addNode(referencer);
          if (!multiGraph.hasNode(definer)) multiGraph.addNode(definer);
          multiGraph.addEdge(referencer, definer, {
            weight: mul * num_refs,
            ident: ident
          });
        }
      }
    }

    const directedGraph = new DirectedGraph();

    multiGraph.forEachEdge((edge, attributes, source, target) => {
      if (!directedGraph.hasNode(source)) directedGraph.addNode(source);
      if (!directedGraph.hasNode(target)) directedGraph.addNode(target);

      if (directedGraph.hasEdge(source, target)) {
        const existingWeight = directedGraph.getEdgeAttribute(source, target, 'weight') || 0;
        directedGraph.setEdgeAttribute(source, target, 'weight', existingWeight + attributes.weight);
      } else {
        directedGraph.addEdge(source, target, {
          weight: attributes.weight
        });
      }
    });

    const pagerankValues = pagerank(directedGraph, {
      getEdgeWeight: 'weight',
      personalization: Object.fromEntries(personalization),
      damping: 0.85,
      maxIterations: 100,
      tolerance: 1e-6
    });

    const ranked_definitions = new Map();

    directedGraph.forEachNode((src) => {
      const src_rank = pagerankValues[src];
      const outEdges = directedGraph.outEdges(src);

      if (outEdges.length === 0) {
        return; // No outgoing edges, skip
      }

      const total_weight = outEdges.reduce((sum, edge) => {
        // Validate edge properties
        if (edge.source && edge.target) {
          const weight = directedGraph.getEdgeAttribute(edge.source, edge.target, 'weight') || 0;
          return sum + weight;
        }
        return sum;
      }, 0);

      if (total_weight === 0) {
        return; // Avoid division by zero
      }

      directedGraph.forEachOutwardEdge(src, (edge) => {
        const attrs = directedGraph.getEdgeAttributes(edge.source, edge.target);
        if (attrs && attrs.weight) {
          attrs.rank = (src_rank * attrs.weight) / total_weight;
          const ident = attrs.ident;
          const dst = edge.target;
          const key = [dst, ident];
          if (!ranked_definitions.has(key)) ranked_definitions.set(key, 0);
          ranked_definitions.set(key, ranked_definitions.get(key) + attrs.rank);
        }
      });
    });


    const ranked_tags = [];
    const sorted_ranked_definitions = Array.from(ranked_definitions.entries()).sort((a, b) => b[1] - a[1]);

    for (const [
        [fname, ident], rank
      ] of sorted_ranked_definitions) {
      if (chat_rel_fnames.has(fname)) {
        continue;
      }
      ranked_tags.push(...(definitions.get([fname, ident]) || []));
    }

    const rel_other_fnames_without_tags = new Set(other_fnames.map(this.get_rel_fname.bind(this)));
    const fnames_already_included = new Set(ranked_tags.map(rt => rt[0]));

    const top_rank = Object.entries(pagerankValues).sort((a, b) => b[1] - a[1]);
    for (const [fname, rank] of top_rank) {
      if (rel_other_fnames_without_tags.has(fname)) {
        rel_other_fnames_without_tags.delete(fname);
      }
      if (!fnames_already_included.has(fname)) {
        ranked_tags.push([fname]);
      }
    }

    for (const fname of rel_other_fnames_without_tags) {
      ranked_tags.push([fname]);
    }

    return ranked_tags;
  }




  async get_ranked_tags_map(
    chat_fnames,
    other_fnames = [],
    max_map_tokens = this.max_map_tokens,
    mentioned_fnames = [],
    mentioned_idents = []
  ) {
    if (!other_fnames) other_fnames = [];
    if (!max_map_tokens) max_map_tokens = this.max_map_tokens;
    if (!mentioned_fnames) mentioned_fnames = []
    if (!mentioned_idents) mentioned_idents = [];

    const ranked_tags = await this.get_ranked_tags(
      chat_fnames, other_fnames, mentioned_fnames, mentioned_idents
    );
    console.log(ranked_tags)

    const num_tags = ranked_tags.length;
    let lower_bound = 0;
    let upper_bound = num_tags;
    let best_tree = null;
    let best_tree_tokens = 0;

    const chat_rel_fnames = chat_fnames.map(fname => this.get_rel_fname(fname));

    // Guess a small starting number to help with giant repos
    let middle = Math.min(Math.floor(max_map_tokens / 25), num_tags);

    this.tree_cache = {}; // Change `treeCache` to `tree_cache`

    while (lower_bound <= upper_bound) {
      const tree = this.to_tree(ranked_tags.slice(0, middle), chat_rel_fnames);
      const num_tokens = this.token_count(tree);

      if (num_tokens < max_map_tokens && num_tokens > best_tree_tokens) {
        best_tree = tree;
        best_tree_tokens = num_tokens;
      }

      if (num_tokens < max_map_tokens) {
        lower_bound = middle + 1;
      } else {
        upper_bound = middle - 1;
      }

      middle = Math.floor((lower_bound + upper_bound) / 2);
    }

    return best_tree;
  }
  // async get_ranked_tags_map(chat_fnames, other_fnames, target_tokens, mentioned_fnames = [], mentioned_idents = []) {
  //   const ranked = await this.get_ranked_tags(chat_fnames, other_fnames, mentioned_fnames, mentioned_idents);
  //   // const rel_fnames = Object.keys(ranked).sort((a, b) => ranked[b] - ranked[a] || a.localeCompare(b));
  //   console.log("ranked is" )
  //   console.log(ranked);
  //   const rel_fnames = ranked.flat();

  //   const tokens = [];
  //   const listing = [];



  //   rel_fnames.forEach(rel_fname => {
  //     console.log(rel_fname)
  //     const fileContent = fs.readFileSync(path.join(this.root, rel_fname), 'utf-8');
  //     // const tokenCount = fileContent.split(/\s+/).length;
  //     // if (tokens + tokenCount >= target_tokens) return;

  //     listing.push(rel_fname);
  //     listing.push(fileContent);
  //     // tokens += tokenCount;
  //   });

  //   return listing.join('\n\n');
  // }
}
module.exports = {
  RepoMap
}