let currentLang = "ru";
let lastCombinationText = "";

const I18N = {
  ru: {
    subtitle: "Космический заяц вытягивает счастливые морковные шары (7 из 35 + 1 из 54) на основе 100% телеметрии орбитальных спутников (NOAA SWPC, GOES, SOLAR-1/ACE и МКС) + 16 B CSPRNG + 16 B Jitter.",
    sourceLabel: "🥕 Выберите космический источник энтропии:",
    generateBtn: "🐰 Сгенерировать числа",
    metaSourceLabel: "Активные источники",
    metaBytesLabel: "Размер пула энтропии",
    field1Label: "🥕 Поле 1 (7 уникальных из 1–35)",
    field2Label: "🐰 Поле 2 (1 из 1–54)",
    seedHashLabel: "Контрольный SHA-256 пула энтропии",
    copyBtn: "Копировать числа",
    copiedBtn: "Скопировано!",
    fetching: "🐰📡 Заяц собирает 100% телеметрии с орбитальных спутников...",
    success: "🥕✅ Космическая энтропия собрана, комбинация готова!",
    errPrefix: "❌ Ошибка: ",
    errNoApis: "Не удалось получить данные ни от одного космического API. Проверьте подключение к сети.",
    bytesFmt: (totalBytes, cosmicBytes, count) => `${totalBytes} байт (${cosmicBytes} Б космос + 16 Б CSPRNG + 16 Б Jitter, ${count} замеров)`,
    rawFmt: (sample) => `Фрагмент сырых замеров с датчиков: ${sample}...`
  },
  en: {
    subtitle: "The Cosmic Bunny draws lucky carrot balls (7 of 35 + 1 of 54) using 100% live orbital telemetry (NOAA SWPC, GOES, SOLAR-1/ACE, and ISS) + 16 B CSPRNG + 16 B Jitter.",
    sourceLabel: "🥕 Select cosmic entropy source:",
    generateBtn: "🐰 Generate Numbers",
    metaSourceLabel: "Active Sources",
    metaBytesLabel: "Entropy Pool Size",
    field1Label: "🥕 Field 1 (7 unique from 1–35)",
    field2Label: "🐰 Field 2 (1 from 1–54)",
    seedHashLabel: "Entropy Pool SHA-256 Digest",
    copyBtn: "Copy Numbers",
    copiedBtn: "Copied!",
    fetching: "🐰📡 Bunny is harvesting 100% live spacecraft telemetry...",
    success: "🥕✅ Cosmic entropy harvested, unbiased combination ready!",
    errPrefix: "❌ Error: ",
    errNoApis: "Unable to retrieve data from any cosmic API. Please check your network connection.",
    bytesFmt: (totalBytes, cosmicBytes, count) => `${totalBytes} bytes (${cosmicBytes} B space + 16 B CSPRNG + 16 B Jitter, ${count} readings)`,
    rawFmt: (sample) => `Sample raw sensor readings: ${sample}...`
  }
};

