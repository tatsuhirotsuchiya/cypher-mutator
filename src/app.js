const { parse } = require("cypher-parser");

const { mutate } = require("./mutate.js");
const { build } = require("./build.js");

// 既知の問題
// 8進数 0o... 16進数 0x...
// サブクエリ WHERE EXISTS {...}, CALL {...}
// 関数に大文字が含まれるときの処理

// 余裕があれば改良したいポイント
// CASE節のmutate 最後のTHENとELSEを交換

async function get_ast(query) {
    const result = await parse({
        query: query,
        dumpAst: true,
        colorize: true
    });

    if (result.roots.length !== 1) {
        throw "Input only one query.";
    }

    return result.roots[0];
}

const mutation_operators =[
    "Arrow direction",
    "Label on nodes",
    "Label on relationships",
    "Variable-length relationship",
    "MATCH clause",
    "RETURN clause",
    "Trimming section",
    "ORDER BY clause",
    "CASE clause",
    "Predicate functions",
    "Aggregate functions",
    "Query concatenation",
    "Relational operator",
    "Logical operator",
    "Unary operator",
    "Mathematical functions",
    "Mathematical operator",
    "String-specific comparison operator",
    "List index",
    "NULL check predicates",
    "NULL in results",
    "Include NULLs"
];

(async () => {
    try {
        const query = process.argv[2];

        const ast = await get_ast(query);

        const param = {};
        for (const o of mutation_operators) {
            param[o] = true;
        }

        const ast_mutants = mutate(ast, param);
        const query_mutants = {};
        for (const key in ast_mutants) {
            query_mutants[key] = ast_mutants[key].map(build);
        }

        console.log("");
        console.log("[INPUT]");
        console.log("  " + build(ast));

        console.log("");
        console.log("[OUTPUT]");

        let count = 0;
        for (const key in query_mutants) {
            console.log("  KEY : " + key);
            for (const q of query_mutants[key]) {
                console.log("    " + q);
                count++;
            }
            console.log("");
        }

        console.log(count + " mutants were generated.");
        console.log("");

    } catch (e) {
        console.log(e);
    }
})();