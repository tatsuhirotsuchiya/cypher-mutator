const { parse } = require("cypher-parser");

const { mutate } = require("./mutate.js");
const { build } = require("./build.js");

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

async function test(query, key, mutants) {
    try {
        const ast = await get_ast(query);

        const param = {};
        param[key] = true;

        const ast_mutants = mutate(ast, param);

        if ( ast_mutants[key] === undefined ) {
            ast_mutants[key] = [];
        }
        const query_mutants = ast_mutants[key].map(build);

        mutants.sort();
        query_mutants.sort();

        if (JSON.stringify(mutants) === JSON.stringify(query_mutants)) {
            console.log("OK", query);
        } else {
            console.log("\u001b[31m" + "NG" + "\u001b[0m", query);
            console.log(mutants);
            console.log(query_mutants);
        }

    } catch (e) {
        console.log(e);
    }
}

(async () => {
    console.log("");

    // Key: Arrow direction
    await test(
        "MATCH (a)-->(b) RETURN a",
        "Arrow direction",
        [
            "MATCH (a)<--(b) RETURN a",
            "MATCH (a)--(b) RETURN a"
        ]
    );

    // Key: Label on nodes
    await test(
        "MATCH (a:L1:L2:L3) RETURN a",
        "Label on nodes",
        [
            "MATCH (a:L1:L2) RETURN a",
            "MATCH (a:L1:L3) RETURN a",
            "MATCH (a:L2:L3) RETURN a"
        ]
    );

    // Key: Label on relationships
    await test(
        "MATCH (a)-[s:L1|L2|L3]->(b) RETURN a",
        "Label on relationships",
        [
            "MATCH (a)-[s:L1|L2]->(b) RETURN a",
            "MATCH (a)-[s:L1|L3]->(b) RETURN a",
            "MATCH (a)-[s:L2|L3]->(b) RETURN a"
        ]
    );

    // Key: Variable-length relationship
    await test(
        "MATCH (a)-[*1..2]->(b) RETURN a",
        "Variable-length relationship",
        [
            "MATCH (a)-[*]->(b) RETURN a",
            "MATCH (a)-[*1]->(b) RETURN a",
            "MATCH (a)-[*2]->(b) RETURN a",
            "MATCH (a)-[*1..]->(b) RETURN a",
            "MATCH (a)-[*..2]->(b) RETURN a",
        ]
    );

    // Key: MATCH clause
    await test(
        "MATCH (a) RETURN a",
        "MATCH clause",
        [
            "OPTIONAL MATCH (a) RETURN a"
        ]
    );

    await test(
        "OPTIONAL MATCH (a) RETURN a",
        "MATCH clause",
        [
            "MATCH (a) RETURN a"
        ]
    );

    // Key: RETURN clause
    await test(
        "MATCH (a) RETURN a",
        "RETURN clause",
        [
            "MATCH (a) RETURN DISTINCT a"
        ]
    );

    await test(
        "MATCH (a) RETURN DISTINCT a",
        "RETURN clause",
        [
            "MATCH (a) RETURN a"
        ]
    );

    // Key: Trimming section
    await test(
        "MATCH (a) RETURN a SKIP 3 LIMIT 5",
        "Trimming section",
        [
            "MATCH (a) RETURN a SKIP 5 LIMIT 3",
            "MATCH (a) RETURN a",
            "MATCH (a) RETURN a SKIP 3",
            "MATCH (a) RETURN a LIMIT 5"
        ]
    );

    await test(
        "MATCH (a) RETURN a SKIP 3",
        "Trimming section",
        [
            "MATCH (a) RETURN a LIMIT 3",
            "MATCH (a) RETURN a"
        ]
    );

    await test(
        "MATCH (a) RETURN a LIMIT 5",
        "Trimming section",
        [
            "MATCH (a) RETURN a SKIP 5",
            "MATCH (a) RETURN a"
        ]
    );

    // Key: ORDER BY clause
    await test(
        "MATCH (a) RETURN a ORDER BY a.x ASC",
        "ORDER BY clause",
        [
            "MATCH (a) RETURN a",
            "MATCH (a) RETURN a ORDER BY a.x DESC"
        ]
    );

    await test(
        "MATCH (a) RETURN a ORDER BY a.x ASC, a.y DESC, a.z ASC",
        "ORDER BY clause",
        [
            "MATCH (a) RETURN a ORDER BY a.x ASC, a.y DESC",
            "MATCH (a) RETURN a ORDER BY a.x ASC, a.z ASC",
            "MATCH (a) RETURN a ORDER BY a.y DESC, a.z ASC",
            "MATCH (a) RETURN a ORDER BY a.x DESC, a.y DESC, a.z ASC",
            "MATCH (a) RETURN a ORDER BY a.x ASC, a.y ASC, a.z ASC",
            "MATCH (a) RETURN a ORDER BY a.x ASC, a.y DESC, a.z DESC",
            "MATCH (a) RETURN a ORDER BY a.y DESC, a.x ASC, a.z ASC",
            "MATCH (a) RETURN a ORDER BY a.x ASC, a.z ASC, a.y DESC"
        ]
    );

    await test(
        "MATCH (a) WITH a ORDER BY a.x ASC RETURN a",
        "ORDER BY clause",
        [
            "MATCH (a) WITH a RETURN a",
            "MATCH (a) WITH a ORDER BY a.x DESC RETURN a"
        ]
    );

    await test(
        "MATCH (a) WITH a ORDER BY a.x ASC, a.y DESC, a.z ASC RETURN a",
        "ORDER BY clause",
        [
            "MATCH (a) WITH a ORDER BY a.x ASC, a.y DESC RETURN a",
            "MATCH (a) WITH a ORDER BY a.x ASC, a.z ASC RETURN a",
            "MATCH (a) WITH a ORDER BY a.y DESC, a.z ASC RETURN a",
            "MATCH (a) WITH a ORDER BY a.x DESC, a.y DESC, a.z ASC RETURN a",
            "MATCH (a) WITH a ORDER BY a.x ASC, a.y ASC, a.z ASC RETURN a",
            "MATCH (a) WITH a ORDER BY a.x ASC, a.y DESC, a.z DESC RETURN a",
            "MATCH (a) WITH a ORDER BY a.y DESC, a.x ASC, a.z ASC RETURN a",
            "MATCH (a) WITH a ORDER BY a.x ASC, a.z ASC, a.y DESC RETURN a"
        ]
    );

    // Key: CASE clause
    await test(
        "MATCH (a) WITH CASE a.num WHEN 1 THEN 10 WHEN 2 THEN 20 WHEN 3 THEN 30 END AS x RETURN x",
        "CASE clause",
        [
            "MATCH (a) WITH CASE a.num WHEN 2 THEN 20 WHEN 3 THEN 30 END AS x RETURN x",
            "MATCH (a) WITH CASE a.num WHEN 1 THEN 10 WHEN 3 THEN 30 END AS x RETURN x",
            "MATCH (a) WITH CASE a.num WHEN 1 THEN 10 WHEN 2 THEN 20 END AS x RETURN x",
            "MATCH (a) WITH CASE a.num WHEN 1 THEN 20 WHEN 2 THEN 10 WHEN 3 THEN 30 END AS x RETURN x",
            "MATCH (a) WITH CASE a.num WHEN 1 THEN 10 WHEN 2 THEN 30 WHEN 3 THEN 20 END AS x RETURN x",
        ]
    );

    await test(
        "MATCH (a) WITH CASE a.num WHEN 1 THEN 10 ELSE 0 END AS x RETURN x",
        "CASE clause",
        [
            "MATCH (a) WITH CASE a.num WHEN 1 THEN 10 END AS x RETURN x"
        ]
    );

    // Key: Predicate functions
    await test(
        "WITH all(x IN [1, 2, 3] WHERE x >= 0) AS x RETURN x",
        "Predicate functions",
        [
            "WITH any(x IN [1, 2, 3] WHERE (x >= 0)) AS x RETURN x",
            "WITH none(x IN [1, 2, 3] WHERE (x >= 0)) AS x RETURN x",
            "WITH single(x IN [1, 2, 3] WHERE (x >= 0)) AS x RETURN x",
        ]
    );

    // Key: Aggregate functions
    await test(
        "MATCH (a) WITH avg(a.num) AS x RETURN x",
        "Aggregate functions",
        [
            "MATCH (a) WITH sum(a.num) AS x RETURN x",
        ]
    );

    await test(
        "MATCH (a) WITH stDev(a.num) AS x RETURN x",
        "Aggregate functions",
        [
            "MATCH (a) WITH stDevP(a.num) AS x RETURN x",
        ]
    );

    await test(
        "MATCH (a) WITH collect(a.num) AS x RETURN x",
        "Aggregate functions",
        [
            "MATCH (a) WITH max(a.num) AS x RETURN x",
            "MATCH (a) WITH min(a.num) AS x RETURN x"
        ]
    );

    await test(
        "MATCH (a) WITH percentileCont(a.num, 0.4) AS x RETURN x",
        "Aggregate functions",
        [
            "MATCH (a) WITH percentileDisc(a.num, 0.4) AS x RETURN x"
        ]
    );

    await test(
        "MATCH (a) WITH count(a.num) AS x, count(*) AS y RETURN x, y",
        "Aggregate functions",
        [
            "MATCH (a) WITH count(DISTINCT a.num) AS x, count(*) AS y RETURN x, y"
        ]
    );

    // Key: Query concatenation
    await test(
        "RETURN 1 AS x UNION RETURN 2 AS x UNION ALL RETURN 3 AS x",
        "Query concatenation",
        [
            "RETURN 1 AS x UNION ALL RETURN 2 AS x UNION ALL RETURN 3 AS x",
            "RETURN 1 AS x UNION RETURN 2 AS x UNION RETURN 3 AS x",
            "RETURN 2 AS x UNION ALL RETURN 3 AS x",
            "RETURN 1 AS x UNION ALL RETURN 3 AS x",
            "RETURN 1 AS x UNION RETURN 3 AS x",
            "RETURN 1 AS x UNION RETURN 2 AS x",
        ]
    );

    // Key: Relational operator
    await test(
        "WITH 2 = 1 AS x RETURN x",
        "Relational operator",
        [
            "WITH (2 <> 1) AS x RETURN x",
            "WITH (2 > 1) AS x RETURN x",
            "WITH (2 >= 1) AS x RETURN x",
            "WITH (2 < 1) AS x RETURN x",
            "WITH (2 <= 1) AS x RETURN x",
            "WITH TRUE AS x RETURN x",
            "WITH FALSE AS x RETURN x"
        ]
    );

    await test(
        "WITH 2 > 1 AS x RETURN x",
        "Relational operator",
        [
            "WITH (2 = 1) AS x RETURN x",
            "WITH (2 <> 1) AS x RETURN x",
            "WITH (2 >= 1) AS x RETURN x",
            "WITH (2 < 1) AS x RETURN x",
            "WITH (2 <= 1) AS x RETURN x",
            "WITH TRUE AS x RETURN x",
            "WITH FALSE AS x RETURN x"
        ]
    );

    await test(
        "WITH 3 >= 2 > 1 AS x RETURN x",
        "Relational operator",
        [
            "WITH (3 > 2 > 1) AS x RETURN x",
            "WITH (3 < 2 > 1) AS x RETURN x",
            "WITH (3 <= 2 > 1) AS x RETURN x",
            "WITH (3 >= 2 >= 1) AS x RETURN x",
            "WITH (3 >= 2 < 1) AS x RETURN x",
            "WITH (3 >= 2 <= 1) AS x RETURN x",
            "WITH TRUE AS x RETURN x",
            "WITH FALSE AS x RETURN x"
        ]
    );

    // Key: Logical operator
    await test(
        "MATCH (a) WITH a.x AND a.y OR a.z AS x RETURN x",
        "Logical operator",
        [
            "MATCH (a) WITH ((a.x OR a.y) OR a.z) AS x RETURN x",
            "MATCH (a) WITH ((a.x XOR a.y) OR a.z) AS x RETURN x",
            "MATCH (a) WITH ((a.x AND a.y) AND a.z) AS x RETURN x",
            "MATCH (a) WITH ((a.x AND a.y) XOR a.z) AS x RETURN x",
            "MATCH (a) WITH (TRUE OR a.z) AS x RETURN x",
            "MATCH (a) WITH (FALSE OR a.z) AS x RETURN x",
            "MATCH (a) WITH TRUE AS x RETURN x",
            "MATCH (a) WITH FALSE AS x RETURN x",
            "MATCH (a) WITH (a.x OR a.z) AS x RETURN x",
            "MATCH (a) WITH (a.y OR a.z) AS x RETURN x",
            "MATCH (a) WITH (a.x AND a.y) AS x RETURN x",
            "MATCH (a) WITH a.z AS x RETURN x",
        ]
    );

    // Key: Unary operator
    await test(
        "WITH 1 + 2 AS x RETURN x",
        "Unary operator",
        [
            "WITH ((-1) + 2) AS x RETURN x",
            "WITH ((1 + 1) + 2) AS x RETURN x",
            "WITH ((1 - 1) + 2) AS x RETURN x",
            "WITH (1 + (-2)) AS x RETURN x",
            "WITH (1 + (2 + 1)) AS x RETURN x",
            "WITH (1 + (2 - 1)) AS x RETURN x",
        ]
    );

    // Key: Mathematical functions
    await test(
        "WITH 1 AS x RETURN x",
        "Mathematical functions",
        [
            "WITH abs(1) AS x RETURN x",
            "WITH (-abs(1)) AS x RETURN x",
            "WITH ceil(1) AS x RETURN x",
            "WITH (-ceil(1)) AS x RETURN x",
            "WITH floor(1) AS x RETURN x",
            "WITH (-floor(1)) AS x RETURN x",
            "WITH round(1) AS x RETURN x",
            "WITH (-round(1)) AS x RETURN x",
            "WITH sign(1) AS x RETURN x",
            "WITH (-sign(1)) AS x RETURN x",
        ]
    );

    await test(
        "WITH abs(1) AS x RETURN x",
        "Mathematical functions",
        [
            "WITH ceil(1) AS x RETURN x",
            "WITH floor(1) AS x RETURN x",
            "WITH round(1) AS x RETURN x",
            "WITH sign(1) AS x RETURN x",

            "WITH abs(abs(1)) AS x RETURN x",
            "WITH abs((-abs(1))) AS x RETURN x",
            "WITH abs(ceil(1)) AS x RETURN x",
            "WITH abs((-ceil(1))) AS x RETURN x",
            "WITH abs(floor(1)) AS x RETURN x",
            "WITH abs((-floor(1))) AS x RETURN x",
            "WITH abs(round(1)) AS x RETURN x",
            "WITH abs((-round(1))) AS x RETURN x",
            "WITH abs((-sign(1))) AS x RETURN x",
            "WITH abs(sign(1)) AS x RETURN x",
        ]
    );

    // Key: Mathematical operator
    await test(
        "WITH 1 + 2 AS x RETURN x",
        "Mathematical operator",
        [
            "WITH (1 - 2) AS x RETURN x",
            "WITH (1 * 2) AS x RETURN x",
            "WITH (1 / 2) AS x RETURN x",
            "WITH (1 % 2) AS x RETURN x",
            "WITH (1 ^ 2) AS x RETURN x",
            "WITH 1 AS x RETURN x",
            "WITH 2 AS x RETURN x",
        ]
    );

    // Key: String-specific comparison operator
    await test(
        "WITH 'apple' STARTS WITH 'a' AS x RETURN x",
        "String-specific comparison operator",
        [
            "WITH ('apple' =~ 'a') AS x RETURN x",
            "WITH ('apple' ENDS WITH 'a') AS x RETURN x",
            "WITH ('apple' CONTAINS 'a') AS x RETURN x"
        ]
    );

    // Key: List index
    await test(
        "WITH [1, 2, 3][1..2] AS x RETURN x",
        "List index",
        [
            "WITH [1, 2, 3][1..] AS x RETURN x",
            "WITH [1, 2, 3][..2] AS x RETURN x",
        ]
    );

    // Key: NULL check predicates
    await test(
        "WITH NULL IS NULL AS x RETURN x",
        "NULL check predicates",
        [
            "WITH (NULL IS NOT NULL) AS x RETURN x",
        ]
    );

    // Key: NULL in results
    await test(
        "WITH NULL AS x RETURN x",
        "NULL in results",
        [
            "WITH NULL AS x RETURN CASE WHEN (x IS NULL) THEN 0 ELSE x END",
        ]
    );

    // Key: Include NULLs
    await test(
        "WITH 1 AS x, 2 AS y RETURN x = y",
        "Include NULLs",
        [
            "WITH 1 AS x, 2 AS y RETURN ((x = y) OR (x IS NULL)) AS `x = y`",
            "WITH 1 AS x, 2 AS y RETURN ((x = y) OR (y IS NULL)) AS `x = y`",
        ]
    );

    await test(
        "WITH 1 AS x, 2 AS y RETURN x > y",
        "Include NULLs",
        [
            "WITH 1 AS x, 2 AS y RETURN ((x > y) OR (x IS NULL)) AS `x > y`",
            "WITH 1 AS x, 2 AS y RETURN ((x > y) OR (y IS NULL)) AS `x > y`",
        ]
    );

    console.log("");
})();
