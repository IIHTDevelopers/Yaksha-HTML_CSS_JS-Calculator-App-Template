const fs = require('fs');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const xmlBuilder = require('xmlbuilder');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const jsPath = path.join(__dirname, '../script.js');
const jsContent = fs.readFileSync(jsPath, 'utf8');
const esprima = require('esprima');
const calculator = require('../script'); // import module

class TestCaseResultDto {
    constructor(methodName, methodType, actualScore, earnedScore, status, isMandatory, errorMessage) {
        this.methodName = methodName;
        this.methodType = methodType;
        this.actualScore = actualScore;
        this.earnedScore = earnedScore;
        this.status = status;
        this.isMandatory = isMandatory;
        this.errorMessage = errorMessage;
    }
}

class TestResults {
    constructor() {
        this.testCaseResults = {};
        this.customData = '';
    }
}

function deleteOutputFiles() {
    ["./output_revised.txt", "./output_boundary_revised.txt", "./output_exception_revised.txt"].forEach(file => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
    });
}

function checkHtmlTags(htmlContent, requiredTags) {
    const dom = new JSDOM(htmlContent);
    const results = {};
    requiredTags.forEach(tag => {
        results[tag] = dom.window.document.getElementsByTagName(tag).length > 0 ? 'pass' : 'fail';
    });
    return results;
}

function checkHtmlAttributes(htmlContent, tagName, attributes) {
    const dom = new JSDOM(htmlContent);
    const elements = dom.window.document.getElementsByTagName(tagName);
    const attributeResults = {};
    attributes.forEach(attribute => {
        let found = false;
        for (let el of elements) {
            if (el.hasAttribute(attribute)) {
                found = true;
                break;
            }
        }
        attributeResults[attribute] = found ? 'pass' : 'fail';
    });
    return attributeResults;
}

function checkJsFunctionDeclarations(jsContent) {
    const ast = esprima.parseScript(jsContent);
    const requiredFunctions = ['appendNumber', 'operator', 'calculateResult', 'clearDisplay'];
    const result = {};

    requiredFunctions.forEach(fn => {
        result[fn] = ast.body.some(
            node => node.type === 'FunctionDeclaration' && node.id.name === fn
        ) ? 'pass' : 'fail';
    });

    return result;
}

function testAppendNumber(jsContent) {
    const dom = new JSDOM(`<!DOCTYPE html><input id="display" />`, { runScripts: "dangerously" });
    const { window } = dom;

    const scriptEl = window.document.createElement("script");
    scriptEl.textContent = jsContent;
    window.document.body.appendChild(scriptEl);

    window.appendNumber('4');

    return {
        appendNumber: window.display.value === '4' ? 'pass' : 'fail'
    };
}

function testCalculateResult(jsContent) {
    const dom = new JSDOM(`<!DOCTYPE html><input id="display" />`, { runScripts: "dangerously" });
    const { window } = dom;

    const scriptEl = window.document.createElement("script");
    scriptEl.textContent = jsContent;
    window.document.body.appendChild(scriptEl);

    window.appendNumber('10');
    window.operator('*');
    window.appendNumber('2');
    window.calculateResult();

    return {
        calculateResult: window.display.value === '20' ? 'pass' : 'fail'
    };
}

function testClearDisplay(jsContent) {
    const dom = new JSDOM(`<!DOCTYPE html><input id="display" value="123" />`, { runScripts: "dangerously" });
    const { window } = dom;

    const scriptEl = window.document.createElement("script");
    scriptEl.textContent = jsContent;
    window.document.body.appendChild(scriptEl);

    window.clearDisplay();

    const cleared = window.display.value === '';
    // const cleared = window.display.value === '' &&
    //                 window.currentInput === '' &&
    //                 window.firstOperand === null &&
    //                 window.currentOperator === '';

    return {
        clearDisplay: cleared ? 'pass' : 'fail'
    };
}

