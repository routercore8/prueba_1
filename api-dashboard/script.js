(() => {
  const $ = sel => document.querySelector(sel);

  const loading = (el, msg = "Cargando...") => { el.innerHTML = `<span class="loading">${msg}</span>`; };
  const errorEl = (el, msg) => { el.innerHTML = `<div class="error">⚠️ ${msg}</div>`; };

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ===================== Traductor automático (EN → ES) =====================
  const cacheTraduccion = new Map();
  async function traducir(texto) {
    if (!texto) return texto;
    if (cacheTraduccion.has(texto)) return cacheTraduccion.get(texto);
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(texto)}`
      );
      const data = await res.json();
      const trad = data[0].map(seg => seg[0] || "").join("").trim();
      const resultado = trad || texto;
      cacheTraduccion.set(texto, resultado);
      return resultado;
    } catch (e) {
      return texto;
    }
  }
  const traducirT = texto => traducir(texto).then(t => `<span title="Original: ${texto}">${t}</span>`);

  // ===================== Clima (Open-Meteo) =====================
  const clima = $("#clima");
  let climaLat = 19.43, climaLon = -99.13, climaCity = "Ciudad de México";

  const CODES = {
    0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado",
    45: "Niebla", 48: "Niebla helada", 51: "Llovizna ligera", 53: "Llovizna", 55: "Llovizna densa",
    61: "Lluvia ligera", 63: "Lluvia", 65: "Lluvia intensa", 71: "Nieve ligera", 73: "Nieve",
    75: "Nieve intensa", 80: "Chubascos ligeros", 81: "Chubascos", 82: "Chubascos violentos",
    95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta con granizo fuerte"
  };

  async function cargarClima(lat, lon, city) {
    loading(clima, "Obteniendo clima...");
    try {
      const d = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
      const cw = d.current_weather;
      const desc = CODES[cw.weathercode] || `Código ${cw.weathercode}`;
      clima.innerHTML = `
        <div class="clima-city">📍 ${city}</div>
        <div class="clima-temp">${Math.round(cw.temperature)}°C</div>
        <div class="clima-desc">${desc} · viento ${cw.windspeed} km/h</div>
        <div class="clima-meta">
          <span>Máx: ${d.daily.temperature_2m_max[0]}°C</span>
          <span>Mín: ${d.daily.temperature_2m_min[0]}°C</span>
          <span>Actualizado: ${new Date(cw.time).toLocaleTimeString("es")}</span>
        </div>`;
    } catch (e) {
      errorEl(clima, "No se pudo obtener el clima.");
    }
  }

  $("#btnClima").addEventListener("click", async () => {
    const ciudad = $("#ciudad").value.trim();
    if (!ciudad) return;
    loading(clima, "Buscando ciudad...");
    try {
      const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es&format=json`);
      if (!g.results || !g.results.length) {
        errorEl(clima, `No se encontró la ciudad "${ciudad}".`);
        return;
      }
      climaLat = g.results[0].latitude;
      climaLon = g.results[0].longitude;
      climaCity = g.results[0].name + (g.results[0].country ? `, ${g.results[0].country}` : "");
      cargarClima(climaLat, climaLon, climaCity);
    } catch (e) {
      errorEl(clima, "Error buscando la ciudad.");
    }
  });

  // ===================== Cripto (CoinGecko) =====================
  const CRYPTOS = [
    ["bitcoin", "Bitcoin", "₿"],
    ["ethereum", "Ethereum", "Ξ"],
    ["solana", "Solana", "◎"],
    ["dogecoin", "Dogecoin", "Ð"],
    ["cardano", "Cardano", "₳"]
  ];
  const selCripto = $("#cripto");
  CRYPTOS.forEach(([id, name, sym]) => {
    const o = document.createElement("option");
    o.value = id; o.textContent = `${name} (${sym})`;
    selCripto.appendChild(o);
  });

  let spark = null;
  const cryptoPrice = $("#cryptoPrice");
  const sparkCtx = $("#sparkline").getContext("2d");

  async function cargarCripto() {
    const id = selCripto.value;
    const [, name] = CRYPTOS.find(c => c[0] === id) || [];
    cryptoPrice.textContent = "Cargando...";
    try {
      const p = await getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`);
      const precio = p[id].usd;
      const cambio = p[id].usd_24h_change || 0;
      cryptoPrice.innerHTML = `<span>${name}</span> ${precio.toLocaleString("es", { style: "currency", currency: "USD" })}`;
      const chg = document.querySelector(".crypto-extra");
      if (chg) chg.remove();
      const extra = document.createElement("div");
      extra.className = "crypto-extra";
      extra.style.color = cambio >= 0 ? "var(--success)" : "var(--danger)";
      extra.textContent = `24h: ${cambio >= 0 ? "+" : ""}${cambio.toFixed(2)}%`;
      cryptoPrice.insertAdjacentElement("afterend", extra);

      const hist = await getJSON(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=7`);
      const labels = hist.prices.map(([t]) => new Date(t).toLocaleDateString("es", { day: "2-digit", month: "2-digit" }));
      const data = hist.prices.map(([, v]) => v);
      if (spark) spark.destroy();
      spark = new Chart(sparkCtx, {
        type: "line",
        data: { labels, datasets: [{ data, borderColor: "#38bdf8", backgroundColor: "rgba(56,189,248,.15)", fill: true, tension: .35, pointRadius: 0 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: "#94a3b8", maxTicksLimit: 7 }, grid: { display: false } }, y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,.12)" } } }
        }
      });
    } catch (e) {
      cryptoPrice.textContent = "Error al obtener datos";
    }
  }
  selCripto.addEventListener("change", cargarCripto);

  // ===================== Pokémon (PokeAPI) =====================
  const pokemon = $("#pokemon");
  async function cargarPokemon() {
    loading(pokemon, "Atrapando un Pokémon...");
    try {
      const total = (await getJSON("https://pokeapi.co/api/v2/pokemon?limit=0")).count;
      const id = Math.floor(Math.random() * total) + 1;
      const p = await getJSON(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const img = p.sprites.other["official-artwork"]?.front_default || p.sprites.front_default;
      const [nombreEs, ...tiposEs] = await Promise.all([
        traducir(p.name),
        ...p.types.map(t => traducir(t.type.name))
      ]);
      const tipos = tiposEs.map(n => `<span class="chip">${n}</span>`).join("");
      pokemon.innerHTML = `
        <img src="${img}" alt="${p.name}" onerror="this.style.visibility='hidden'">
        <div class="pokemon-info">
          <h3>#${String(id).padStart(3, "0")} · ${nombreEs}</h3>
          <p>${tipos}</p>
          <p>Altura: ${(p.height / 10).toFixed(1)} m · Peso: ${(p.weight / 10).toFixed(1)} kg</p>
        </div>`;
    } catch (e) {
      errorEl(pokemon, "No se pudo cargar el Pokémon.");
    }
  }
  $("#btnPokemon").addEventListener("click", cargarPokemon);

  // ===================== Perro (Dog CEO) =====================
  const perro = $("#perro");
  async function cargarPerro() {
    loading(perro, "Buscando un perro...");
    try {
      const d = await getJSON("https://dog.ceo/api/breeds/image/random");
      perro.innerHTML = `<div class="zorro"><img src="${d.message}" alt="Perro aleatorio"></div>`;
    } catch (e) {
      errorEl(perro, "No se pudo cargar el perro.");
    }
  }
  $("#btnPerro").addEventListener("click", cargarPerro);

  // ===================== Chistes (Official Joke API) =====================
  const joke = $("#joke");
  async function cargarJoke() {
    loading(joke, "Pensando un chiste...");
    try {
      const j = await getJSON("https://official-joke-api.appspot.com/random_joke");
      const [setup, punch] = await Promise.all([traducir(j.setup), traducir(j.punchline)]);
      joke.innerHTML = `
        <div class="joke-setup">${setup}</div>
        <div class="joke-punch">${punch}</div>`;
    } catch (e) {
      errorEl(joke, "No se pudo cargar el chiste.");
    }
  }
  $("#btnJoke").addEventListener("click", cargarJoke);

  // ===================== Datos curiosos (Useless Facts) =====================
  const fact = $("#fact");
  async function cargarFact() {
    loading(fact, "Buscando un dato curioso...");
    try {
      const f = await getJSON("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
      const texto = await traducir(f.text);
      fact.innerHTML = `<div class="fact-text">💡 ${texto}</div>`;
    } catch (e) {
      errorEl(fact, "No se pudo cargar el dato.");
    }
  }
  $("#btnFact").addEventListener("click", cargarFact);

  // ===================== Chuck Norris (ChuckNorris.io) =====================
  const chuck = $("#chuck");
  async function cargarChuck() {
    loading(chuck, "Consultando a Chuck Norris...");
    try {
      const j = await getJSON("https://api.chucknorris.io/jokes/random");
      const texto = await traducir(j.value);
      chuck.innerHTML = `<div class="fact-text">🥋 ${texto}</div>`;
    } catch (e) {
      errorEl(chuck, "No se pudo cargar el dato de Chuck.");
    }
  }
  $("#btnChuck").addEventListener("click", cargarChuck);

  // ===================== Consejos (Advice Slip) =====================
  const advice = $("#advice");
  async function cargarAdvice() {
    loading(advice, "Pidiendo un consejo...");
    try {
      const d = await getJSON("https://api.adviceslip.com/advice");
      const texto = await traducir(d.slip.advice);
      advice.innerHTML = `<div class="fact-text">🧠 "${texto}"</div>`;
    } catch (e) {
      errorEl(advice, "No se pudo cargar el consejo.");
    }
  }
  $("#btnAdvice").addEventListener("click", cargarAdvice);

  // ===================== Citas de Kanye (Kanye Rest) =====================
  const kanye = $("#kanye");
  async function cargarKanye() {
    loading(kanye, "Pensando como Kanye...");
    try {
      const d = await getJSON("https://api.kanye.rest/");
      const texto = await traducir(d.quote);
      kanye.innerHTML = `<div class="fact-text">🎤 "${texto}"</div><div class="joke-punch">— Kanye West</div>`;
    } catch (e) {
      errorEl(kanye, "No se pudo cargar la cita.");
    }
  }
  $("#btnKanye").addEventListener("click", cargarKanye);

  // ===================== Perfil aleatorio (Random User) =====================
  const user = $("#user");
  async function cargarUser() {
    loading(user, "Generando perfil...");
    try {
      const d = await getJSON("https://randomuser.me/api/");
      const u = d.results[0];
      const pais = await traducir(u.location.country);
      user.innerHTML = `
        <img src="${u.picture.large}" alt="Perfil">
        <div class="user-info">
          <h3>${u.name.title} ${u.name.first} ${u.name.last}</h3>
          <p>📧 ${u.email}</p>
          <p>📍 ${u.location.city}, ${pais}</p>
          <p>🎂 ${new Date(u.dob.date).toLocaleDateString("es")}</p>
        </div>`;
    } catch (e) {
      errorEl(user, "No se pudo generar el perfil.");
    }
  }
  $("#btnUser").addEventListener("click", cargarUser);

  // ===================== Análisis de nombre (Genderize/Agify/Nationalize) =====================
  const nombreResult = $("#nombreResult");
  async function analizarNombre() {
    const nombre = $("#nombre").value.trim();
    if (!nombre) return;
    loading(nombreResult, `Analizando "${nombre}"...`);
    try {
      const [g, a, n] = await Promise.all([
        getJSON(`https://api.genderize.io/?name=${nombre}`),
        getJSON(`https://api.agify.io/?name=${nombre}`),
        getJSON(`https://api.nationalize.io/?name=${nombre}`)
      ]);
      const pais = n.country && n.country.length
        ? n.country.sort((x, y) => y.probability - x.probability)[0].country_id
        : "—";
      const genero = g.gender ? await traducir(g.gender) : "—";
      const pct = g.probability ? Math.round(g.probability * 100) : 0;
      nombreResult.innerHTML = `
        <div class="nombre-grid">
          <div class="nombre-item"><div class="lbl">Género</div><div class="val">${genero} (${pct}%)</div></div>
          <div class="nombre-item"><div class="lbl">Edad estimada</div><div class="val">${a.age ?? "—"}</div></div>
          <div class="nombre-item"><div class="lbl">País probable</div><div class="val">${pais}</div></div>
        </div>`;
    } catch (e) {
      errorEl(nombreResult, "No se pudo analizar el nombre.");
    }
  }
  $("#btnNombre").addEventListener("click", analizarNombre);
  $("#nombre").addEventListener("keydown", e => { if (e.key === "Enter") analizarNombre(); });

  // ===================== Zorro (Random Fox) =====================
  const zorro = $("#zorro");
  async function cargarZorro() {
    loading(zorro, "Buscando un zorro...");
    try {
      const d = await getJSON("https://randomfox.ca/floof/");
      zorro.innerHTML = `<div class="zorro"><img src="${d.image}" alt="Zorro aleatorio"></div>`;
    } catch (e) {
      errorEl(zorro, "No se pudo cargar el zorro.");
    }
  }
  $("#btnZorro").addEventListener("click", cargarZorro);

  // ===================== Rick & Morty (Rick and Morty API) =====================
  const rick = $("#rick");
  async function cargarRick() {
    loading(rick, "Viajando a otra dimensión...");
    try {
      const totalR = await getJSON("https://rickandmortyapi.com/api/character");
      const id = Math.floor(Math.random() * totalR.info.count) + 1;
      const p = await getJSON(`https://rickandmortyapi.com/api/character/${id}`);
      const [especie, genero, estado, origen] = await Promise.all([
        traducir(p.species), traducir(p.gender), traducir(p.status), traducir(p.origin.name)
      ]);
      const estadoColor = p.status === "Alive" ? "var(--success)" : p.status === "Dead" ? "var(--danger)" : "var(--warn)";
      rick.innerHTML = `
        <img src="${p.image}" alt="${p.name}">
        <div class="pokemon-info">
          <h3>${p.name}</h3>
          <p><span class="chip">${especie}</span><span class="chip">${genero}</span></p>
          <p style="color:${estadoColor};font-weight:700">● ${estado}</p>
          <p>Origen: ${origen}</p>
        </div>`;
    } catch (e) {
      errorEl(rick, "No se pudo cargar el personaje.");
    }
  }
  $("#btnRick").addEventListener("click", cargarRick);

  // ===================== ISS (wheretheiss.at) =====================
  const iss = $("#iss");
  async function cargarIss() {
    loading(iss, "Rastreando la ISS...");
    try {
      const s = await getJSON("https://api.wheretheiss.at/v1/satellites/25544");
      const lat = s.latitude.toFixed(2), lon = s.longitude.toFixed(2);
      iss.innerHTML = `
        <div class="iss-grid">
          <div class="iss-item"><div class="lbl">Latitud</div><div class="val">${lat}°</div></div>
          <div class="iss-item"><div class="lbl">Longitud</div><div class="val">${lon}°</div></div>
          <div class="iss-item"><div class="lbl">Altitud</div><div class="val">${Math.round(s.altitude)} km</div></div>
          <div class="iss-item"><div class="lbl">Velocidad</div><div class="val">${Math.round(s.velocity)} km/h</div></div>
          <div class="iss-item"><div class="lbl">Visibilidad</div><div class="val">${s.visibility}</div></div>
          <div class="iss-item"><div class="lbl">Actualizado</div><div class="val">${new Date(s.timestamp * 1000).toLocaleTimeString("es")}</div></div>
        </div>
        <a class="iss-map" href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener">Ver en Google Maps →</a>`;
    } catch (e) {
      errorEl(iss, "No se pudo rastrear la ISS.");
    }
  }
  $("#btnIss").addEventListener("click", cargarIss);

  // ===================== Carga inicial =====================
  cargarClima(climaLat, climaLon, climaCity);
  cargarCripto();
  cargarPokemon();
  cargarPerro();
  cargarJoke();
  cargarFact();
  cargarIss();
  cargarChuck();
  cargarAdvice();
  cargarKanye();
  cargarUser();
  cargarZorro();
  cargarRick();

  $("#btnRecargar").addEventListener("click", () => {
    cargarClima(climaLat, climaLon, climaCity);
    cargarCripto();
    cargarPokemon();
    cargarPerro();
    cargarJoke();
    cargarFact();
    cargarIss();
    cargarChuck();
    cargarAdvice();
    cargarKanye();
    cargarUser();
    cargarZorro();
    cargarRick();
  });
})();