const SPACE_APIS = {
  solar_wind: {
    name: "NOAA RTSW Solar Wind (L1)",
    urls: [
      "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",
      "https://noaa-swpc-pds.s3.amazonaws.com/json/rtsw/rtsw_wind_1m.json",
      "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json"
    ]
  },
  mag_field: {
    name: "NOAA RTSW Magnetic Field (L1)",
    urls: [
      "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",
      "https://noaa-swpc-pds.s3.amazonaws.com/json/rtsw/rtsw_mag_1m.json",
      "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json"
    ]
  },
  xray: {
    name: "NOAA GOES X-Ray Flux",
    urls: [
      "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json",
      "https://services.swpc.noaa.gov/json/goes/secondary/xrays-6-hour.json"
    ]
  },
  protons: {
    name: "NOAA GOES Integral Protons",
    urls: [
      "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json",
      "https://services.swpc.noaa.gov/json/goes/secondary/integral-protons-6-hour.json"
    ]
  },
  iss: {
    name: "ISS Orbital Telemetry",
    urls: [
      "https://api.wheretheiss.at/v1/satellites/25544"
    ]
  }
};
function toggleLanguage() {
  currentLang = currentLang === "ru" ? "en" : "ru";
  document.documentElement.lang = currentLang;
  document.getElementById("langToggle").textContent = currentLang === "ru" ? "EN" : "RU";

  const t = I18N[currentLang];
  document.getElementById("subtitle").textContent = t.subtitle;
  document.getElementById("sourceLabel").textContent = t.sourceLabel;
  document.getElementById("generateBtn").textContent = t.generateBtn;
  document.getElementById("metaSourceLabel").textContent = t.metaSourceLabel;
  document.getElementById("metaBytesLabel").textContent = t.metaBytesLabel;
  document.getElementById("field1Label").textContent = t.field1Label;
  document.getElementById("field2Label").textContent = t.field2Label;
  document.getElementById("seedHashLabel").textContent = t.seedHashLabel;
  document.getElementById("copyComboBtn").textContent = t.copyBtn;

  document.querySelectorAll("#sourceSelect option").forEach(opt => {
    opt.textContent = opt.getAttribute(`data-${currentLang}`);
  });
}

function extractNumericChaos(obj, acc = []) {
  if (typeof obj === "number" && Number.isFinite(obj)) {
    acc.push(obj);
  } else if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(trimmed)) {
      const num = parseFloat(trimmed);
      if (Number.isFinite(num)) acc.push(num);
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) extractNumericChaos(item, acc);
  } else if (obj && typeof obj === "object") {
    for (const [k, val] of Object.entries(obj)) {
      if (k !== "active") {
        extractNumericChaos(val, acc);
      }
    }
  }
  return acc;
}

function extractLSBBytes(numbers) {
  const buffer = new ArrayBuffer(numbers.length * 8);
  const floatView = new Float64Array(buffer);
  const byteView = new Uint8Array(buffer);

  for (let i = 0; i < numbers.length; i++) {
    floatView[i] = numbers[i];
  }

  const lsbArray = new Uint8Array(numbers.length * 2);
  for (let i = 0; i < numbers.length; i++) {
    lsbArray[i * 2] = byteView[i * 8];
    lsbArray[i * 2 + 1] = byteView[i * 8 + 1];
  }
  return lsbArray;
}

function collectMicrosecondJitterBytes() {
  const jitterSamples = [];
  for (let i = 0; i < 8; i++) {
    let acc = 0;
    for (let j = 0; j < 64; j++) {
      acc += Math.sqrt(i * 64 + j + 1);
    }
    jitterSamples.push(performance.now() + acc * 1e-9);
  }
  return extractLSBBytes(jitterSamples);
}

