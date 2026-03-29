const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const keypad = document.getElementById("keypad");
const calculator = document.querySelector(".calculator");
const displayEl = document.querySelector(".display");

const angleToggleBtn = document.querySelector('[data-action="toggle-angle"]');
const shiftToggleBtn = document.querySelector('[data-action="toggle-shift"]');
const eqnToggleBtn = document.querySelector('[data-action="open-eqn"]');
const calcToolEl = document.getElementById("calcTool");
const calcToolTitleEl = document.getElementById("calcToolTitle");
const calcToolFieldsEl = document.getElementById("calcToolFields");
const calcToolCancelBtn = document.getElementById("calcToolCancel");
const calcToolComputeBtn = document.getElementById("calcToolCompute");

let expression = "";
let angleMode = "DEG";
let shiftMode = false;
let customResultText = "";
let toolState = {
	active: false,
	type: null,
	activeField: null,
	fields: {}
};

const toolConfigs = {
	differentiate: {
		title: "Derivative d/dx",
		fields: [
			{ key: "fn", label: "f(x)" },
			{ key: "at", label: "x" }
		]
	},
	integrate: {
		title: "Integral ∫ f(x) dx",
		fields: [
			{ key: "fn", label: "f(x)" },
			{ key: "lower", label: "Lower a" },
			{ key: "upper", label: "Upper b" }
		]
	},
	cubic: {
		title: "Cubic Equation ax³ + bx² + cx + d = 0",
		fields: [
			{ key: "a", label: "a" },
			{ key: "b", label: "b" },
			{ key: "c", label: "c" },
			{ key: "d", label: "d" }
		]
	}
};

const variableValues = {
	X: 0
};

const operators = ["+", "-", "*", "/", "^"];
const functionSuffixes = [
	"asin(",
	"acos(",
	"atan(",
	"sqrt(",
	"sin(",
	"cos(",
	"tan(",
	"log(",
	"ln(",
	"pi",
	"e"
];
const compiledExpressionCache = new Map();
const isLikelyMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const PREVIEW_DEBOUNCE_MS = isLikelyMobile ? 75 : 0;
let previewTimerId = null;

keypad.addEventListener("pointerdown", (event) => {
	if (event.pointerType && event.pointerType !== "mouse") {
		event.preventDefault();
	}
	handleKeypadInput(event);
});

keypad.addEventListener("click", (event) => {
	if (event.detail !== 0) {
		return;
	}
	handleKeypadInput(event);
});

function handleKeypadInput(event) {
	const button = event.target.closest("button");
	if (!button) {
		return;
	}

	const action = button.dataset.action;
	const value = button.dataset.value;

	if (action === "differentiate") {
		openCalcTool("differentiate");
		render();
		return;
	}

	if (action === "integrate") {
		openCalcTool("integrate");
		render();
		return;
	}

	if (toolState.active) {
		handleToolKeypadAction(action, button);
		render();
		return;
	}

	if (["number", "decimal", "operator", "function", "constant", "paren", "square", "fraction", "reciprocal", "clear", "delete", "equals"].includes(action)) {
		clearCustomResult();
	}

	if (action === "number") {
		appendNumber(value);
	}

	if (action === "decimal") {
		appendDecimal();
	}

	if (action === "operator") {
		appendOperator(value);
	}

	if (action === "function") {
		const fn = shiftMode && button.dataset.alt ? button.dataset.alt : button.dataset.fn;
		appendFunction(fn);
	}

	if (action === "constant") {
		appendConstant(value);
	}

	if (action === "paren") {
		appendParen(value);
	}

	if (action === "square") {
		applySquare();
	}

	if (action === "fraction") {
		appendFraction();
	}

	if (action === "reciprocal") {
		applyReciprocalPower();
	}

	if (action === "clear") {
		clearAll();
	}

	if (action === "delete") {
		deleteLast();
	}

	if (action === "equals") {
		evaluateExpression(true);
	}

	render();
}

