/*
This work is licensed under the Creative Commons Attribution-ShareAlike 3.0
Unported License. To view a copy of this license, visit
http://creativecommons.org/licenses/by-sa/3.0/ or send a letter to Creative
Commons, PO Box 1866, Mountain View, CA 94042, USA.
*/
import fetch from 'node-fetch';
import jsdom from 'jsdom';
import fs from 'fs';
const { JSDOM } = jsdom;

const SHOW_TEXT = 4 // from NodeFilter.SHOW_TEXT

/**
 * Return all the text nodes, discarding the ones that are just whitespace and the ones that are in scripts.
 * @param {*} document 
 * @returns An array of text nodes
 */
function nativeTreeWalker(document) {
    // Thanks to https://stackoverflow.com/a/2579869/12203444 by stackoverflow user Anurag https://stackoverflow.com/users/165737/anurag. Modified.
    const walker = document.createTreeWalker(
        document.body,
        SHOW_TEXT,
        null,
        false
    );

    let node;
    const textNodes = [];

    while (node = walker.nextNode()) {
        const value = node.nodeValue.trim().replace(/ +(?= )|\n/g, ''); // Trim, then remove more than one space, and newlines
        if (value !== "" && node.parentNode.nodeName !== "SCRIPT") { // Only add the nodes that actually have more than whitespace in them, and discard scripts.
            textNodes.push(value);
        }
    }
    return textNodes;
}

/**
 * Generate an underline for the word
 * @param {number} offset
 * @param {number} length
 * @returns something like "     ~~~~"
 */
function asciiUnderline(offset, length) {
    let underline = "";
    for (let i = 0; i < offset; i++) {
        underline += " ";
    }
    for (let i = 0; i < length; i++) {
        underline += "~";
    }
    return underline;
}

/**
 * Get language-tool suggestions and print them out to console
 * @param {*} formBody 
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
        console.log(match.context.text);
        console.log(asciiUnderline(match.context.offset, match.context.length));
        console.log(match.message)
        if (match.replacements[0]) {
            console.log(match.replacements[0].value)
        }
        console.log("===========================================================")
    }
}

// Read in the file in.html and check it
fs.readFile('in.html', 'utf8', (err, data) => { // TODO in from stdin?
    if (err) {
        console.error(err);
        return;
    }
    const document = new JSDOM(data).window.document;
    const strings = nativeTreeWalker(document);

    for (const string of strings) {
        // TODO the things in here should be configurable!
        const formBody = `text=${encodeURIComponent(string)}&language=en-US&level=picky`;
        fetchAndLog(formBody);
    }

});