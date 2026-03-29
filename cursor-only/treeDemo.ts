//-----------------------------------------
// treeDemo.ts
//
// treeDemo.js version was by Alan G. Labouseur, based on the
// 2009 work by Michael Ardizzone and Tim Smith.
// 
// This version has been modified to use TypeScript instead of JS by Cursor AI.
//-----------------------------------------

export interface TreeNode {
    name: string;
    children: TreeNode[];
    parent: TreeNode | Record<string, never>;
}

export class Tree {
    // ----------
    // Attributes
    // ----------

    root: TreeNode | null = null;  // Note the NULL root node of this tree.
    cur: Record<string, never> | TreeNode = {};     // Note the EMPTY current node of the tree we're building.

    // -- ------- --
    // -- Methods --
    // -- ------- --

    // Add a node: kind in {branch, leaf}.
    addNode(name: string, kind: string): void {
        // Construct the node object.
        const node: TreeNode = {
            name: name,
            children: [],
            parent: {},
        };

        // Check to see if it needs to be the root node.
        if (this.root == null || !this.root) {
            // We are the root node.
            this.root = node;
        } else {
            // We are the children.
            // Make our parent the CURrent node...
            node.parent = this.cur as TreeNode;
            // ... and add ourselves (via the unfrotunately-named
            // "push" function) to the children array of the current node.
            (this.cur as TreeNode).children.push(node);
        }
        // If we are an interior/branch node, then...
        if (kind == "branch") {
            // ... update the CURrent node pointer to ourselves.
            this.cur = node;
        }
    }

    // Note that we're done with this branch of the tree...
    endChildren(): void {
        // ... by moving "up" to our parent node (if possible).
        const cur = this.cur as TreeNode & { parent?: TreeNode | Record<string, never> | null };
        if (cur.parent !== null && cur.parent.name !== undefined) {
            this.cur = cur.parent as TreeNode;
        } else {
            // TODO: Some sort of error logging.
            // This really should not happen, but it will, of course.
        }
    }

    // Return a string representation of the tree.
    toString(): string {
        // Initialize the result string.
        let traversalResult = "";

        // Recursive function to handle the expansion of the nodes.
        function expand(node: TreeNode | null, depth: number): void {
            // Space out based on the current depth so
            // this looks at least a little tree-like.
            for (let i = 0; i < depth; i++) {
                traversalResult += "-";
            }

            // If there are no children (i.e., leaf nodes)...
            if (!node!.children || node!.children.length === 0) {
                // ... note the leaf node.
                traversalResult += "[" + node!.name + "]";
                traversalResult += "\n";
            } else {
                // There are children, so note these interior/branch nodes and ...
                traversalResult += "<" + node!.name + "> \n";
                // .. recursively expand them.
                for (let i = 0; i < node!.children.length; i++) {
                    expand(node!.children[i], depth + 1);
                }
            }
        }
        // Make the initial call to expand from the root.
        expand(this.root, 0);
        // Return the result.
        return traversalResult;
    }
}
