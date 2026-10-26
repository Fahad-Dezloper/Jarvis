// Safe arithmetic for the voice-driven Calculator: a tokenizer and a recursive
// descent parser. Never uses eval or Function. No alias imports.
//
// Supports + - * / ^ ( ) %, "N% of M", "x percent of y", and words such as
// times, plus, minus, divided by, squared.

const WORD_REPLACEMENTS = [
  [
    /\b(what is|what's|whats|calculate|compute|evaluate|work out|how much is|equals?|please)\b/g,
    " ",
  ],
  [/(\d),(?=\d{3}\b)/g, "$1"],
  [/\bto the power of\b|\bpower\b/g, " ^ "],
  [/\bsquared\b/g, " ^ 2 "],
  [/\bcubed\b/g, " ^ 3 "],
  [/\bpercent\s+of\b|%\s*of\b/g, " % of "],
  [/\bper\s?cent\b|\bpercent\b/g, " % "],
  [/\bmultiplied by\b|\btimes\b|\bmultiply by\b|[×*]/g, " * "],
  [/\bdivided by\b|\bdivide by\b|\bover\b|[÷]/g, " / "],
  [/\bplus\b|\band\b/g, " + "],
  [/\bminus\b|\bless\b|[−–]/g, " - "],
  [/(?<=\d)\s*x\s*(?=\d)/g, " * "],
  [/[=?]/g, " "],
];

export function tokenize(input) {
  let s = String(input ?? "")
    .toLowerCase()
    .slice(0, 200);
  for (const [re, rep] of WORD_REPLACEMENTS) s = s.replace(re, rep);
  const tokens = [];
  const re = /\s*(\d+\.?\d*|\.\d+|of\b|[+\-*/^()%])/gy;
  let pos = 0;
  s = s.trim();
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) throw new Error(`I did not understand "${s.slice(pos, pos + 12).trim()}".`);
    pos = re.lastIndex;
    const t = m[1];
    tokens.push(/^[\d.]/.test(t) ? { type: "num", value: Number(t) } : { type: t });
  }
  if (!tokens.length) throw new Error("There is nothing to calculate.");
  return tokens;
}

export function evaluateTokens(tokens) {
  let i = 0;
  const peek = () => tokens[i]?.type;
  const take = () => tokens[i++];
  let depth = 0;

  // Each parse function returns { v, pct } where pct marks a bare "N%" operand.
  function expr() {
    let left = term();
    while (peek() === "+" || peek() === "-") {
      const op = take().type;
      const right = term();
      const rv = right.pct ? left.v * right.v : right.v; // 100 + 10% = 110
      left = { v: op === "+" ? left.v + rv : left.v - rv };
    }
    return left;
  }
  function term() {
    let left = unary();
    while (peek() === "*" || peek() === "/" || peek() === "num" || peek() === "(") {
      let op = "*";
      if (peek() === "*" || peek() === "/") op = take().type;
      const right = unary();
      if (op === "/" && right.v === 0) throw new Error("Cannot divide by zero.");
      left = { v: op === "*" ? left.v * right.v : left.v / right.v };
    }
    return left;
  }
  function unary() {
    if (peek() === "-") {
      take();
      const r = unary();
      return { v: -r.v };
    }
    if (peek() === "+") {
      take();
      return unary();
    }
    return power();
  }
  function power() {
    const base = postfix();
    if (peek() === "^") {
      take();
      const exp = unary();
      return { v: Math.pow(base.v, exp.v) };
    }
    return base;
  }
  function postfix() {
    let p = primary();
    while (peek() === "%") {
      take();
      if (peek() === "of") {
        take();
        const m = power();
        p = { v: (p.v / 100) * m.v };
      } else {
        p = { v: p.v / 100, pct: true };
      }
    }
    return p;
  }
  function primary() {
    const t = take();
    if (!t) throw new Error("The expression ends too early.");
    if (t.type === "num") return { v: t.value };
    if (t.type === "(") {
      if (++depth > 20) throw new Error("Too many nested brackets.");
      const inner = expr();
      if (take()?.type !== ")") throw new Error("A bracket is not closed.");
      depth--;
      return inner;
    }
    throw new Error(`Unexpected "${t.type}".`);
  }

  const out = expr();
  if (i < tokens.length) throw new Error(`Unexpected "${tokens[i].type}".`);
  if (!Number.isFinite(out.v)) throw new Error("The result is not a finite number.");
  return out.v;
}

export function formatNumber(n) {
  const rounded = Math.round(n * 1e10) / 1e10;
  if (Math.abs(rounded) >= 1e15) return rounded.toExponential(6);
  return String(rounded);
}

/** @returns {{ok:true,value:number,text:string,expr:string}|{ok:false,error:string}} */
export function compute(input) {
  try {
    const tokens = tokenize(input);
    const value = evaluateTokens(tokens);
    const expr = tokens
      .map((t) =>
        t.type === "num"
          ? String(t.value)
          : t.type === "*"
            ? "×"
            : t.type === "/"
              ? "÷"
              : t.type === "of"
                ? "of"
                : t.type,
      )
      .join(" ")
      .replace(/\( /g, "(")
      .replace(/ \)/g, ")")
      .replace(/ %/g, "%");
    return { ok: true, value, text: formatNumber(value), expr };
  } catch (err) {
    return { ok: false, error: err?.message || "Could not calculate that." };
  }
}
