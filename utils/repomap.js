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

    treeCache = {};
}