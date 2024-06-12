export const fencesUtil = {
    choose_fence: function() {
        let all_content = "";
        for (let [_fname, content] of this.get_abs_fnames_content()) {
            all_content += content + "\n";
        }

        let good = false;
        let fence_open, fence_close;
        for ([fence_open, fence_close] of this.fences) {
            if (all_content.includes(fence_open) || all_content.includes(fence_close)) {
                continue;
            }
            good = true;
            break;
        }

        if (good) {
            this.fence = [fence_open, fence_close];
        } else {
            this.fence = this.fences[0];
            this.io.tool_error(
                `Unable to find a fencing strategy! Falling back to: ${this.fence[0]}...${this.fence[1]}`
            );
        }

        return;
    },
    wrap_fence: function (name) {
        return `<${name}>`, `</${name}>`;
    },
    fences: [
        ["~~~", "~~~"],
        this.wrap_fence("source"),
        this.wrap_fence("code"),
        this.wrap_fence("pre"),
        this.wrap_fence("codeblock"),
        this.wrap_fence("sourcecode"),
    ],
    DEFAULT_FENCE: this.fences[0],
}