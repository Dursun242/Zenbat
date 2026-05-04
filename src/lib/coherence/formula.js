// Safe arithmetic evaluator — parser récursif sans eval ni new Function().
// Grammaire supportée : +  −  *  /  (  )  nombres décimaux  moins unaire.
export function evaluateFormula(formula, params) {
  let expr = String(formula);

  // Substitue les variables par leur valeur numérique (clés les plus longues en premier)
  const keys = Object.keys(params).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const val = Number(params[key]);
    if (!isNaN(val)) {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, "g"), String(val));
    }
  }

  // Après substitution, seuls les caractères arithmétiques sont tolérés
  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    throw new Error(`Invalid formula after substitution: "${expr}"`);
  }

  return parse(expr.replace(/\s+/g, ""));
}

// ─── Parser récursif descendant ────────────────────────────────────────────

function parse(input) {
  let pos = 0;

  function peek()    { return input[pos]; }
  function consume() { return input[pos++]; }

  function parseExpr() {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parseFactor();
      if (op === "/" && right === 0) throw new Error("Division par zéro");
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseFactor() {
    // Moins unaire
    if (peek() === "-") { consume(); return -parseFactor(); }
    // Parenthèses
    if (peek() === "(") {
      consume();
      const val = parseExpr();
      if (consume() !== ")") throw new Error("Parenthèse fermante manquante");
      return val;
    }
    // Nombre décimal
    let num = "";
    while (/[\d.]/.test(peek() ?? "")) num += consume();
    if (!num) throw new Error(`Caractère inattendu : "${peek()}"`);
    return Number(num);
  }

  const result = parseExpr();
  if (pos !== input.length) throw new Error(`Expression non consommée à pos ${pos}`);
  return result;
}