calcToolFieldsEl.addEventListener("click", (event) => {
	const fieldButton = event.target.closest("button[data-field]");
	const toolActionButton = event.target.closest("button[data-tool-action]");
	if (toolActionButton) {
		if (toolActionButton.dataset.toolAction === "insert-x") {
			setActiveToolValue(appendXTo(getActiveToolValue()));
			render();
		}
		return;
	}

	if (!fieldButton) {
		return;
	}

	toolState.activeField = fieldButton.dataset.field;
	renderCalcTool();
});

calcToolCancelBtn.addEventListener("click", () => {
	closeCalcTool();
	render();
});

if (calcToolComputeBtn) {
	calcToolComputeBtn.addEventListener("click", () => {
		computeCalcTool();
		render();
	});
}

angleToggleBtn.addEventListener("click", () => {
	angleMode = angleMode === "DEG" ? "RAD" : "DEG";
	angleToggleBtn.textContent = angleMode;
	angleToggleBtn.classList.toggle("active", true);
	render();
});

shiftToggleBtn.addEventListener("click", () => {
	shiftMode = !shiftMode;
	shiftToggleBtn.classList.toggle("active", shiftMode);
	updateFunctionLabels();
});

eqnToggleBtn.addEventListener("click", () => {
	openCalcTool("cubic");
	render();
});

function appendNumber(value) {
	if (expression === "0") {
		expression = value;
		return;
	}

	if (expression === "-0") {
		expression = `-${value}`;
		return;
	}

	if (shouldInsertMultiplicationBeforeNumber()) {
		expression += "*";
	}
	expression += value;
}

function appendDecimal() {
	const numberMatch = expression.match(/(\d+\.?\d*)$/);
	if (numberMatch && numberMatch[0].includes(".")) {
		return;
	}

	if (expression === "" || isOperator(lastChar()) || lastChar() === "(") {
		expression += "0.";
		return;
	}

	expression += ".";
}

function appendOperator(operator) {
	if (expression === "") {
		if (operator === "-") {
			expression = "-";
		}
		return;
	}

	if (expression === "0" && operator === "-") {
		expression = "-0";
		return;
	}

	if (expression === "-0" && operator === "-") {
		return;
	}

	const last = lastChar();
	if (isOperator(last)) {
		expression = expression.slice(0, -1) + operator;
		return;
	}

	if (last === "(" && operator !== "-") {
		return;
	}

	expression += operator;
}

function appendFunction(fn) {
	if (shouldInsertMultiplication()) {
		expression += "*";
	}
	expression += `${fn}(`;
}

function appendConstant(constant) {
	if (shouldInsertMultiplication()) {
		expression += "*";
	}
	expression += constant;
}

function appendParen(value) {
	if (value === "(") {
		if (shouldInsertMultiplication()) {
			expression += "*";
		}
		expression += "(";
		return;
	}

	const opens = (expression.match(/\(/g) || []).length;
	const closes = (expression.match(/\)/g) || []).length;
	const last = lastChar();
	if (opens > closes && !isOperator(last) && last !== "(") {
		expression += ")";
	}
}

function applySquare() {
	if (!expression) {
		return;
	}

	const last = lastChar();
	if (isOperator(last) || last === "(") {
		return;
	}

	expression += "^2";
}

function appendFraction() {
	if (!expression || isOperator(lastChar()) || lastChar() === "(") {
		expression += "1/(";
		return;
	}

	expression += "/(";
}

function applyReciprocalPower() {
	if (!expression) {
		return;
	}

	const last = lastChar();
	if (isOperator(last) || last === "(") {
		return;
	}

	expression += "^-1";
}

function deleteLast() {
	if (!expression) {
		return;
	}

	for (const suffix of functionSuffixes) {
		if (expression.endsWith(suffix)) {
			expression = expression.slice(0, -suffix.length);
			return;
		}
	}

	expression = expression.slice(0, -1);
}

function clearAll() {
	expression = "";
}