async function sha256Bytes(uint8Array) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", uint8Array);
  return new Uint8Array(hashBuffer);
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function createEntropyDrbg(seedPool) {
  let counter = 0;
  let byteBuffer = new Uint8Array(0);
  let offset = 0;

  async function nextUint32() {
    if (offset + 4 > byteBuffer.length) {
      const counterBytes = new Uint8Array(4);
      new DataView(counterBytes.buffer).setUint32(0, counter++, false);

      const blockInput = new Uint8Array(seedPool.length + 4);
      blockInput.set(seedPool, 0);
      blockInput.set(counterBytes, seedPool.length);

      byteBuffer = await sha256Bytes(blockInput);
      offset = 0;
    }
    const val = new DataView(byteBuffer.buffer).getUint32(offset, false);
    offset += 4;
    return val;
  }

  async function nextInt(maxInclusive) {
    const range = maxInclusive >>> 0;
    const limit = Math.floor(0x100000000 / range) * range;
    let r;
    do {
      r = await nextUint32();
    } while (r >= limit);
    return (r % range) + 1;
  }

  return { nextInt };
}
async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchApiData(key) {
  const api = SPACE_APIS[key];
  let lastError = null;

  for (const url of api.urls) {
    try {
      const json = await fetchJsonWithTimeout(url, 8000);
      const numbers = extractNumericChaos(json);
      if (numbers.length > 0) {
        return { name: api.name, numbers };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`${api.name}: no numeric data`);
}

function renderLotteryBalls(field1Numbers, field2Number) {
  const yellowRow = document.getElementById("yellowBallsRow");
  const pinkSlot = document.getElementById("pinkBallSlot");

  yellowRow.innerHTML = field1Numbers.map((num, idx) => `
    <div class="lottery-ball ball-yellow" style="animation-delay: ${idx * 0.06}s">${num}</div>
  `).join("");

  pinkSlot.innerHTML = `
    <div class="lottery-ball ball-pink" style="animation-delay: 0.45s">${field2Number}</div>
  `;
}

async function generateCosmicLottery() {
  const t = I18N[currentLang];
  const btn = document.getElementById("generateBtn");
  const log = document.getElementById("statusLog");
  const resultBox = document.getElementById("resultBox");
  const selected = document.getElementById("sourceSelect").value;

  btn.disabled = true;
  resultBox.style.display = "none";
  log.textContent = t.fetching;

  try {
    const keysToFetch = selected === "all" ? Object.keys(SPACE_APIS) : [selected];
    const results = await Promise.allSettled(keysToFetch.map(k => fetchApiData(k)));

    const successful = results
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

    if (successful.length === 0) {
      throw new Error(t.errNoApis);
    }

    let allNumbers = [];
    const activeNames = [];

    for (const item of successful) {
      allNumbers = allNumbers.concat(item.numbers);
      activeNames.push(item.name);
    }

    // 1. 100% space readings LSBs
    const cosmicBytes = extractLSBBytes(allNumbers);

    // 2. 16 B HW CSPRNG
    const hardwareSeed = new Uint8Array(16);
    crypto.getRandomValues(hardwareSeed);

    // 3. 16 B Microsecond Jitter
    const jitterBytes = collectMicrosecondJitterBytes();

    // Hybrid pool: Space + 16 B CSPRNG + 16 B Jitter
    const combinedPool = new Uint8Array(cosmicBytes.length + hardwareSeed.length + jitterBytes.length);
    combinedPool.set(cosmicBytes, 0);
    combinedPool.set(hardwareSeed, cosmicBytes.length);
    combinedPool.set(jitterBytes, cosmicBytes.length + hardwareSeed.length);

    const poolDigest = await sha256Bytes(combinedPool);
    const drbg = createEntropyDrbg(combinedPool);

    // Field 1: 7 unique numbers from 1..35
    const field1Set = new Set();
    while (field1Set.size < 7) {
      const n = await drbg.nextInt(35);
      field1Set.add(n);
    }
    const field1Sorted = Array.from(field1Set).sort((a, b) => a - b);

    // Field 2: 1 number from 1..54 (allowed to match any number from Field 1)
    const field2Number = await drbg.nextInt(54);

    // Update UI
    document.getElementById("metaSource").textContent = activeNames.join(" + ");
    document.getElementById("metaBytes").textContent = t.bytesFmt(
      combinedPool.length,
      cosmicBytes.length,
      allNumbers.length
    );
    document.getElementById("seedHashOutput").textContent = bytesToHex(poolDigest);
    document.getElementById("rawPreview").textContent = t.rawFmt(
      allNumbers.slice(0, 12).join(", ")
    );

    renderLotteryBalls(field1Sorted, field2Number);
    lastCombinationText = `${field1Sorted.join(", ")} + [${field2Number}]`;

    log.textContent = t.success;
    resultBox.style.display = "block";
  } catch (err) {
    log.textContent = t.errPrefix + err.message;
  } finally {
    btn.disabled = false;
  }
}

function copyCombination() {
  if (!lastCombinationText) return;
  const t = I18N[currentLang];
  const btn = document.getElementById("copyComboBtn");

  navigator.clipboard.writeText(lastCombinationText);
  btn.textContent = t.copiedBtn;
  setTimeout(() => {
    btn.textContent = t.copyBtn;
  }, 2000);
}
