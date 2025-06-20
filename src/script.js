// let display = document.getElementById("display");
let currentInput = "";
let currentOperator = "";
let firstOperand = null;

function appendNumber(number) {
    currentInput += number;
    display.value = currentInput;
}

function operator(op) {
    if (firstOperand === null) {
        firstOperand = currentInput;
        currentInput = "";
        currentOperator = op;
    } else {
        calculateResult();
        currentOperator = op;
    }
}

function calculateResult() {
    if (currentOperator && firstOperand !== null) {
        let result;
        switch (currentOperator) {
            case '+':
                result = parseFloat(firstOperand) + parseFloat(currentInput);
                break;
            case '-':
                result = parseFloat(firstOperand) - parseFloat(currentInput);
                break;
            case '*':
                result = parseFloat(firstOperand) * parseFloat(currentInput);
                break;
            case '/':
                if (currentInput === "0") {
                    alert("Cannot divide by zero!");
                    return;
                }
                result = parseFloat(firstOperand) / parseFloat(currentInput);
                break;
            default:
                return;
        }
        display.value = result;
        firstOperand = result;
        currentInput = "";
        currentOperator = "";
    }
}

function clearDisplay() {
    display.value = "";
    currentInput = "";
    firstOperand = null;
    currentOperator = "";
}
