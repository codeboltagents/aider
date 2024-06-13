class repoMap {
    maxMapTokens= 1024;
    maxContextWindow=null;
    constructor(maxMapTokens = 1024, maxContextWindow=null) {
        this.maxMapTokens = maxMapTokens;
        this.maxContextWindow= maxContextWindow;
    }

    // Here Chat Files are the files already included in the chat, 
    // other files are the files that are passed. Ideally might be all tracked files.
    // Mentioned FileNames are the file Names mentioned in the chat.
    // Mentioned Identifiers are the identifiers mentioned in the chat.
    getRepoMap(chatFiles, otherFiles, mentionedFnames=[], mentionedIdents=[]) {
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

    getRankedTagsMap(chatFnames, otherFnames = [], maxMapTokens = this.maxMapTokens, mentionedFnames={}, mentionedIdents={}) {
        let rankedTags = this.getRankedTags(chatFnames, otherFnames, mentionedFnames, mentionedIdents);

        let numTags = rankedTags.length;
        let lowerBound = 0;
        let upperBound = numTags;
        let bestTree = null;
        let bestTreeTokens = 0;

        //TODO: Check
        let chatRelFnames = chatFnames.map(fname => this.getRelFname(fname));

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
    
    getRankedTags(chatFnames, otherFnames, mentionedFnames, mentionedIdents) {
        let defines = new Map();
        let references = new Map();
        let definitions = new Map();

        let fnames = new Set([...chatFnames, ...otherFnames]);
        let chatRelFnames = new Set();

        fnames = Array.from(fnames).sort();

        let personalize = 10 / fnames.length;

        for (let fname of fnames) {
            if (!fs.existsSync(fname) || !fs.lstatSync(fname).isFile()) {
                if (!this.warnedFiles.has(fname)) {
                    console.error(`Repo-map can't include ${fname}, it is not a normal file or it no longer exists`);
                    this.warnedFiles.add(fname);
                }
                continue;
            }

            let relFname = this.getRelFname(fname);

            if (chatFnames.includes(fname)) {
                personalization[relFname] = personalize;
                chatRelFnames.add(relFname);
            }

            if (mentionedFnames.includes(fname)) {
                personalization[relFname] = personalize;
            }

            let tags = this.getTags(fname, relFname);
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

        let G = new MultiDiGraph(); // You need to define or import MultiDiGraph class

        for (let ident of idents) {
            let definers = defines[ident];
            let mul = ident in mentionedIdents ? 10 : 1;
            let numRefs = this.count(references[ident]); // You need to define count function
            for (let definer of definers) {
                G.addEdge(referencer, definer, mul * numRefs, ident);
            }
        }

        let persArgs = Object.keys(personalization).length ? {personalization, dangling: personalization} : {};

        let ranked;
        try {
            ranked = G.pageRank("weight", persArgs); // You need to define or import pageRank function
        } catch (e) {
            if (e instanceof ZeroDivisionError) {
                return [];
            }
        }

        let rankedDefinitions = {};
        for (let src of G.nodes) {
            let srcRank = ranked[src];
            let totalWeight = G.outEdges(src, true).reduce((sum, edge) => sum + edge.data["weight"], 0);
            for (let edge of G.outEdges(src, true)) {
                edge.data["rank"] = srcRank * edge.data["weight"] / totalWeight;
                let ident = edge.data["ident"];
                rankedDefinitions[`${dst},${ident}`] += edge.data["rank"];
            }
        }

        let rankedTags = [];
        let rankedDefinitionsArr = Object.entries(rankedDefinitions).sort((a, b) => b[1] - a[1]);

        for (let [key, rank] of rankedDefinitionsArr) {
            let [fname, ident] = key.split(",");
            if (!chatRelFnames.has(fname)) {
                rankedTags.push(...definitions[`${fname},${ident}`]);
            }
        }

        let relOtherFnamesWithoutTags = otherFnames.map(fname => this.getRelFname(fname));
        let fnamesAlreadyIncluded = new Set(rankedTags.map(rt => rt[0]));

        let topRank = Object.entries(ranked).sort((a, b) => b[1] - a[1]);
        for (let [rank, fname] of topRank) {
            let index = relOtherFnamesWithoutTags.indexOf(fname);
            if (index !== -1) {
                relOtherFnamesWithoutTags.splice(index, 1);
            }
            if (!fnamesAlreadyIncluded.has(fname)) {
                rankedTags.push([fname]);
            }
        }

        for (let fname of relOtherFnamesWithoutTags) {
            rankedTags.push([fname]);
        }

        return rankedTags;
    }

    treeCache = {};
}