module.exports.build = build;

function build(node) {
    switch (node.type) {
        // statement
        case "statement":
            if (node.options !== undefined && node.options.length > 0) {
                throw "Statement option is not supported.";
            }

            return build(node.body);

        // query
        case "query":
            if (node.options !== undefined && node.options.length > 0) {
                throw "Query option is not supported.";
            }

            return node.clauses.map(build).join(" ");

        // match
        case "match":
            if (node.hints !== undefined && node.hints.length > 0) {
                throw "Match hint is not supported.";
            }

            const s = node.optional ? "OPTIONAL MATCH " : "MATCH ";

            const predicate = node.predicate === undefined ? "" : " WHERE " + build(node.predicate);

            return s + build(node.pattern) + predicate;

        // pattern
        case "pattern":
            return node.paths.map(build).join(", ");

        // pattern path
        case "pattern-path":
            return node.elements.map(build).join("");

        case "named-path":
            return build(node.identifier) + " = " + build(node.path);

        case "shortest-path":
            const shortest = node.single ? "shortestPath" : "allShortestPaths";
            return shortest + "(" + build(node.path) + ")";

        // node pattern
        case "node-pattern":
            const node_identifier = node.identifier === undefined ? "" : build(node.identifier);

            const node_labels = node.labels.map(l => ":" + build(l)).join("");

            const node_properties = node.properties === undefined ? "" : " " + build(node.properties);

            return "(" + node_identifier + node_labels + node_properties + ")";

        // rel pattern
        case "rel-pattern":
            const left = node.direction === 0 ? "<-" : "-";
            const right = node.direction === 1 ? "->" : "-";

            const rel_identifier = node.identifier === undefined ? "" : build(node.identifier);

            let rel_labels = node.reltypes.map(build).join("|");
            if (rel_labels !== "") {
                rel_labels = ":".concat(rel_labels);
            }

            const rel_range = node.varLength === undefined ? "" : build(node.varLength);

            const rel_properties = node.properties === undefined ? "" : " " + build(node.properties);

            let id = rel_identifier + rel_labels + rel_range + rel_properties;
            if (id !== "") {
                id = "[".concat(id, "]");
            }

            return left + id + right;

        case "range":
            let r = "";

            if (node.start === node.end) {
                if (node.start !== null) {
                    r = node.start.toString();
                }
            } else {
                const start = node.start === null ? "" : node.start.toString();
                const end = node.end === null ? "" : node.end.toString();

                r = start + ".." + end;
            }

            return "*" + r;

        // clause
        case "return":
            const skip = node.skip === undefined ? "" : " SKIP " + build(node.skip);
            const limit = node.limit === undefined ? "" : " LIMIT " + build(node.limit);

            const orderBy = node.orderBy === undefined ? "" : " ORDER BY " + build(node.orderBy);

            let projections = node.projections.map(build).join(", ");
            if (node.includeExisting) {
                projections = projections === "" ? "*" : "*, ".concat(projections);
            }

            return (node.distinct ? "RETURN DISTINCT " : "RETURN ") + projections + orderBy + skip + limit;

        case "with":
            const skip_with = node.skip === undefined ? "" : " SKIP " + build(node.skip);
            const limit_with = node.limit === undefined ? "" : " LIMIT " + build(node.limit);

            const orderBy_with = node.orderBy === undefined ? "" : " ORDER BY " + build(node.orderBy);

            const projections_with = node.projections.map(build).join(", ");

            let predicate_with = node.predicate === undefined ? "" : " WHERE " + build(node.predicate);
            if (node.includeExisting) {
                predicate_with = predicate_with === "" ? "*" : "*, ".concat(predicate_with);
            }

            return (node.distinct ? "WITH DISTINCT " : "WITH ") + projections_with + predicate_with + orderBy_with + skip_with + limit_with;

        case "unwind":
            return "UNWIND " + build(node.expression) + " AS " + build(node.alias);

        case "union":
            return node.all ? "UNION ALL" : "UNION";

        case "call":
            const args = node.args.map(build).join(", ");

            let projections_call = node.projections.map(build).join(", ");
            if (projections_call !== "") {
                projections_call = " YIELD ".concat(projections_call);
            }

            return "CALL " + build(node.procName) + "(" + args + ")" + projections_call;

        // projection
        case "projection":
            const as = node.alias === undefined ? "" : " AS " + build(node.alias);

            return build(node.expression) + as;

        // order by
        case "order-by":
            return node.items.map(build).join(", ");

        // sort item
        case "sort-item":
            const asc = node.ascending ? " ASC" : " DESC";

            return build(node.expression) + asc;

        // expression
        case "unary-operator":
            const unary_ops_left = [];

            unary_ops_left["unary-plus"] = "+";
            unary_ops_left["unary-minus"] = "-";
            unary_ops_left["not"] = "NOT ";

            const unary_ops_right = [];

            unary_ops_right["is-null"] = "IS NULL";
            unary_ops_right["is-not-null"] = "IS NOT NULL";

            if (unary_ops_left[node.op] === undefined && unary_ops_right[node.op] === undefined) {
                throw node.type + " " + node.op + " is not supported.";
            }

            if (unary_ops_left[node.op] !== undefined) {
                return "(" + unary_ops_left[node.op] + build(node.arg) + ")";
            }
            return "(" + build(node.arg) + " " + unary_ops_right[node.op] + ")";

        case "binary-operator":
            const binary_ops = [];

            binary_ops["plus"] = "+";
            binary_ops["minus"] = "-";
            binary_ops["mult"] = "*";
            binary_ops["div"] = "/";
            binary_ops["mod"] = "%";
            binary_ops["pow"] = "^";

            binary_ops["equal"] = "=";
            binary_ops["not-equal"] = "<>";

            binary_ops["starts-with"] = "STARTS WITH";
            binary_ops["ends-with"] = "ENDS WITH";
            binary_ops["contains"] = "CONTAINS";
            binary_ops["regex"] = "=~";

            binary_ops["and"] = "AND";
            binary_ops["or"] = "OR";
            binary_ops["xor"] = "XOR";

            binary_ops["in"] = "IN";

            if (binary_ops[node.op] === undefined) {
                throw node.type + " " + node.op + " is not supported.";
            }

            return "(" + build(node.arg1) + " " + binary_ops[node.op] + " " + build(node.arg2) + ")";

        case "comparison":

            const comparison_ops = [];

            comparison_ops["less-than"] = "<";
            comparison_ops["greater-than"] = ">";
            comparison_ops["less-than-equal"] = "<=";
            comparison_ops["greater-than-equal"] = ">=";

            let c = "";

            for (let i = 0; i <= node.length; i++) {
                c = c.concat(build(node.args[i]));
                if (i !== node.length) {
                    if (comparison_ops[node.ops[i]] === undefined) {
                        throw node.type + " " + node.ops[i] + " is not supported.";
                    }
                    c = c.concat(" " + comparison_ops[node.ops[i]] + " ");
                }
            }

            return "(" + c + ")";

        case "apply-operator":
            const distinct = node.distinct ? "DISTINCT " : "";

            return build(node.funcName) + "(" + distinct + node.args.map(build).join(", ") + ")";

        case "apply-all-operator":
            return build(node.funcName) + "(" + (node.distinct ? "DISTINCT *" : "*") + ")";

        case "property-operator":
            return build(node.expression) + "." + build(node.propName);

        case "subscript-operator":
            return build(node.expression) + "[" + build(node.subscript) + "]";

        case "slice-operator":
            return build(node.expression) + "[" + (node.start === undefined ? "" : build(node.start)) + ".." + (node.end === undefined ? "" : build(node.end)) + "]";

        case "map-projection":
            return build(node.expression) + " {" + node.selectors.map(build).join(", ") + "}";

        case "map-projection-literal":
            return build(node.propName) + ": " + build(node.expression);

        case "map-projection-property":
            return "." + build(node.propName);

        case "map-projection-identifier":
            return build(node.identifier);

        case "map-projection-all-properties":
            return ".*";

        case "list-comprehension":
            const eval = node.eval === undefined ? "" : " | " + build(node.eval);
            const where = node.predicate === undefined ? "" : " WHERE " + build(node.predicate);

            return "[" + build(node.identifier) + " IN " + build(node.expression) + where + eval + "]";

        case "all":
        case "any":
        case "single":
        case "none":
        case "filter":
            return node.type + "(" + build(node.identifier) + " IN " + build(node.expression) + " WHERE " + build(node.predicate) + ")";

        case "pattern-comprehension":
            const id_pattern = node.identifier === undefined ? "" : build(node.identifier) + " = ";
            const where_pattern = node.predicate === undefined ? "" : " WHERE " + build(node.predicate);

            return "[" + id_pattern + build(node.pattern) + where_pattern + " | " + build(node.eval) + "]";

        case "case":
            const ex = node.expression === undefined ? "" : " " + build(node.expression);
            const w = node.alternatives === undefined ? "" : " " + node.alternatives.map(a => "WHEN " + build(a.predicate) + " THEN " + build(a.value)).join(" ");
            const e = node.default === undefined ? "" : " ELSE " + build(node.default);
            return "CASE" + ex + w + e + " END";

        case "reduce":
            return "reduce(" + build(node.accumulator) + " = " + build(node.init) + ", " + build(node.identifier) + " IN " + build(node.expression) + " | " + build(node.eval) + ")";

        case "collection":
            return "[" + node.elements.map(build).join(", ") + "]";

        case "map":
            return "{" + Object.entries(node.entries).map(([k, v]) => id_style(k) + ": " + build(v)).join(", ") + "}";

        case "identifier":
            return id_style(node.name);

        case "string":
            const str = node.value
                                .replace(/\\/g, "\\\\") // Escape backslash at first.
                                .replace(/\t/g, "\\t")
                                .replace(/[\b]/g, "\\b")
                                .replace(/\n/g, "\\n")
                                .replace(/\r/g, "\\r")
                                .replace(/\f/g, "\\f")
                                .replace(/\'/g, "\\'")
                                .replace(/\"/g, "\\\"");

            return "'" + str + "'";

        case "integer":
            return node.value.toString();

        case "float":
            return node.value.toString();

        case "true":
            return "TRUE";

        case "false":
            return "FALSE";

        case "null":
            return "NULL";

        case "labels-operator":
            return build(node.expression) + node.labels.map(l => ":" + build(l)).join("");

        // function name
        case "function-name":
            return id_style(node.value);

        // prop name
        case "prop-name":
            return id_style(node.value);

        // label
        case "label":
            return id_style(node.name);

        // rel type
        case "reltype":
            return id_style(node.name);

        // parameter
        case "parameter":
            return "$" + id_style(node.name);

        // proc name
        case "proc-name":
            return id_style(node.value);

        default:
            throw node.type + " is not supported.";
    }
}

function id_style(id) {
    if (id.match(/^(\p{ID_Start}|[_\u203F-\u2040\u2054\uFE33-\uFE34\uFE4D-\uFE4F\uFF3F])(\p{ID_Continue}|[$\u00A2-\u00A5\u058F\u060B\u09F2-\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BA\uA838\uFDFC\uFE69\uFF04\uFFE0-\uFFE1\uFFE5-\uFFE6])*$/u)) {
        return id;
    }
    return "`" + id + "`";
}