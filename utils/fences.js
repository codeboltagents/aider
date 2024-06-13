const fencesUtil = {
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
    }
}

const fencedata = {
    fences: [
        ["~~~", "~~~"],
        fencesUtil.wrap_fence("source"),
        fencesUtil.wrap_fence("code"),
        fencesUtil.wrap_fence("pre"),
        fencesUtil.wrap_fence("codeblock"),
        fencesUtil.wrap_fence("sourcecode"),
    ],
    
    getDefaultFence: function(){
        return this.fences[0];
    },
}


module.exports = {fencesUtil, fencedata};