function evaluateExpression(fromEquals = false) {
	const preparedExpression = expression.trim();
	if (!preparedExpression) {
		resultEl.textContent = "0";
		return;
	}

	const last = lastChar();
	if (isOperator(last) || last === "(") {
		if (fromEquals) {
			resultEl.textContent = "Invalid expression";
		}
		return;
	}

	try {
		const value = safeEval(preparedExpression);
		const formatted = formatResult(value);
		resultEl.textContent = formatted;
		if (fromEquals) {
			expression = String(value);
		}
	} catch (_error) {
		if (fromEquals) {
			resultEl.textContent = "Invalid expression";
		}
	}
}

function safeEval(rawExpression, xValue) {
	const evaluator = getCompiledEvaluator(rawExpression);
	const X = Number.isFinite(xValue) ? xValue : variableValues.X;
	const result = evaluator(X);

	if (!Number.isFinite(result)) {
		throw new Error("Invalid result");
	}

	return result;
}

function getCompiledEvaluator(rawExpression) {
	const jsExpression = rawExpression
		.replace(/pi/g, "PI")
		.replace(/\^/g, "**")
		.replace(/asin\(/g, "TRIG_ASIN(")
		.replace(/acos\(/g, "TRIG_ACOS(")
		.replace(/atan\(/g, "TRIG_ATAN(")
		.replace(/sin\(/g, "TRIG_SIN(")
		.replace(/cos\(/g, "TRIG_COS(")
		.replace(/tan\(/g, "TRIG_TAN(")
		.replace(/log\(/g, "LOG10(")
		.replace(/ln\(/g, "LN(")
		.replace(/sqrt\(/g, "SQRT(");
	const cacheKey = `${angleMode}|${jsExpression}`;
	if (compiledExpressionCache.has(cacheKey)) {
		return compiledExpressionCache.get(cacheKey);
	}

	const TRIG_SIN = (value) => Math.sin(toRadians(value));
	const TRIG_COS = (value) => Math.cos(toRadians(value));
	const TRIG_TAN = (value) => Math.tan(toRadians(value));
	const TRIG_ASIN = (value) => toSelectedAngle(Math.asin(value));
	const TRIG_ACOS = (value) => toSelectedAngle(Math.acos(value));
	const TRIG_ATAN = (value) => toSelectedAngle(Math.atan(value));
	const LOG10 = (value) => Math.log10(value);
	const LN = (value) => Math.log(value);
	const SQRT = (value) => Math.sqrt(value);
	const PI = Math.PI;
	const e = Math.E;

	const evaluator = Function(
		"TRIG_SIN",
		"TRIG_COS",
		"TRIG_TAN",
		"TRIG_ASIN",
		"TRIG_ACOS",
		"TRIG_ATAN",
		"LOG10",
		"LN",
		"SQRT",
		"PI",
		"e",
		`"use strict"; return function(X) { const x = X; return (${jsExpression}); };`
	)(
		TRIG_SIN,
		TRIG_COS,
		TRIG_TAN,
		TRIG_ASIN,
		TRIG_ACOS,
		TRIG_ATAN,
		LOG10,
		LN,
		SQRT,
		PI,
		e
	);

	compiledExpressionCache.set(cacheKey, evaluator);
	if (compiledExpressionCache.size > 80) {
		const firstKey = compiledExpressionCache.keys().next().value;
		compiledExpressionCache.delete(firstKey);
	}

	return evaluator;
}

function openCalcTool(type) {
	let defaults;
	if (type === "differentiate") {
		defaults = { fn: "0", at: "0" };
	} else if (type === "integrate") {
		defaults = { fn: "0", lower: "0", upper: "0" };
	} else {
		defaults = { a: "0", b: "0", c: "0", d: "0" };
	}

	toolState = {
		active: true,
		type,
		activeField: type === "cubic" ? "a" : "fn",
		fields: defaults
	};

	renderCalcTool();
}

function closeCalcTool() {
	toolState.active = false;
	toolState.type = null;
	toolState.activeField = null;
	toolState.fields = {};
	if (eqnToggleBtn) {
		eqnToggleBtn.classList.remove("active");
	}
	renderCalcTool();
}

function handleToolKeypadAction(action, button) {
	if (action === "equals") {
		computeCalcTool();
		return;
	}

	if (action === "clear") {
		setActiveToolValue("");
		return;
	}

	if (action === "delete") {
		setActiveToolValue(deleteLastFrom(getActiveToolValue()));
		return;
	}

	if (action === "number") {
		setActiveToolValue(appendNumberTo(getActiveToolValue(), button.dataset.value));
		return;
	}

	if (action === "decimal") {
		setActiveToolValue(appendDecimalTo(getActiveToolValue()));
		return;
	}

	if (action === "operator") {
		setActiveToolValue(appendOperatorTo(getActiveToolValue(), button.dataset.value));
		return;
	}

	if (action === "function") {
		const fn = shiftMode && button.dataset.alt ? button.dataset.alt : button.dataset.fn;
		setActiveToolValue(appendFunctionTo(getActiveToolValue(), fn));
		return;
	}

	if (action === "constant") {
		setActiveToolValue(appendConstantTo(getActiveToolValue(), button.dataset.value));
		return;
	}

	if (action === "paren") {
		setActiveToolValue(appendParenTo(getActiveToolValue(), button.dataset.value));
		return;
	}

	if (action === "square") {
		setActiveToolValue(applySquareTo(getActiveToolValue()));
		return;
	}

	if (action === "fraction") {
		setActiveToolValue(appendFractionTo(getActiveToolValue()));
		return;
	}

	if (action === "reciprocal") {
		setActiveToolValue(applyReciprocalTo(getActiveToolValue()));
	}

}

function computeCalcTool() {
	if (!toolState.active || !toolState.type) {
		return;
	}

	try {
		clearCustomResult();

		if (toolState.type === "cubic") {
			const a = parseToolNumericField(toolState.fields.a);
			const b = parseToolNumericField(toolState.fields.b);
			const c = parseToolNumericField(toolState.fields.c);
			const d = parseToolNumericField(toolState.fields.d);
			const roots = solveCubicRealRoots(a, b, c, d);
			if (!roots.length) {
				resultEl.textContent = "No real roots";
				closeCalcTool();
				return;
			}

			expression = String(roots[0]);
			setCustomResult(formatRootsResult(roots));
			closeCalcTool();
			return;
		}

		if (toolState.type === "differentiate") {
			const fnExpression = toolState.fields.fn?.trim();
			if (!fnExpression) {
				resultEl.textContent = "Enter f(x)";
				return;
			}

			const x = parseToolNumericField(toolState.fields.at);
			const derivative = numericalDerivative(fnExpression, x);
			setMainResult(derivative);
			resultEl.textContent = formatResult(derivative);
			closeCalcTool();
			return;
		}

		const fnExpression = toolState.fields.fn?.trim();
		if (!fnExpression) {
			resultEl.textContent = "Enter f(x)";
			return;
		}

		const lower = parseToolNumericField(toolState.fields.lower);
		const upper = parseToolNumericField(toolState.fields.upper);
		const integral = numericalIntegral(fnExpression, lower, upper);
		setMainResult(integral);
		resultEl.textContent = formatResult(integral);
		closeCalcTool();
	} catch (_error) {
		resultEl.textContent = "Invalid input";
	}
}

function parseToolNumericField(rawValue) {
	const source = (rawValue || "").trim();
	if (!source) {
		throw new Error("Missing field");
	}

	return safeEval(source);
}

function numericalDerivative(fnExpression, x) {
	const h = Math.max(1e-6, Math.abs(x) * 1e-6);
	const fPlus = safeEval(fnExpression, x + h);
	const fMinus = safeEval(fnExpression, x - h);
	return (fPlus - fMinus) / (2 * h);
}

function numericalIntegral(fnExpression, a, b) {
	if (a === b) {
		return 0;
	}

	let start = a;
	let end = b;
	let sign = 1;
	if (a > b) {
		start = b;
		end = a;
		sign = -1;
	}

	const span = Math.abs(end - start);
	const targetDensity = isLikelyMobile ? 40 : 70;
	let segments = Math.ceil(span * targetDensity);
	segments = Math.min(isLikelyMobile ? 320 : 720, Math.max(isLikelyMobile ? 80 : 120, segments));
	if (segments % 2 !== 0) {
		segments += 1;
	}
	const h = (end - start) / segments;
	let sum = safeEval(fnExpression, start) + safeEval(fnExpression, end);

	for (let i = 1; i < segments; i += 1) {
		const x = start + i * h;
		const weight = i % 2 === 0 ? 2 : 4;
		sum += weight * safeEval(fnExpression, x);
	}

	return sign * (h / 3) * sum;
}

function setMainResult(value) {
	clearCustomResult();
	expression = String(value);
}

function getActiveToolValue() {
	if (!toolState.activeField) {
		return "";
	}

	return toolState.fields[toolState.activeField] || "";
}

function setActiveToolValue(value) {
	if (!toolState.activeField) {
		return;
	}

	toolState.fields[toolState.activeField] = value;
}

function appendNumberTo(current, value) {
	if (current === "0") {
		return value;
	}

	if (current === "-0") {
		return `-${value}`;
	}

	let next = current;
	if (shouldInsertMultiplicationBeforeNumberIn(next)) {
		next += "*";
	}
	return next + value;
}

function appendDecimalTo(current) {
	const numberMatch = current.match(/(\d+\.?\d*)$/);
	if (numberMatch && numberMatch[0].includes(".")) {
		return current;
	}

	if (current === "" || isOperator(lastCharFrom(current)) || lastCharFrom(current) === "(") {
		return `${current}0.`;
	}

	return `${current}.`;
}

function appendOperatorTo(current, operator) {
	if (current === "") {
		return operator === "-" ? "-" : current;
	}

	if (current === "0" && operator === "-") {
		return "-0";
	}

	if (current === "-0" && operator === "-") {
		return current;
	}

	const last = lastCharFrom(current);
	if (isOperator(last)) {
		return current.slice(0, -1) + operator;
	}

	if (last === "(" && operator !== "-") {
		return current;
	}

	return current + operator;
}

function appendFunctionTo(current, fn) {
	let next = current;
	if (shouldInsertMultiplicationIn(next)) {
		next += "*";
	}
	return `${next}${fn}(`;
}

function appendConstantTo(current, constant) {
	let next = current;
	if (shouldInsertMultiplicationIn(next)) {
		next += "*";
	}
	return next + constant;
}

function appendXTo(current) {
	if (current === "0") {
		return "x";
	}

	if (current === "-0") {
		return "-x";
	}

	let next = current;
	if (shouldInsertMultiplicationIn(next)) {
		next += "*";
	}
	return `${next}x`;
}

function appendParenTo(current, value) {
	if (value === "(") {
		let next = current;
		if (shouldInsertMultiplicationIn(next)) {
			next += "*";
		}
		return next + "(";
	}

	const opens = (current.match(/\(/g) || []).length;
	const closes = (current.match(/\)/g) || []).length;
	const last = lastCharFrom(current);
 if (opens > closes && !isOperator(last) && last !== "(") {
		return current + ")";
	}

	return current;
}

function applySquareTo(current) {
	if (!current) {
		return current;
	}

	const last = lastCharFrom(current);
	if (isOperator(last) || last === "(") {
		return current;
	}

	return `${current}^2`;
}

function appendFractionTo(current) {
	if (!current || isOperator(lastCharFrom(current)) || lastCharFrom(current) === "(") {
		return `${current}1/(`;
	}

	return `${current}/(`;
}

function applyReciprocalTo(current) {
	if (!current) {
		return current;
	}

	const last = lastCharFrom(current);
	if (isOperator(last) || last === "(") {
		return current;
	}

	return `${current}^-1`;
}

function deleteLastFrom(current) {
	if (!current) {
		return current;
	}

	for (const suffix of functionSuffixes) {
		if (current.endsWith(suffix)) {
			return current.slice(0, -suffix.length);
		}
	}

	return current.slice(0, -1);
}

function shouldInsertMultiplicationIn(rawValue) {
	if (!rawValue) {
		return false;
	}

	const last = lastCharFrom(rawValue);
	return /[\d)eA-Zx]/.test(last) || rawValue.endsWith("pi");
}

function shouldInsertMultiplicationBeforeNumberIn(rawValue) {
	if (!rawValue) {
		return false;
	}

	const last = lastCharFrom(rawValue);
	return last === ")" || last === "e" || /[A-Zx]/.test(last) || rawValue.endsWith("pi");
}

function lastCharFrom(rawValue) {
	return rawValue[rawValue.length - 1];
}

function renderCalcTool() {
	if (!toolState.active || !toolState.type || !toolConfigs[toolState.type]) {
		calcToolEl.classList.add("hidden");
		displayEl.classList.remove("tool-open");
		displayEl.removeAttribute("data-tool");
		calcToolFieldsEl.innerHTML = "";
		if (eqnToggleBtn) {
			eqnToggleBtn.classList.remove("active");
		}
		return;
	}

	calcToolEl.classList.remove("hidden");
	displayEl.classList.add("tool-open");
	displayEl.setAttribute("data-tool", toolState.type);
	if (eqnToggleBtn) {
		eqnToggleBtn.classList.toggle("active", toolState.type === "cubic");
	}
	const config = toolConfigs[toolState.type];
	calcToolTitleEl.textContent = config.title;

	calcToolFieldsEl.innerHTML = config.fields
		.map((field) => {
			const rawValue = toolState.fields[field.key] || "";
			const shownValue = rawValue ? formatDisplayExpression(rawValue) : "0";
			const isActive = toolState.activeField === field.key;
			return `<button class="calc-tool-field${isActive ? " active" : ""}" data-field="${field.key}" type="button"><span class="calc-tool-label">${field.label}</span><span class="calc-tool-value">${shownValue}</span></button>`;
		})
		.join("");

	if (toolState.type === "differentiate" || config.fields.length % 2 !== 0) {
		calcToolFieldsEl.insertAdjacentHTML(
			"beforeend",
			"<button class=\"calc-tool-field calc-tool-quick\" data-tool-action=\"insert-x\" type=\"button\"><span class=\"calc-tool-quick-label\">x</span></button>"
		);
	}
}

function toRadians(value) {
	return angleMode === "DEG" ? value * (Math.PI / 180) : value;
}

function toSelectedAngle(value) {
	return angleMode === "DEG" ? value * (180 / Math.PI) : value;
}

function shouldInsertMultiplication() {
	if (!expression) {
		return false;
	}

	const last = lastChar();
	return /[\d)eA-Zx]/.test(last) || expression.endsWith("pi");
}

function shouldInsertMultiplicationBeforeNumber() {
	if (!expression) {
		return false;
	}

	const last = lastChar();
	return last === ")" || last === "e" || /[A-Zx]/.test(last) || expression.endsWith("pi");
}

function isOperator(char) {
	return operators.includes(char);
}

function lastChar() {
	return expression[expression.length - 1];
}

function updateFunctionLabels() {
	document.querySelectorAll('[data-action="function"]').forEach((button) => {
		const primary = button.dataset.fn;
		const alternate = button.dataset.alt;
		button.textContent = shiftMode && alternate ? inverseLabel(alternate) : primary;
	});
}

function clearCustomResult() {
	customResultText = "";
}

function setCustomResult(text) {
	customResultText = text;
}

function solveCubicRealRoots(a, b, c, d) {
	const epsilon = 1e-10;
	if (Math.abs(a) < epsilon) {
		return solveQuadraticRealRoots(b, c, d);
	}

	const normalizedA = b / a;
	const normalizedB = c / a;
	const normalizedC = d / a;

	const p = normalizedB - (normalizedA * normalizedA) / 3;
	const q = (2 * normalizedA * normalizedA * normalizedA) / 27 - (normalizedA * normalizedB) / 3 + normalizedC;
	const discriminant = (q * q) / 4 + (p * p * p) / 27;
	const shift = normalizedA / 3;

	if (discriminant > epsilon) {
		const sqrtDisc = Math.sqrt(discriminant);
		const u = Math.cbrt(-q / 2 + sqrtDisc);
		const v = Math.cbrt(-q / 2 - sqrtDisc);
		return [u + v - shift];
	}

	if (Math.abs(discriminant) <= epsilon) {
		const u = Math.cbrt(-q / 2);
		const root1 = 2 * u - shift;
		const root2 = -u - shift;
		return dedupeRoots([root1, root2]);
	}

	const radius = 2 * Math.sqrt(-p / 3);
	const angle = Math.acos((-q / 2) / Math.sqrt(-(p * p * p) / 27));
	const roots = [
		radius * Math.cos(angle / 3) - shift,
		radius * Math.cos((angle + 2 * Math.PI) / 3) - shift,
		radius * Math.cos((angle + 4 * Math.PI) / 3) - shift
	];

	return dedupeRoots(roots);
}

function solveQuadraticRealRoots(a, b, c) {
	const epsilon = 1e-10;
	if (Math.abs(a) < epsilon) {
		if (Math.abs(b) < epsilon) {
			return [];
		}

		return [-c / b];
	}

	const discriminant = b * b - 4 * a * c;
	if (discriminant < -epsilon) {
		return [];
	}

	if (Math.abs(discriminant) <= epsilon) {
		return [-b / (2 * a)];
	}

	const sqrtDisc = Math.sqrt(discriminant);
	return [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)];
}

function dedupeRoots(roots) {
	const epsilon = 1e-8;
	const sorted = [...roots].sort((left, right) => left - right);
	const unique = [];

	for (const root of sorted) {
		if (!unique.some((saved) => Math.abs(saved - root) < epsilon)) {
			unique.push(root);
		}
	}

	return unique;
}

function formatRootsResult(roots) {
	return roots.map((root, index) => `x${index + 1}=${formatRootValue(root)}`).join("  ");
}

function formatRootValue(value) {
	const nearZeroThreshold = 1e-9;
	const nearIntegerThreshold = 1e-9;

	if (Math.abs(value) < nearZeroThreshold) {
		return "0";
	}

	const nearestInteger = Math.round(value);
	if (Math.abs(value - nearestInteger) < nearIntegerThreshold) {
		return String(nearestInteger);
	}

	return formatResult(value);
}

function inverseLabel(alternate) {
	if (alternate === "asin") {
		return "sin⁻¹";
	}
	if (alternate === "acos") {
		return "cos⁻¹";
	}
	if (alternate === "atan") {
		return "tan⁻¹";
	}
	return alternate;
}

function formatDisplayExpression(value) {
	if (!value) {
		return "0";
	}

	return value
		.replace(/\*/g, "×")
		.replace(/\//g, "÷")
		.replace(/\^/g, "^")
		.replace(/pi/g, "π");
}

function formatResult(value) {
	if (Math.abs(value) >= 1e12 || (Math.abs(value) > 0 && Math.abs(value) < 1e-9)) {
		return value.toExponential(6);
	}

	const rounded = Number.parseFloat(value.toFixed(10));
	return String(rounded);
}

function render() {
	expressionEl.textContent = formatDisplayExpression(expression);
	if (!toolState.active) {
		schedulePreviewEvaluation();
		if (customResultText) {
			resultEl.textContent = customResultText;
		}
	}
	renderCalcTool();
}

function schedulePreviewEvaluation() {
	if (customResultText) {
		return;
	}

	if (PREVIEW_DEBOUNCE_MS === 0) {
		evaluateExpression(false);
		return;
	}

	if (previewTimerId) {
		clearTimeout(previewTimerId);
	}

	previewTimerId = setTimeout(() => {
		previewTimerId = null;
		if (!toolState.active && !customResultText) {
			evaluateExpression(false);
		}
	}, PREVIEW_DEBOUNCE_MS);
}

render();
