const fs = require('fs');
const path = require('path');
const TreeSitter = require('tree-sitter');
const TreeSitterPython = require('tree-sitter-python');
const TreeSitterTypeScript = require('tree-sitter-typescript')
const TreeSitterJavaScript = require('tree-sitter-javascript'); // Add more languages as needed
const networkjs = require('networkjs'); // Replace with actual library import
// const fs = require('fs');
// const path = require('path');
const math = require('mathjs');


// const _ = require('lodash');
// const { Counter } = require('collections');
const {
  MultiDirectedGraph,
  DirectedGraph
} = require('graphology');
// const pagerank = require('graphology-pagerank');
const pagerank = require('graphology-metrics/centrality/pagerank');

const _ = require('lodash');
const TreeContext = require('./treeHelper/grep_ast');
const { file } = require('tmp');
const { encode } = require('punycode');

class Tag {
  constructor({ rel_fname, fname, line, name, kind }) {
    this.rel_fname = rel_fname;
    this.fname = fname;
    this.line = line;
    this.name = name;
    this.kind = kind;
  }
}


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

  constructor(map_tokens = 8000, root = null, main_model = null, io = null, repo_content_prefix = null, verbose = false, max_context_window = null) {
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
    let code = fs.readFileSync(abs_fname, 'utf8') || "";
    if (!code.endsWith("\n")) {
      code += "\n";
    }

    const context = new TreeContext(
      rel_fname,
      code,
      false,
       false,
      false,
      false,
      0,
       false,
      0,
      // header_max: 30,
       false
    );

    context.add_lines_of_interest(lois);
    context.add_context();
    const res = context.format();
    this.tree_cache.set(key, res);
    return res;
  }

  to_tree(tags, chat_rel_fnames) {
    if (!tags || tags.length === 0) {
      return "";
    }

    let cur_fname = null;
    let cur_abs_fname = null;
    let lois = null;
    let output = "";

    // Add a bogus tag at the end so we trip the this_fname != cur_fname...
    const dummy_tag = [null];
    const all_tags = [...tags, dummy_tag];

    for (const tag of all_tags) {
      const this_rel_fname = tag.rel_fname;
      console.log("_______________________________________________________________");
      console.log(cur_fname);

      if (chat_rel_fnames.includes(this_rel_fname)) {
        continue;
      }

      // ... here ... to output the final real entry in the list
      console.log("_______________________________________________________________");
      console.log(cur_fname);

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

    // Truncate long lines, in case we get minified js or something else crazy
    output = output.split('\n').map(line => line.slice(0, 100)).join('\n') + "\n";

    return output;
  }

  async get_repo_map(chat_files, other_files, mentioned_fnames = [], mentioned_idents = []) {
    if (this.max_map_tokens <= 0 || !other_files.length) return;

    const max_map_tokens = this.max_map_tokens;
    const MUL = 16;
    const padding = 4096;
    const target = Math.min(max_map_tokens * MUL, this.max_context_window - padding);

    let files_listing;
    try {
      files_listing = await this.get_ranked_tags_map(chat_files, other_files, target, mentioned_fnames, mentioned_idents);
    } catch (err) {
      if (err instanceof RangeError) {
        this.io.tool_error('Disabling repo map, git repo too large?');
        this.max_map_tokens = 0;
        return;
      }
      throw err;
    }

    if (!files_listing) return;

    const num_tokens = encode(files_listing).length // this.token_count(files_listing);
    if (this.verbose) {
      console.error(`Repo-map: ${(num_tokens / 1024).toFixed(1)} k-tokens`);
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
    this.TAGS_CACHE.set(cache_key, { mtime: file_mtime, data });
    this.TAGS_CACHE = new Cache(cachePath);
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
    console.log(captures)
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
        console.log(tag)
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
      results.push(new Tag(result));
    }

    if (saw.has('ref')) return results;
    if (!saw.has('def')) return results;

    const tokens = code.match(/\b\w+\b/g) || [];

    for (const token of tokens) {
      results.push(new Tag({
        rel_fname: rel_fname,
        fname: fname,
        name: token,
        kind: 'ref',
        line: -1,
      }));
    }

    return results;
    

    // Token extraction logic here (e.g., from a lexer)

  }




  // const path = require('path');
  // const fs = require('fs');
  // const Graph = require('graphology');
  // const {pagerank} = require('graphology-metrics');
  // const {Counter} = require('collections');

  async get_ranked_tags(
    chat_fnames, other_fnames, mentioned_fnames, mentioned_idents, progress = null
  ) {
    const defines = new Map();
    const references = new Map();
    const definitions = new Map();
    const personalization = new Map();

    const fnames = new Set([...chat_fnames, ...other_fnames]);
    const chat_rel_fnames = new Set();
    const sorted_fnames = Array.from(fnames).sort();

    const personalize = 100 / sorted_fnames.length;

    let showing_bar = false;
    if (sorted_fnames.length - this.TAGS_CACHE.length > 100) {
      console.log("Initial repo scan can be slow in larger repos, but only happens once.");
      showing_bar = true;
    }

    for (const fname of sorted_fnames) {
      if (progress && !showing_bar) {
        progress();
      }

      if (!fs.existsSync(fname)) {
        if (!this.warned_files.has(fname)) {
          if (fs.existsSync(fname)) {
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

      if (mentioned_fnames.includes(rel_fname)) {
        personalization.set(rel_fname, personalize);
      }

      const tags = this.get_tags(fname, rel_fname);
      if (!tags) {
        continue;
      }

      for (const tag of tags) {
        if (tag.kind === "def") {
          if (!defines.has(tag.name)) {
            defines.set(tag.name, new Set());
          }
          defines.get(tag.name).add(rel_fname);

          const key =JSON.stringify([rel_fname, tag.name]);
          if (!definitions.has(key)) {
            definitions.set(key, new Set());
          }
          definitions.get(key).add(tag);

        } else if (tag.kind === "ref") {
          if (!references.has(tag.name)) {
            references.set(tag.name, []);
          }
          references.get(tag.name).push(rel_fname);
        }
      }
    }

    if (references.size === 0) {
      for (const [key, value] of defines.entries()) {
        references.set(key, Array.from(value));
      }
    }

    const idents = new Set([...defines.keys()].filter(x => references.has(x)));
    const G = new MultiDirectedGraph();

    for (const ident of idents) {
      if (progress) {
        progress();
      }

      const definers = defines.get(ident);
      let mul = 1;
      if (mentioned_idents.includes(ident)) {
        mul = 10;
      } else if (ident.startsWith("_")) {
        mul = 0.1;
      }

      const ref_counts = new Counter(references.get(ident));
      for (const [referencer, num_refs] of ref_counts.entries()) {
        for (const definer of definers) {
          // Ensure both referencer and definer are added to the graph
          if (!G.hasNode(referencer)) {
            G.addNode(referencer);
          }
          if (!G.hasNode(definer)) {
            G.addNode(definer);
          }

          const scaled_num_refs = Math.sqrt(num_refs);
          G.addEdge(referencer, definer, {
            weight: mul * scaled_num_refs,
            ident,
            source:referencer,
            target:definer
          });
        }

      }
    }

    const pers_args = personalization.size ? {
      personalization: Array.from(personalization.entries()).reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {}),
      dangling: Array.from(personalization.entries()).reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {})
    } : {};

    let ranked;
    try {
      ranked = pagerank(G, {
        weight: "weight",
        ...pers_args
      });
    } catch (e) {
      return [];
    }

    const ranked_definitions = new Map();
    for (const src of G.nodes()) {
      if (progress) {
        progress();
      }

      const src_rank = ranked[src];
      console.log(G.outEdges(src))
      
      let outEdges = G.outEdges(src)
      let total_weight=0;
      G.forEachEdge((edge, attributes) => {
        if(attributes.source==src){
          if (attributes.weight) {
            total_weight += attributes.weight;
          }
        }
        
          
        
      });
      //   const total_weight = outEdges.reduce((sum, edge) => {
      //     // edge is an array of [source, target, edgeId]
      //     const [, , edgeId] = edge;

      //     // Debug: Print edgeId to ensure it's correct
      //     console.log('Edge ID:', edgeId);

      //     // Check if the edgeId exists in the graph
      //     if (G.hasEdge(edgeId)) {
      //         // Retrieve the weight attribute using edgeId
      //         const weight = G.getEdgeAttribute(edgeId, 'weight');
      //         return sum + (weight || 0); // Default to 0 if weight is undefined
      //     } else {
      //         console.warn(`Edge ID ${edgeId} not found in the graph.`);
      //         return sum;
      //     }
      // }, 0);





      G.forEachEdge((edge, attributes) => {
       
        if(attributes.source==src){
          const weight = attributes.weight || 0;
          const rank = src_rank * weight / total_weight;
          const ident = attributes.ident;
          const key = JSON.stringify([attributes.source, ident]);
          ranked_definitions.set(key, (ranked_definitions.get(key) || 0) + rank);
        }
      });
    }

    const ranked_tags = [];
    const sorted_ranked_definitions = Array.from(ranked_definitions.entries()).sort((a, b) => b[1] - a[1]);
    console.log
    for (const [fname, ident] of sorted_ranked_definitions) {
      if (chat_rel_fnames.has(fname)) {
        continue;
      }
      console.log(fname)
      console.log(definitions)
      const key = fname
      const tags = definitions.get(key) || [];
      ranked_tags.push(...(definitions.get(key) || []));
    }

    const rel_other_fnames_without_tags = new Set(other_fnames.map(fname => this.get_rel_fname(fname)));

    const fnames_already_included = new Set(ranked_tags.map(rt => rt.rel_fname));

    const top_rank = Array.from(Object.entries(ranked)).sort((a, b) => b[1] - a[1]);
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
    chat_fnames = [],
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
    let middle  = Math.min(Math.floor(max_map_tokens / 25), num_tags);

    this.tree_cache = {}; // Change `treeCache` to `tree_cache`
    // .slice(0, middle)
    while (lower_bound <= upper_bound) {
      const tree = this.to_tree(ranked_tags, chat_rel_fnames);
      const num_tokens = 100 //this.token_count(tree);

      // if (num_tokens < max_map_tokens && num_tokens > best_tree_tokens) {
        best_tree = tree;
        best_tree_tokens = num_tokens;
      // }
      upper_bound = upper_bound - 1;
      // if (num_tokens < max_map_tokens) {
      //   lower_bound = upper_bound + 1;
      // } else {
      //   upper_bound = upper_bound - 1;
      // }

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