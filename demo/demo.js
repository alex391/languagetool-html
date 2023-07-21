/*
This work is licensed under the Creative Commons Attribution-ShareAlike 3.0
Unported License. To view a copy of this license, visit
http://creativecommons.org/licenses/by-sa/3.0/ or send a letter to Creative
Commons, PO Box 1866, Mountain View, CA 94042, USA.
*/

// A client-side version of index.js. Sorry that this isn't DRY

"use strict";

// API rate limits per minute. 
const MAX_REQUESTS = 20;
const MAX_CHARS = 75000;
const MAX_CHARS_REQ = 20000 / 2; // Can make this smaller in order to make requests smaller. LanguageTool will give up if they're too big. 20k is the max this can be.

let output; // The output div.

/**
 * Return all the text nodes, discarding the ones that are just whitespace and the ones that are in scripts.
 * @param {*} document 
 * @returns An array of text nodes
 */
function nativeTreeWalker(document) {
    // Thanks to https://stackoverflow.com/a/2579869/12203444 by stackoverflow user Anurag https://stackoverflow.com/users/165737/anurag. Modified.
    const walker = document.createTreeWalker(
        document,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    const textNodes = [];

    while (node = walker.nextNode()) {
        const value = node.nodeValue.trim().replace(/ +(?= )|\n/g, ''); // Trim, then remove more than one space, and newlines
        if (value !== "" && node.parentNode.nodeName !== "SCRIPT" && node.parentNode.nodeName !== "STYLE") { // Only add the nodes that actually have more than whitespace in them, and discard scripts.
            textNodes.push(value);
        }
    }
    return textNodes;
}

/**
 * Generate an underline for the word.
 * @param {number} offset
 * @param {number} length
 * @returns something like "     ~~~~"
 */
function asciiUnderline(offset, length) {
    let underline = "";
    for (let i = 0; i < offset; i++) {
        underline += "\xa0"; // non-breaking space
    }
    for (let i = 0; i < length; i++) {
        underline += "~";
    }
    return underline;
}

/**
 * Get language-tool suggestions and print them out to console
 * @param {*} formBody 
 * @param {*} output the div to output to
 */
async function fetchAndLog(formBody) {
    // Thanks to https://stackoverflow.com/a/48410549/12203444 from stackoverflow user Rob Walker https://stackoverflow.com/users/3672622/rob-walker. Modified.
    const response = await fetch("https://api.languagetool.org/v2/check", {
        method: "POST",
        body: formBody,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/json'
        },
    });
    const json = await response.json();
    for (const match of json.matches) {
        // TODO change these to appending to output
        output.appendChild(document.createTextNode(match.context.text));
        output.appendChild(document.createElement("br"));
        output.appendChild(document.createTextNode(asciiUnderline(match.context.offset, match.context.length)));
        output.appendChild(document.createElement("br"));
        output.appendChild(document.createTextNode(match.message));
        output.appendChild(document.createElement("br"));
        if (match.replacements[0]) {
            output.appendChild(document.createTextNode(match.replacements[0].value));
            output.appendChild(document.createElement("br"));
        }
        output.appendChild(document.createElement("hr"));
    }
}

/**
 * Group up the strings for rate limiting (max chars/request is 20k)
 * Note that all of the strings have to be less <= 20k characters long first.
 * @param {*} strings an array of strings to group into 20k character long groups
 * @param {string} separator the separator to use between each string
 * @returns an array of strings that are each <= 20k characters long
 */
function groupUp(strings, separator) {
    // Just greedily group strings together until it would be too long
    const grouped = [strings.shift()];
    let string;
    while (strings.length > 0) {
        string = strings.shift();
        if (grouped[grouped.length - 1].length + string.length <= MAX_CHARS_REQ) {
            grouped[grouped.length - 1] += separator + string;
        } else {
            grouped.push(string);
        }
    };
    return grouped;
}
/**
 * Take an array of strings, and break all of them up for grouping
 * @param {*} strings the array of strings to break upMAX_CHARS_PER
 * @returns an array of strings suitable for group20K
 */
function splitUp(strings) {
    let string;
    let split = [];
    while (string = strings.shift()) {
        split = split.concat(breakUp(string));
    }
    return split;
}
/**
 * Take a string that is longer than 20k characters long, and split it at either
 * a ". " or just at 20k if there are none. For text nodes that have a lot of text in them
 * @param {*} string 
 */
function breakUp(string) {
    if (string.length <= MAX_CHARS_REQ) {
        return [string];
    }
    if (string.includes(". ")) {
        const split = string.split(". ");
        let broken = [];
        for (const s of split) {
            broken = broken.concat(breakUpSimple(s)); // make sure run on sentences still get broken up.
        }
        return groupUp(broken, ". ");
    } else {
        return breakUpSimple(string);
    }
}
/**
 * Split a string into an array of strings that are less than 20k characters long
 * @param {*} string the string to break up
 */
function breakUpSimple(string) {
    if (string.length <= MAX_CHARS_REQ) {
        return [string];
    }
    const broken = [];
    while (string.length > 0) {
        broken.push(string.substring(0, MAX_CHARS_REQ + 1));
        string = string.substring(MAX_CHARS_REQ);
    }
    return broken;
}

/**
 * Send requests to language tool. Thanks to https://stackoverflow.com/a/951111/12203444 (community wiki).
 * @param {*} strings the strings for LanguageTool to check
 * @param {number} requests how many requests have happened so far
 * @param {number} chars how many chars have been sent
 */
function sendRequests(strings, requests, chars) {
    const string = strings[0];
    requests++;
    chars += string.length;
    if (requests <= MAX_REQUESTS && chars <= MAX_CHARS) {
        const formBody = `text=${encodeURIComponent(string)}&language=en-US&level=picky`;
        fetchAndLog(formBody);
        strings.shift();
        if (strings.length > 0) {
            sendRequests(strings, requests, chars);
        } else {
            // Done.
        }
    } else {
        output.appendChild(document.createTextNode("Please wait a few minutes, long inputs are rate limited."));
        output.appendChild(document.createElement("hr"));
        setTimeout(() => { sendRequests(strings, 0, 0) }, 1000 * 60);
    }
}

window.addEventListener("load", () => {
    output = document.getElementById("output");
    document.getElementsByTagName("form")[0].addEventListener("submit", async (event) => {
        output.textContent = "";
        event.preventDefault();
        const html = document.getElementById("html-input").value;
        const doc = new DOMParser().parseFromString(html, "text/html");

        let strings = nativeTreeWalker(doc);
        strings = splitUp(strings);
        strings = groupUp(strings, "\n");

        sendRequests(strings, 0, 0);
    });
});
