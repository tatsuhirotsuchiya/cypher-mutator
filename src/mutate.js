module.exports.mutate = mutate;

function mutate(root, param) {
    if (root.type !== "statement") {
        throw "Input statement.";
    }

    const mutants = {};

    // statement
    _mutate_node(root, root, "body", mutants, param);

    return mutants;
}

function _mutate_node(root, parent, prop, mutants, param) {
    const setter = (node) => {
        parent[prop] = node;
    }

    _mutate_node2(root, setter, parent[prop], mutants, param);
}

function _mutate_node2(root, replace_node_with, node, mutants, param) {

    const _add = (mutants, key, root) => {
        if ( param[key] !== undefined && param[key] ) {
            add(mutants, key, root);
        }
    };

    const mutate_child = (parent, child_name) => {
        _mutate_node(root, parent, child_name, mutants, param);
    }

    const mutate_children = (parent, children_name) => {
        for (i of Object.keys(parent[children_name])) {
            mutate_child(parent[children_name], i);
        }
    }

    switch (node.type) {
        case "integer":
        case "float":

        // -e
        replace_node_with({
            type: "unary-operator",
            arg: node,
            op: "unary-minus"
        });
        _add(mutants, "Unary operator", root);
        replace_node_with(node);

        // e + 1
        replace_node_with({
            type: "binary-operator",
            arg1: node,
            arg2: {
                type: "integer",
                value: 1
            },
            op: "plus"
        });
        _add(mutants, "Unary operator", root);
        replace_node_with(node);

        // e - 1
        replace_node_with({
            type: "binary-operator",
            arg1: node,
            arg2: {
                type: "integer",
                value: 1
            },
            op: "minus"
        });
        _add(mutants, "Unary operator", root);
        replace_node_with(node);

        // abs(e) ceil(e) floor(e) round(e) sign(e)
        const mfs = ["abs", "ceil", "floor", "round", "sign"];
        for (mf of mfs) {
            const n = {
                type: "apply-operator",
                args: [node],
                funcName: {
                    type: "function-name",
                    value: mf
                },
                distinct: false
            };

            // +
            replace_node_with(n);
            _add(mutants, "Mathematical functions", root);
            replace_node_with(node);

            // -
            replace_node_with({
                type: "unary-operator",
                arg: n,
                op: "unary-minus"
            });
            _add(mutants, "Mathematical functions", root);
            replace_node_with(node);
        }

        break;
    }

    switch (node.type) {
        // statement
        case "statement":
            mutate_children(node, "body");
            break;

        // query
        case "query":
            mutate_children(node, "clauses");

            // union
            for (let i = 0; i < node.clauses.length; i++) {
                if (node.clauses[i].type === "union") {
                    // union all
                    node.clauses[i].all = !node.clauses[i].all;
                    _add(mutants, "Query concatenation", root);
                    node.clauses[i].all = !node.clauses[i].all;

                    // delete left query
                    const [left, u1] = node.clauses.splice(i - 1, 2);
                    _add(mutants, "Query concatenation", root);
                    node.clauses.splice(i - 1, 0, left, u1);

                    // delete right query
                    const [u2, right] = node.clauses.splice(i, 2);
                    _add(mutants, "Query concatenation", root);
                    node.clauses.splice(i, 0, u2, right);
                }
            }

            break;

        // match
        case "match":
            if ( node.predicate !== undefined ) {
                mutate_child(node, "predicate");
            }
            mutate_child(node, "pattern");

            // optional match
            node.optional = !node.optional;
            _add(mutants, "MATCH clause", root);
            node.optional = !node.optional;

            break;

        // pattern
        case "pattern":
            mutate_children(node, "paths");
            break;

        // pattern path
        case "pattern-path":
            mutate_children(node, "elements");
            break;

        case "named-path":
            mutate_child(node, "identifier");
            mutate_child(node, "path");
            break;

        case "shortest-path":
            _mutate_child(node, "path");
            break;

        // node pattern
        case "node-pattern":
            if ( node.identifier !== undefined ) {
                mutate_child(node, "identifier");
            }

            mutate_children(node, "labels");

            if ( node.properties !== undefined ) {
                mutate_child(node, "properties");
            }

            // ノードのラベルを削除
            for (let i = 0; i < node.labels.length; i++) {
                const [e] = node.labels.splice(i, 1);
                _add(mutants, "Label on nodes", root);
                node.labels.splice(i, 0, e);
            }

            break;

        // rel pattern
        case "rel-pattern":
            if ( node.identifier !== undefined ) {
                mutate_child(node, "identifier");
            }

            mutate_children(node, "reltypes");

            if ( node.varLength !== undefined ) {
                mutate_child(node, "varLength");
            }

            if ( node.properties !== undefined ) {
                mutate_child(node, "properties");
            }

            // 矢印の方向を変更
            const d = node.direction;
            for (let i = 0; i < 3; i++) {
                if (d === i) {
                    continue;
                }
                node.direction = i;
                _add(mutants, "Arrow direction", root);
            }
            node.direction = d;

            // リレーションシップのラベルを削除
            for (let i = 0; i < node.reltypes.length; i++) {
                const [e] = node.reltypes.splice(i, 1);
                _add(mutants, "Label on relationships", root);
                node.reltypes.splice(i, 0, e);
            }

            break;

        case "range":
            if (node.start !== undefined && node.end !== undefined) {
                const s = node.start;
                const e = node.end;

                node.start = null;
                node.end = null;
                _add(mutants, "Variable-length relationship", root);

                node.start = s;
                _add(mutants, "Variable-length relationship", root);

                node.start = null;
                node.end = e;
                _add(mutants, "Variable-length relationship", root)

                node.start = s;
                node.end = s;
                _add(mutants, "Variable-length relationship", root);

                node.start = e;
                node.end = e;
                _add(mutants, "Variable-length relationship", root);

                node.start = s;
                node.end = e;
            }
            break;

        // clause
        case "return":
            if ( node.skip !== undefined ) {
                mutate_child(node, "skip");
            }

            if ( node.limit !== undefined ) {
                mutate_child(node, "limit");
            }

            if ( node.orderBy !== undefined ) {
                mutate_child(node, "orderBy");
            }

            mutate_children(node, "projections");

            for (p of node.projections) {
                const e = p.expression;
                p.expression = {type: "case", alternatives: [{predicate: {type: "unary-operator", arg: e, op: "is-null"}, value: {type: "integer", value: 0}}], default: e};
                _add(mutants, "NULL in results", root);
                p.expression = e;
            }

            if ( node.orderBy !== undefined ) {
                mutate_child(node, "orderBy");

                if (node.orderBy.items.length === 1) {
                    // ソート要素が一つのときはorder by構文ごと消す
                    const ob = node.orderBy;

                    delete node.orderBy;
                    _add(mutants, "ORDER BY clause", root);
                    node.orderBy = ob;
                } else {
                    // 2つ以上のとき
                    // 要素を消す
                    for (let i = 0; i < node.orderBy.items.length; i++) {
                        const [e] = node.orderBy.items.splice(i, 1);
                        _add(mutants, "ORDER BY clause", root);
                        node.orderBy.items.splice(i, 0, e);
                    }

                    // 隣り合う要素を入れ替える
                    for (let i = 0; i < node.orderBy.items.length - 1; i++) {
                        const t = node.orderBy.items[i];
                        node.orderBy.items[i] = node.orderBy.items[i + 1];
                        node.orderBy.items[i + 1] = t;

                        _add(mutants, "ORDER BY clause", root);

                        node.orderBy.items[i + 1] = node.orderBy.items[i];
                        node.orderBy.items[i] = t;
                    }
                }

                // ASC DESC
                for (let i = 0; i < node.orderBy.items.length; i++) {
                    node.orderBy.items[i].ascending = !node.orderBy.items[i].ascending
                    _add(mutants, "ORDER BY clause", root);
                    node.orderBy.items[i].ascending = !node.orderBy.items[i].ascending
                }
            }

            // return distinct
            node.distinct = !node.distinct;
            _add(mutants, "RETURN clause", root);
            node.distinct = !node.distinct;

            // skip limit
            if ( node.skip !== undefined && node.limit !== undefined ) {
                // swap
                const s = node.skip;
                const l = node.limit;

                node.skip = l;
                node.limit = s;

                _add(mutants, "Trimming section", root);

                // delete all

                delete node.skip;
                delete node.limit;

                _add(mutants, "Trimming section", root);

                // delete skip

                node.limit = l;
                _add(mutants, "Trimming section", root);

                // delete limit

                node.skip = s;
                delete node.limit;

                _add(mutants, "Trimming section", root);

                node.limit = l;
            } else if ( node.skip !== undefined ) {
                // delete all
                const s = node.skip;

                delete node.skip;
                _add(mutants, "Trimming section", root);

                // swap
                node.limit = s;
                _add(mutants, "Trimming section", root);

                node.skip = s;
                delete node.limit;
            } else if ( node.limit !== undefined ) {
                // delete all
                const l = node.limit;

                delete node.limit;
                _add(mutants, "Trimming section", root);

                // swap
                node.skip = l;
                _add(mutants, "Trimming section", root);

                node.limit = l;
                delete node.skip;
            }
            break;

        case "with":
            if ( node.skip !== undefined ) {
                mutate_child(node, "skip");
            }

            if ( node.limit !== undefined ) {
                mutate_child(node, "limit");
            }

            if ( node.orderBy !== undefined ) {
                mutate_child(node, "orderBy");
            }

            mutate_children(node, "projections");

            if ( node.predicate !== undefined ) {
                mutate_child(node, "predicate");
            }

            if ( node.orderBy !== undefined ) {
                mutate_child(node, "orderBy");

                if (node.orderBy.items.length === 1) {
                    // ソート要素が一つのときはorder by構文ごと消す
                    const ob = node.orderBy;

                    delete node.orderBy;
                    _add(mutants, "ORDER BY clause", root);
                    node.orderBy = ob;
                } else {
                    // 2つ以上のとき
                    // 要素を消す
                    for (let i = 0; i < node.orderBy.items.length; i++) {
                        const [e] = node.orderBy.items.splice(i, 1);
                        _add(mutants, "ORDER BY clause", root);
                        node.orderBy.items.splice(i, 0, e);
                    }

                    // 隣り合う要素を入れ替える
                    for (let i = 0; i < node.orderBy.items.length - 1; i++) {
                        const t = node.orderBy.items[i];
                        node.orderBy.items[i] = node.orderBy.items[i + 1];
                        node.orderBy.items[i + 1] = t;

                        _add(mutants, "ORDER BY clause", root);

                        node.orderBy.items[i + 1] = node.orderBy.items[i];
                        node.orderBy.items[i] = t;
                    }
                }

                // ASC DESC
                for (let i = 0; i < node.orderBy.items.length; i++) {
                    node.orderBy.items[i].ascending = !node.orderBy.items[i].ascending
                    _add(mutants, "ORDER BY clause", root);
                    node.orderBy.items[i].ascending = !node.orderBy.items[i].ascending
                }
            }

            break;

        case "unwind":
            mutate_child(node, "expression");
            mutate_child(node, "alias");
            break;

        case "union":

            break;

        case "call":
            mutate_children(node, "args");
            mutate_children(node, "projections");
            mutate_child(node, "procName");

            break;

        // projection
        case "projection":
            if ( node.alias !== undefined ) {
                mutate_child(node, "alias");
            }

            mutate_child(node, "expression");

            break;

        // order by
        case "order-by":
            mutate_children(node, "items");

            break;

        // sort item
        case "sort-item":
            mutate_child(node, "expression");

            break;

        // expression
        case "unary-operator":
            mutate_child(node, "arg");

            const null_ops = ["is-null", "is-not-null"];
            if (null_ops.includes(node.op)) {
                const nop = node.op;

                for (o of null_ops) {
                    if (o === nop) {
                        continue;
                    }
                    node.op = o;
                    _add(mutants, "NULL check predicates", root);
                }

                node.op = nop;
            }
            break;

        case "binary-operator":
            mutate_child(node, "arg1");
            mutate_child(node, "arg2");

            // relational operator
            const cbops = ["equal", "not-equal"];

            if ( cbops.includes(node.op) ) {
                const o = node.op;

                // Include NULLs
                const n = node;
                replace_node_with({type: "binary-operator", arg1: n, arg2: {type: "unary-operator", arg: n.arg1, op: "is-null"}, op: "or"});
                _add(mutants, "Include NULLs", root);
                replace_node_with({type: "binary-operator", arg1: n, arg2: {type: "unary-operator", arg: n.arg2, op: "is-null"}, op: "or"});
                _add(mutants, "Include NULLs", root);
                replace_node_with(n);

                // binary operator -> binary operator

                for (cbop of cbops) {
                    if ( o === cbop ) {
                        continue;
                    }
                    node.op = cbop;
                    _add(mutants, "Relational operator", root);
                }

                node.op = o;

                // binary operator -> comparison
                const a1 = node.arg1;
                const a2 = node.arg2;
                const t2 = node.type;

                delete node.arg1;
                delete node.arg2;
                delete node.op;

                node.type = "comparison";

                node.args = [a1, a2];
                node.length = 1;

                const bops = ["less-than", "greater-than", "less-than-equal", "greater-than-equal"];

                for (bop of bops) {
                    node.ops = [bop];
                    _add(mutants, "Relational operator", root);
                }

                delete node.args;
                delete node.length;
                delete node.ops;

                node.type = t2;
                node.arg1 = a1;
                node.arg2 = a2;
                node.op = o;

                // binary operator -> TRUE FALSE
                delete node.arg1;
                delete node.arg2;
                delete node.op;

                node.type = "true";
                _add(mutants, "Relational operator", root);

                node.type = "false";
                _add(mutants, "Relational operator", root);

                node.type = t2;
                node.arg1 = a1;
                node.arg2 = a2;
                node.op = o;
            }

            // logical operator
            const logical_ops = ["and", "or", "xor"];

            if (logical_ops.includes(node.op)) {
                const nop = node.op;

                // 演算子を置き換える
                for (o of logical_ops) {
                    if (o === nop) {
                        continue;
                    }
                    node.op = o;
                    _add(mutants, "Logical operator", root);
                }

                node.op = nop;

                // 式をTRUE FALSEに置き換える
                const a1 = node.arg1;
                const a2 = node.arg2;
                const t = node.type;

                delete node.arg1;
                delete node.arg2;
                delete node.op;

                node.type = "true";
                _add(mutants, "Logical operator", root);

                node.type = "false";
                _add(mutants, "Logical operator", root);

                node.type = t;
                node.arg1 = a1;
                node.arg2 = a2;
                node.op = nop;

                // 式をarg1 arg2に置き換える
                delete node.type;
                delete node.arg1;
                delete node.arg2;
                delete node.op;

                for ( p in a1 ) {
                    node[p] = a1[p];
                }
                _add(mutants, "Logical operator", root);
                for ( p in node ) {
                    delete node[p];
                }

                for ( p in a2 ) {
                    node[p] = a2[p];
                }
                _add(mutants, "Logical operator", root);
                for ( p in node ) {
                    delete node[p];
                }

                node.type = t;
                node.arg1 = a1;
                node.arg2 = a2;
                node.op = nop;
            }

            // mathemetical operator
            const math_ops = ["plus", "minus", "mult", "div", "mod", "pow"];
            if (math_ops.includes(node.op)) {
                const nop = node.op;

                for (o of math_ops) {
                    if (o === nop) {
                        continue;
                    }
                    node.op = o;
                    _add(mutants, "Mathematical operator", root);
                }

                node.op = nop;

                // 式をarg1 arg2に置き換える
                const a1 = node.arg1;
                const a2 = node.arg2;
                const t = node.type;

                delete node.type;
                delete node.arg1;
                delete node.arg2;
                delete node.op;

                for ( p in a1 ) {
                    node[p] = a1[p];
                }
                _add(mutants, "Mathematical operator", root);
                for ( p in node ) {
                    delete node[p];
                }

                for ( p in a2 ) {
                    node[p] = a2[p];
                }
                _add(mutants, "Mathematical operator", root);
                for ( p in node ) {
                    delete node[p];
                }

                node.type = t;
                node.arg1 = a1;
                node.arg2 = a2;
                node.op = nop;
            }

            // string-specific coparison operator
            const str_ops = ["starts-with", "ends-with", "contains", "regex"];
            if (str_ops.includes(node.op)) {
                const nop = node.op;

                for (o of str_ops) {
                    if (o === nop) {
                        continue;
                    }
                    node.op = o;
                    _add(mutants, "String-specific comparison operator", root);
                }

                node.op = nop;
            }

            break;

        case "comparison":
            mutate_children(node, "args");

            // Include NULLs
            if ( node.args.length === 2 ) {
                const n = node;
                replace_node_with({type: "binary-operator", arg1: n, arg2: {type: "unary-operator", arg: n.args[0], op: "is-null"}, op: "or"});
                _add(mutants, "Include NULLs", root);
                replace_node_with({type: "binary-operator", arg1: n, arg2: {type: "unary-operator", arg: n.args[1], op: "is-null"}, op: "or"});
                _add(mutants, "Include NULLs", root);
                replace_node_with(n);
            }

            // relational operator
            // comparison -> comparison
            for (let i = 0; i < node.ops.length; i++) {
                const no = node.ops[i];
                for (o of ["less-than", "greater-than", "less-than-equal", "greater-than-equal"]) {
                    if (no === o) {
                        continue;
                    }
                    node.ops[i] = o;
                    _add(mutants, "Relational operator", root);
                }
                node.ops[i] = no;
            }

            // comparison -> binary operator
            // node.args.length === 2 のときだけ
            if ( node.args.length === 2 ) {
                const t = node.type;
                const o = node.ops;
                const l = node.length;
                const a = node.args;

                delete node.ops;
                delete node.length;
                delete node.args;

                node.type = "binary-operator";

                node.arg1 = a[0];
                node.arg2 = a[1];

                const bops = ["equal", "not-equal"];

                for (bop of bops) {
                    node.op = bop;
                    _add(mutants, "Relational operator", root);
                }

                delete op;
                delete arg1;
                delete arg2;

                node.type = t;
                node.ops = o;
                node.length = l;
                node.args = a;
            }

            // comparison -> TRUE FALSE

            const tt = node.type;
            const ot = node.ops;
            const lt = node.length;
            const at = node.args;

            delete node.ops;
            delete node.length;
            delete node.args;

            node.type = "true";
            _add(mutants, "Relational operator", root);

            node.type = "false";
            _add(mutants, "Relational operator", root);

            node.type = tt;
            node.ops = ot;
            node.length = lt;
            node.args = at;

            break;

        case "apply-operator":
            mutate_child(node, "funcName");
            mutate_children(node, "args");

            // Aggregate functions
            const f = function(funcName, afs) {
                const v = funcName.value;

                for (af of afs) {
                    if (af === v) {
                        continue;
                    }
                    funcName.value = af;
                    _add(mutants, "Aggregate functions", root);
                }

                funcName.value = v;
            }

            const afs1 = ["avg", "sum"];
            if ( afs1.includes(node.funcName.value) ) {
                f(node.funcName, afs1);
            }

            const afs2 = ["stDev", "stDevP"];
            if ( afs2.includes(node.funcName.value) ) {
                f(node.funcName, afs2);
            }

            const afs3 = ["collect", "max", "min"];
            if ( afs3.includes(node.funcName.value) ) {
                f(node.funcName, afs3);
            }

            const afs4 = ["percentileCont", "percentileDisc"];
            if ( afs4.includes(node.funcName.value) ) {
                f(node.funcName, afs4);
            }

            if ( node.funcName.value === "count" ) {
                node.distinct = ! node.distinct;
                _add(mutants, "Aggregate functions", root);
                node.distinct = ! node.distinct;
            }

            // Mathematical functions
            const mfs = ["abs", "ceil", "floor", "round", "sign"];
            if ( mfs.includes(node.funcName.value) ) {
                const v = node.funcName.value;

                for (mf of mfs) {
                    if (mf === node.funcName.value) {
                        continue;
                    }
                    node.funcName.value = mf;
                    _add(mutants, "Mathematical functions", root);
                }

                node.funcName.value = v;
            }
            break;

        case "apply-all-operator":
            mutate_child(node, "funcName");
            break;

        case "property-operator":
            mutate_child(node, "expression");
            mutate_child(node, "propName");

            break;

        case "subscript-operator":
            mutate_child(node, "expression");
            mutate_child(node, "subscript");

            break;

        case "slice-operator":
            mutate_child(node, "expression");

            if ( node.start !== undefined ) {
                mutate_child(node, "start");
            }

            if ( node.end !== undefined ) {
                mutate_child(node, "end");
            }

            if ( node.start !== undefined && node.end !== undefined ) {
                const s = node.start;
                const e = node.end;

                delete node.start;
                _add(mutants, "List index", root);

                node.start = s;
                delete node.end;
                _add(mutants, "List index", root);

                node.end = e;
            }

            break;

        case "map-projection":
            mutate_child(node, "expression");

            mutate_children(node, "selectors");

            break;

        case "map-projection-literal":
            mutate_child(node, "propName");
            mutate_child(node, "expression");

            break;

        case "map-projection-property":
            mutate_child(node, "propName");

            break;

        case "map-projection-identifier":
            mutate_child(node, "identifier");

            break;

        case "map-projection-all-properties":
            break;

        case "list-comprehension":
            if ( node.eval !== undefined ) {
                mutate_child(node, "eval");
            }

            if ( node.predicate !== undefined ) {
                mutate_child(node, "predicate");
            }

            mutate_child(node, "identifier");
            mutate_child(node, "expression");

            break;

        case "all":
        case "any":
        case "single":
        case "none":
        case "filter":
            mutate_child(node, "identifier");
            mutate_child(node, "expression");
            mutate_child(node, "predicate");

            // predicate function
            const t = node.type;
            const pfs = ["all", "any", "none", "single"];

            if ( pfs.includes(t) ) {
                for (pf of pfs) {
                    if (pf === t) {
                        continue;
                    }
                    node.type = pf;
                    _add(mutants, "Predicate functions", root);
                }
                node.type = t;
            }

            break;

        case "pattern-comprehension":
            if ( node.identifier !== undefined ) {
                mutate_child(node, "identifier");
            }

            if ( node.predicate !== undefined ) {
                mutate_child(node, "predicate");
            }

            mutate_child(node, "pattern");
            mutate_child(node, "eval");

            break;

        case "case":
            if ( node.expression !== undefined ) {
                mutate_child(node, "expression");
            }

            if ( node.alternatives !== undefined ) {
                for (na of node.alternatives) {
                    mutate_child(na, "predicate");
                    mutate_child(na, "value");
                }
            }

            if ( node.default !== undefined ) {
                mutate_child(node, "default");
            }

            if ( node.alternatives !== undefined && node.alternatives.length >= 2 ) {
                // case when節を消す
                for (let i = 0; i < node.alternatives.length; i++) {
                    const [e] = node.alternatives.splice(i, 1);
                    _add(mutants, "CASE clause", root);
                    node.alternatives.splice(i, 0, e);
                }

                // swap
                for (let i = 0; i < node.alternatives.length - 1; i++) {
                    const t = node.alternatives[i].value;
                    node.alternatives[i].value = node.alternatives[i + 1].value;
                    node.alternatives[i + 1].value = t;
                    _add(mutants, "CASE clause", root);

                    node.alternatives[i + 1].value = node.alternatives[i].value;
                    node.alternatives[i].value = t;
                }
            }

            // default節を消す
            if ( node.default !== undefined ) {
                const nd = node.default;
                delete node.default;
                _add(mutants, "CASE clause", root);
                node.default = nd;
            }

            break;

        case "reduce":
            mutate_child(node, "accumulator");
            mutate_child(node, "init");
            mutate_child(node, "identifier");
            mutate_child(node, "expression");
            mutate_child(node, "eval");

            break;

        case "collection":
            mutate_children(node, "elements");

            break;

        case "map":
            mutate_children(node, "entries");

            break;

        case "identifier":
            break;

        case "string":
            break;

        case "integer":
            break;

        case "float":
            break;

        case "true":
            break;

        case "false":
            break;

        case "null":
            break;

        case "labels-operator":
            mutate_child(node, "expression");
            mutate_children(node, "labels");

            break;

        case "function-name":
            break;

        case "prop-name":
            break;

        case "label":
            break;

        // rel type
        case "reltype":
            break;

        // parameter
        case "parameter":
            break;

        // proc name
        case "proc-name":
            break;

        default:
            break;
    }
}

function add(mutants, key, root) {
    if (mutants[key] === undefined) {
        mutants[key] = [];
    }

    mutants[key].push(JSON.parse(JSON.stringify(root)));
}