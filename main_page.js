function filterDropdown() {
    const input = document.getElementById("si_filter");
    const filter = input.value.toUpperCase();
    const select = document.getElementById("si_select");
    const options = select.options;

    for (let i = 0; i < options.length; i++) {
        const txtValue = options[i].textContent || options[i].innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1 || options[i].value.toUpperCase().indexOf(filter) > -1) {
            options[i].style.display = "";
        } else {
            options[i].style.display = "none";
        }
    }
}

function downloadDoc(format) {
    const docOutput = document.getElementById('doc_output');
    let content = '';
    let filename = 'script_include_doc';
    let mimeType = '';

    if (format === 'md') {
        // Basic Markdown conversion (you might want to improve this)
        content = '# ' + (document.querySelector('#doc_output h3')?.innerText || '') + '\n\n';
        content += '**Description:** ' + (docOutput.querySelector('p strong')?.nextSibling?.textContent?.trim() || 'No description') + '\n\n';
        docOutput.querySelectorAll('h4').forEach(h4 => {
            content += '## ' + h4.innerText + '\n';
            let ul = h4.nextElementSibling;
            if (ul && ul.tagName === 'UL') {
                ul.querySelectorAll('li').forEach(li => {
                    content += '- **' + li.querySelector('b')?.innerText + '**(' + li.querySelector('b')?.nextSibling?.textContent?.split('(')[1]?.split(')')[0] + ')\n';
                    content += '  ```javascript\n  ' + li.querySelector('pre')?.innerText + '\n  ```\n\n';
                });
            }
        });
        filename += '.md';
        mimeType = 'text/markdown';
    } else if (format === 'txt') {
        content = docOutput.innerText;
        filename += '.txt';
        mimeType = 'text/plain';
    } else if (format === 'json') {
        const docData = {
            name: document.querySelector('#doc_output h3')?.innerText || '',
            description: docOutput.querySelector('p strong')?.nextSibling?.textContent?.trim() || 'No description',
            functions: []
        };
        docOutput.querySelectorAll('li').forEach(li => {
            docData.functions.push({
                name: li.querySelector('b')?.innerText,
                params: li.querySelector('b')?.nextSibling?.textContent?.split('(')[1]?.split(')')[0]?.split(',').map(p => p.trim()) || [],
                doc: li.querySelector('pre')?.innerText
            });
        });
        content = JSON.stringify(docData, null, 2); // Pretty print JSON
        filename += '.json';
        mimeType = 'application/json';
    }

    const blob = new Blob([content], {
        type: mimeType
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function toggleView(view) {
        var docView = document.getElementById('doc_view');
        var codeBlock = document.getElementById('code_block');
        var functionInsights = document.getElementById('function_insights');
        var qualityScore = document.getElementById('quality_score');

        var viewDocBtn = document.querySelector('button[onclick="toggleView(\'doc\')"]');
        var viewCodeBtn = document.querySelector('button[onclick="toggleView(\'code\')"]');

        if (view === 'doc') {
            docView.style.display = 'block';
            codeBlock.style.display = 'none';
            functionInsights.style.display = 'block';
            qualityScore.style.display = 'block';
            
        } else if (view === 'code') {
            docView.style.display = 'none';
            codeBlock.style.display = 'block';
            functionInsights.style.display = 'none';
            qualityScore.style.display = 'none';

        }
    }


function loadExternalUsage(functionName) {
    var siName = document.getElementById('si_select').value; // dynamic selection
    var ga = new GlideAjax('ScriptIncludeDocGen');
    ga.addParam('sysparm_name', 'getFunctionExternalUsage');
    ga.addParam('sysparm_function_name', functionName);
    ga.addParam('sysparm_script_include_name', siName);
    ga.getXMLAnswer(function(response) {
        if (!response || response === "null") {
            document.getElementById('external_usage_' + functionName).innerHTML = '<li>No external usage found.</li>';
            return;
        }

        var usageData;
        try {
            usageData = JSON.parse(response);
        } catch (e) {
            document.getElementById('external_usage_' + functionName).innerHTML = '<li>Error reading usage info.</li>';
            return;
        }

        var usageHTML = '';
        if (usageData.results && usageData.results.length) {
            usageData.results.forEach(function(usage) {
                usageHTML += '<li>' +
                    (usage.name || 'Unnamed') + ' (' + usage.table + ') ' +
                    '(Count: ' + usage.matchCount + ') ' +
                    '- <a href="' + usage.table + '.do?sys_id=' + usage.sys_id + '" target="_blank">View</a>' +
                    '</li>';
            });
        } else {
            usageHTML = '<li>No external usage found.</li>';
        }

        document.getElementById('external_usage_' + functionName).innerHTML = usageHTML;
		
        // Update the total references dynamically in the placeholder span
        var totalReferencesElement = document.getElementById('total_references_' + functionName.replace(/[^a-zA-Z0-9_-]/g, '_'));
        if (totalReferencesElement) {
            totalReferencesElement.textContent = usageData.totalCount;
        }
    });
}

function calculateDocScore(functions) {
    if (!functions || functions.length === 0) {
        return {
            score: 0,
            feedback: 'Score: 0% – No functions found to analyze.'
        };
    }

    let total = functions.length;
    let documented = 0;
    let detailed = 0;
    let hasParamTags = 0;
    let todoCount = 0;

    functions.forEach(fn => {
        if (fn.doc && fn.doc.trim() !== "") {
            documented++;
            if (fn.doc.length > 40) detailed++;
            if (/@param/.test(fn.doc)) hasParamTags++;
            if (fn.doc.includes("TODO")) todoCount++;
        } else {
            todoCount++;
        }
    });

    var docCoverage = documented / total;
    var detailScore = detailed / total;
    var paramScore = hasParamTags / total;
    var todoPenalty = Math.min(todoCount * 5, 30); // Cap penalty at 30%

    let rawScore = (docCoverage * 0.4 + detailScore * 0.3 + paramScore * 0.2) * 100;
    let finalScore = Math.max(0, Math.round(rawScore - todoPenalty));

    let feedback = `Score: ${finalScore} ` +
        (finalScore >= 90 ? 'Excellent!' :
            finalScore >= 70 ? 'Pretty good!' :
            finalScore >= 50 ? 'Getting there.' : 'Needs serious improvement.');

    let missing = total - documented;
    if (missing > 0) {
        feedback += ` Document ${missing} more function${missing > 1 ? 's' : ''} to boost the score.`;
    }

    return {
        score: finalScore,
        feedback
    };
}

function expandAllFunctions() {
    var functionDivs = document.querySelectorAll('[id^="fn_"]');
    functionDivs.forEach(function(div) {
        div.style.display = 'block';
    });
}

function collapseAllFunctions() {
    var functionDivs = document.querySelectorAll('[id^="fn_"]');
    functionDivs.forEach(function(div) {
        div.style.display = 'none';
	});
}
