const $ = (id) => document.getElementById(id);
let lastTokens = [];

function encodeLZ77(text, dictSize, bufferSize) {
  const tokens = [];
  let pos = 0;
  while (pos < text.length) {
    const dictStart = Math.max(0, pos - dictSize);
    const dictionary = text.slice(dictStart, pos);
    const maxLen = Math.min(bufferSize, text.length - pos);
    let bestOffset = 0, bestLength = 0;

    for (let len = 1; len <= maxLen; len++) {
      const fragment = text.slice(pos, pos + len);
      const index = dictionary.lastIndexOf(fragment);
      if (index !== -1) {
        bestOffset = dictionary.length - index;
        bestLength = len;
      }
    }

    const next = text[pos + bestLength] ?? "";
    tokens.push({ offset: bestOffset, length: bestLength, next });
    pos += bestLength + 1;
  }
  return tokens;
}

function normalizeTokens(parsed) {
  // Поддерживаем оба удобных формата:
  // 1) [{"offset":0,"length":0,"next":"a"}, ...]
  // 2) [[0,0,"a"], [0,0,"b"], ...]
  const source = Array.isArray(parsed) ? parsed : parsed?.tokens;
  if (!Array.isArray(source)) {
    throw new Error("ожидается массив токенов или объект { tokens: [...] }");
  }

  return source.map((token, index) => {
    let offset, length, next;

    if (Array.isArray(token)) {
      [offset, length, next = ""] = token;
    } else if (token && typeof token === "object") {
      ({ offset, length, next = "" } = token);
    } else {
      throw new Error(`токен #${index + 1} имеет неверный формат`);
    }

    offset = Number(offset);
    length = Number(length);

    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error(`в токене #${index + 1} offset должен быть целым числом >= 0`);
    }
    if (!Number.isInteger(length) || length < 0) {
      throw new Error(`в токене #${index + 1} length должен быть целым числом >= 0`);
    }
    if (next === null || next === undefined) next = "";
    if (typeof next !== "string") next = String(next);

    return { offset, length, next };
  });
}

function decodeLZ77(tokens) {
  let out = "";
  for (const t of tokens) {
    if (t.offset > 0 && t.length > 0) {
      const start = out.length - t.offset;
      if (start < 0) throw new Error("offset указывает за начало восстановленного текста");
      for (let i = 0; i < t.length; i++) {
        const ch = out[start + i];
        if (ch === undefined) throw new Error("невозможно скопировать символ по указанной ссылке");
        out += ch;
      }
    }
    out += t.next ?? "";
  }
  return out;
}

function renderTokens(tokens) {
  const box = $("tokens");
  box.classList.remove("empty");
  box.innerHTML = tokens.map((t, i) => `<div class="token">#${i + 1}: (${t.offset}, ${t.length}, ${JSON.stringify(t.next)})</div>`).join("");
}

function updateStats(text, decoded, tokens, mode = "encode") {
  const raw = new Blob([text]).size;
  const coded = new Blob([JSON.stringify(tokens)]).size;
  const ratio = raw ? (coded / raw).toFixed(2) : "—";
  $("stats").innerHTML = `
    <div class="stat"><span>Символов</span><b>${mode === "decode" ? decoded.length : text.length}</b></div>
    <div class="stat"><span>Токенов</span><b>${tokens.length}</b></div>
    <div class="stat"><span>JSON / текст</span><b>${ratio}</b></div>`;

  const check = $("check");
  if (mode === "decode") {
    check.textContent = `Декодирование выполнено: восстановлено ${decoded.length} символов`;
    check.className = "check ok";
  } else {
    check.textContent = text === decoded ? "Проверка пройдена: текст восстановлен" : "Есть расхождение";
    check.className = "check " + (text === decoded ? "ok" : "fail");
  }
}

$("encodeBtn").addEventListener("click", () => {
  const text = $("inputText").value;
  if (!text) {
    $("tokens").className = "tokens empty";
    $("tokens").textContent = "Введите текст для кодирования";
    $("stats").innerHTML = "";
    $("decodedText").value = "";
    $("check").className = "check fail";
    $("check").textContent = "Нет входных данных";
    return;
  }
  const dictSize = Math.max(1, Number($("dictSize").value));
  const bufferSize = Math.max(1, Number($("bufferSize").value));
  lastTokens = encodeLZ77(text, dictSize, bufferSize);
  const decoded = decodeLZ77(lastTokens);
  renderTokens(lastTokens);
  $("tokenJson").value = JSON.stringify(lastTokens, null, 2);
  $("decodedText").value = decoded;
  updateStats(text, decoded, lastTokens, "encode");
});

$("decodeBtn").addEventListener("click", () => {
  try {
    const rawJson = $("tokenJson").value.trim();
    if (!rawJson) throw new Error("поле JSON пустое");

    const parsed = JSON.parse(rawJson);
    const tokens = normalizeTokens(parsed);
    const decoded = decodeLZ77(tokens);

    lastTokens = tokens;
    renderTokens(tokens);
    $("tokenJson").value = JSON.stringify(tokens, null, 2);
    $("decodedText").value = decoded;
    updateStats($("inputText").value, decoded, tokens, "decode");
  } catch (e) {
    $("decodedText").value = "";
    $("check").className = "check fail";
    $("check").textContent = "Ошибка JSON: " + e.message;
  }
});

$("demoBtn").addEventListener("click", () => {
  $("inputText").value = "abracadabra abracadabra — пример для LZ77";
  $("dictSize").value = 16;
  $("bufferSize").value = 10;
  $("encodeBtn").click();
});

$("clearBtn").addEventListener("click", () => {
  ["inputText", "tokenJson", "decodedText"].forEach(id => $(id).value = "");
  $("tokens").className = "tokens empty";
  $("tokens").textContent = "Пока нет результата";
  $("stats").innerHTML = "";
  $("check").className = "check";
  $("check").textContent = "—";
});
