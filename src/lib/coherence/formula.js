// Safe arithmetic evaluator: substitutes named variables then evaluates
// the resulting expression.  Only digits, operators (+−×÷), parentheses
// and decimal points are allowed after substitution — any other character
// causes a hard throw, preventing code-injection via pack JSON.
export function evaluateFormula(formula, params) {
  let expr = String(formula);

  // Replace longest keys first to avoid partial matches (e.g. "surface" before "surface_sol")
  const keys = Object.keys(params).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const val = Number(params[key]);
    if (!isNaN(val)) {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, "g"), String(val));
    }
  }

  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    throw new Error(`Invalid formula after substitution: "${expr}"`);
  }

  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return (${expr})`)();
}