function checkCssFileStyles(cssContent, requiredStyles) {
    const result = {};

    requiredStyles.forEach(styleCheck => {
        const { selector, properties } = styleCheck;
        const blockRegex = new RegExp(`${selector}\\s*\\{([^}]+)\\}`, 'g');
        const match = blockRegex.exec(cssContent);

        if (!match) {
            result[selector] = 'fail';
            return;
        }

        const styleBlock = match[1];
        let allFound = true;

        for (const [prop, value] of Object.entries(properties)) {
            const propRegex = new RegExp(`${prop}\\s*:\\s*${value}\\s*;`);
            if (!propRegex.test(styleBlock)) {
                allFound = false;
                break;
            }
        }

        result[selector] = allFound ? 'pass' : 'fail';
    });

    return result;
}

function formatTestResults(results, methodName, methodType) {
    const result = new TestCaseResultDto(
        methodName,
        methodType,
        1,
        Object.values(results).includes('fail') ? 0 : 1,
        Object.values(results).includes('fail') ? 'Failed' : 'Passed',
        true,
        ''
    );
    const testResults = new TestResults();
    const id = uuidv4();
    testResults.testCaseResults[id] = result;
    testResults.customData = 'Simple Calculator HTML Test';
    return testResults;
}

function generateXmlReport(result) {
    return xmlBuilder.create('test-cases')
        .ele('case')
        .ele('test-case-type', result.status).up()
        .ele('name', result.methodName).up()
        .ele('status', result.status).up()
        .end({ pretty: true });
}

function writeOutputFiles(result, fileType) {
    let output = `${result.methodName}=${result.status === 'Passed' ? 'PASS' : 'FAIL'}\n`;
    const outputMap = {
        functional: "./output_revised.txt",
        boundary: "./output_boundary_revised.txt",
        exception: "./output_exception_revised.txt"
    };
    fs.appendFileSync(outputMap[fileType] || outputMap.functional, output);
}

async function handleTestCase(filePath, testCaseName, testCaseType, testLogic, extraParams = {}) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');

        // Run the test logic
        const results = Array.isArray(extraParams)
            ? testLogic(data, ...extraParams)
            : testLogic(data, ...Object.values(extraParams));

        // Build test result structure
        const testResults = formatTestResults(results, testCaseName, testCaseType);
        const customFilePath = path.join(__dirname, '../../../custom.ih');
        testResults.customData = fs.readFileSync(customFilePath, 'utf8');

        // console.log(`${testCaseType} Results:`, results);
        const chalkRed = (text) => `\x1b[31m${text}\x1b[0m`; // red
        const chalkGreen = (text) => `\x1b[32m${text}\x1b[0m`; // green

        console.log(`${testCaseType} Results:`);

        for (const [key, value] of Object.entries(results)) {
            if (value === 'fail') {
                console.log(`  ${key}: ${chalkRed('FAIL')}`);
            } else {
                console.log(`  ${key}: ${chalkGreen('PASS')}`);
            }
        }

        console.log("=================");
        console.log(testResults);

        // Send to results server
        const response = await axios.post(
            'https://compiler.techademy.com/v1/mfa-results/push',
            testResults,
            { headers: { 'Content-Type': 'application/json' } }
        );
        console.log(`${testCaseType} Test Case Server Response:`, response.data);

        // Write XML + output files
        const testCaseId = Object.keys(testResults.testCaseResults)[0];
        const xml = generateXmlReport(testResults.testCaseResults[testCaseId]);
        fs.writeFileSync(`${testCaseType.toLowerCase().replace(' ', '-')}-test-report.xml`, xml);

        writeOutputFiles(testResults.testCaseResults[testCaseId], 'functional');

    } catch (err) {
        console.error(`Error executing ${testCaseType} test case:`, err);
    }
}

