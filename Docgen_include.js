var ScriptIncludeDocGen = Class.create();
ScriptIncludeDocGen.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    /**
     * Retrieves a list of active, non-global custom script include names.
     * @returns {string} A JSON string array of script include names.
     */
    getScriptIncludeNames: function() {
        var name = this.getParameter("sysparm_script_include_name");
        var names = [];
        var gr = new GlideRecord("sys_script_include");
        gr.addQuery("active", true);
        gr.addQuery("sys_scope.name", "!=", "Global");
        gr.query();
        while (gr.next()) {
            names.push(gr.getValue("name"));
        }
        return JSON.stringify(names);
    },

    /**
     * Retrieves the documentation and code for a given script include.
     * @returns {string} A JSON string containing the script include's name, description, code, and parsed functions.
     */
    getScriptIncludeDoc: function() {
        var name = this.getParameter("sysparm_script_include_name");
        var doc = {};

        var gr = new GlideRecord("sys_script_include");
        gr.addQuery("name", name);
        gr.query();

        if (gr.next()) {
            doc.name = gr.getValue("name");
            doc.description = gr.getValue("description");
            doc.code = gr.getValue("script");
            doc.functions = this._parseFunctions(doc.code);
        }
        return JSON.stringify(doc);
    },

    /**
     * Parses the functions and their documentation from a given script code.
     * @param {string} code The script code to parse.
     * @returns {Array} An array of objects, where each object contains the function's documentation, name, and parameters.
     */

    _parseFunctions: function(code) {
        var functions = [];
        var regex = /(?:\/\*\*(.*?)\*\/\s*)?(\w+)\s*:\s*function\s*\((.*?)\)/gs;
        var match;

        while ((match = regex.exec(code)) !== null) {
            var rawDoc = match[1];
            var doc = rawDoc ? rawDoc.trim().replace(/\*/g, '').trim() : "/* TODO: Add description */";
            functions.push({
                doc: doc,
                name: match[2],
                params: match[3].split(',').map(p => p.trim())
            });
        }
        var codeWithoutDefs = code.replace(/\/\*\*[\s\S]*?\*\/\s*\w+\s*:\s*function\s*\([\s\S]*?\}\s*/g, '');
        functions.forEach(function(fn) {
            //var usageRegex = new RegExp('\\b' + fn.name + '\\s*\\(', 'g');
			var usageRegex = new RegExp(`\\b${fn.name}\\s*\\(|['"\`]${fn.name}['"\`]`, 'g');
            var usageMatches = codeWithoutDefs.match(usageRegex);
            fn.usage = usageMatches ? usageMatches.length : 0;
        });

        return functions;
    },

    /**
     * Retrieves a list of external usage table inforamtion where functions are called
     * @returns {string} A JSON string array of table results.
     */
    getFunctionExternalUsage: function() {
        var functionName = this.getParameter("sysparm_function_name");
        var siName = this.getParameter("sysparm_script_include_name");
        var results = [];
        var totalCount = 0;
        // Define tables and fields to search for function usage
        var searchTables = [{
                table: "sys_script",
                field: "script"
            },
            {
                table: "sys_ui_action",
                field: "script"
            },
            {
                table: "sys_script_client",
                field: "script"
            },
            {
                table: "catalog_script_client",
                field: "script"

            }
        ];

        for (var i = 0; i < searchTables.length; i++) {
            var tableInfo = searchTables[i];
            var gr = new GlideRecord(tableInfo.table);
            var queryStr = tableInfo.field + "LIKE" + functionName + "(" +
                "^OR" + tableInfo.field + "LIKE" + siName + "." + functionName + "(";
            gr.addEncodedQuery(queryStr);
            gr.query();
            while (gr.next()) {
                var scriptContent = gr.getValue(tableInfo.field) || '';
                var pattern1 = new RegExp('\\b' + functionName + '\\(', 'g');
                var pattern2 = new RegExp('\\b' + siName + '\\.' + functionName + '\\(', 'g');

                var count1 = (scriptContent.match(pattern1) || []).length;
                var count2 = (scriptContent.match(pattern2) || []).length;
                var matchCount = count1 + count2;

                totalCount += matchCount;
                results.push({
                    table: tableInfo.table,
                    name: gr.getValue("name") || gr.getValue("sys_name"),
                    sys_id: gr.getValue("sys_id"),
                    matchCount: matchCount
                });
            }
        }

        return JSON.stringify({
            totalCount: totalCount,
            results: results
        });

    }

});