// Updated execution flow
function executeAllTestCases() {
    deleteOutputFiles();

    const filePath = path.join(__dirname, '../index.html');
    const jsPath = path.join(__dirname, '../script.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    const cssFilePath = path.join(__dirname, '../style.css');
    const cssContent = fs.readFileSync(cssFilePath, 'utf8');


    const htmlTagsTestCase = {
        testCaseName: 'HTML Tags Test',
        testCaseType: 'boundary',
        testLogic: checkHtmlTags,
        extraParams: [['html', 'head', 'title', 'link', 'body', 'div', 'button', 'script']]
    };

    const linkAttrTestCase = {
        testCaseName: 'Link Tag Attribute Test',
        testCaseType: 'boundary',
        testLogic: checkHtmlAttributes,
        extraParams: ['link', ['rel', 'href']]
    };

    const scriptAttrTestCase = {
        testCaseName: 'Script Tag Attribute Test',
        testCaseType: 'boundary',
        testLogic: checkHtmlAttributes,
        extraParams: ['script', ['src']]
    };

    const inputAttrTestCase = {
        testCaseName: 'Input Tag Attribute Test',
        testCaseType: 'boundary',
        testLogic: checkHtmlAttributes,
        extraParams: ['input', ['type', 'id', 'disabled']]
    };

    const buttonAttrTestCase = {
        testCaseName: 'Button Tag Attribute Test',
        testCaseType: 'boundary',
        testLogic: checkHtmlAttributes,
        extraParams: ['button', ['class', 'onclick']]
    };

    const jsFunctionPresenceTest = {
        testCaseName: 'JS Calculator Function Declarations',
        testCaseType: 'boundary',
        testLogic: checkJsFunctionDeclarations
    };

    const appendNumberTestCase = {
        testCaseName: 'appendNumber Functionality Test',
        testCaseType: 'functional',
        testLogic: testAppendNumber
    };
    
    const calculateResultTestCase = {
        testCaseName: 'calculateResult Functionality Test',
        testCaseType: 'functional',
        testLogic: testCalculateResult
    };
    
    const clearDisplayTestCase = {
        testCaseName: 'clearDisplay Functionality Test',
        testCaseType: 'functional',
        testLogic: testClearDisplay
    };

    const cssFileStyleTestCase = {
        testCaseName: 'CSS File Style Test',
        testCaseType: 'boundary',
        testLogic: checkCssFileStyles,
        extraParams: [[
            { selector: '\\*', properties: { 'margin': '0', 'padding': '0', 'box-sizing': 'border-box' }},
            { selector: 'body', properties: { 'display': 'flex', 'justify-content': 'center', 'align-items': 'center' } },
            { selector: '.calculator', properties: { 'width': '320px', 'border-radius': '10px' }},
            { selector: 'input', properties: { 'width': '100%', 'height': '50px' }},
            { selector: '.buttons', properties: { 'display': 'grid', 'grid-template-columns': 'repeat\\(4, 1fr\\)' }},
            { selector: 'button', properties: { 'font-size': '20px', 'cursor': 'pointer' }},
            { selector: 'button:hover', properties: { 'background-color': '#ddd' }},
            { selector: 'button:active', properties: { 'background-color': '#ccc' }}
        ]]
    };

    [
        htmlTagsTestCase,
        linkAttrTestCase,
        scriptAttrTestCase,
        inputAttrTestCase,
        buttonAttrTestCase,
        jsFunctionPresenceTest,
        appendNumberTestCase,
        calculateResultTestCase,
        clearDisplayTestCase,
        cssFileStyleTestCase
    ].forEach(tc =>
        handleTestCase(
            tc.testLogic === checkJsFunctionDeclarations ||
            tc.testLogic === testCalculateResult ||
            tc.testLogic === testClearDisplay ||
            tc.testLogic === testAppendNumber ? jsPath : 
            tc.testLogic === checkCssFileStyles ? cssFilePath :
                filePath,
            tc.testCaseName,
            tc.testCaseType,
            tc.testLogic,
            tc.extraParams || {})
    );
}

executeAllTestCases();
