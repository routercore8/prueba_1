(() => {
  // ---- Datos de ejemplo (reproducibles) ----
  const TIPOS = ["Contado", "Tarjeta", "Crédito", "Online"];
  const PRODUCTOS = ["Laptop", "Monitor", "Teclado", "Mouse", "Audífonos", "Impresora"];
  const PRECIOS = { Laptop: 850, Monitor: 220, Teclado: 45, Mouse: 25, Audífonos: 60, Impresora: 130 };

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(42);

  const ventas = [];
  const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  for (let i = 0; i < 250; i++) {
    const anio = [2023, 2024, 2025][Math.floor(rnd() * 3)];
    const mes = Math.floor(rnd() * 12) + 1;
    const dia = Math.floor(rnd() * 28) + 1;
    const tipo = TIPOS[Math.floor(rnd() * TIPOS.length)];
    const prod = PRODUCTOS[Math.floor(rnd() * PRODUCTOS.length)];
    const total = PRECIOS[prod] * (Math.floor(rnd() * 5) + 1);
    const diaSem = DIAS[new Date(anio, mes - 1, dia).getDay()];
    ventas.push({ anio, mes, dia, diaSem, tipo, prod, total });
  }

  // ---- Utilidades ----
  const fmt = n => n.toLocaleString("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmtNum = n => n.toLocaleString("es");

  const PALETTE = ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc"];

  // ---- Estado y filtros ----
  const anios = [...new Set(ventas.map(v => v.anio))].sort();
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  let filtroAnio = "all";
  let filtroMes = "all";

  const selAnio = document.getElementById("filtroAnio");
  const selMes = document.getElementById("filtroMes");

  anios.forEach(a => {
    const o = document.createElement("option");
    o.value = a; o.textContent = a;
    selAnio.appendChild(o);
  });
  selAnio.insertAdjacentHTML("afterbegin", '<option value="all">Todos</option>');
  selMes.insertAdjacentHTML("afterbegin", '<option value="all">Todos</option>');
  meses.forEach(m => {
    const o = document.createElement("option");
    o.value = m; o.textContent = m;
    selMes.appendChild(o);
  });

  const datosFiltrados = () =>
    ventas.filter(v =>
      (filtroAnio === "all" || v.anio === +filtroAnio) &&
      (filtroMes === "all" || v.mes === +filtroMes)
    );

  // ---- Gráficos ----
  const charts = {};
  const opciones = (extra = {}) => Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: "#e2e8f0" } },
      tooltip: {
        backgroundColor: "rgba(15,23,42,.95)",
        borderColor: "#38bdf8",
        borderWidth: 1,
        titleColor: "#38bdf8",
        bodyColor: "#e2e8f0",
        padding: 10
      }
    }
  }, extra);

  function baseData(labels, values, bg, border) {
    return { labels, datasets: [{ data: values, backgroundColor: bg, borderColor: border, borderWidth: 1.5, hoverOffset: 14 }] };
  }

  function crearPie(id, title, color) {
    const ctx = document.getElementById(id).getContext("2d");
    charts[id] = new Chart(ctx, {
      type: "pie",
      data: baseData([], [], [], "#fff"),
      options: opciones({ plugins: { legend: { position: "bottom", labels: { color: "#e2e8f0", padding: 12 } }, title: { display: true, text: title, color: "#94a3b8" } } })
    });
  }

  function crearBarra(id, tipo) {
    const ctx = document.getElementById(id).getContext("2d");
    charts[id] = new Chart(ctx, {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Total", data: [], backgroundColor: "#38bdf8", borderRadius: 6 }] },
      options: opciones({
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,.12)" } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,.12)" }, beginAtZero: true }
        }
      })
    });
  }

  function crearHistograma() {
    const ctx = document.getElementById("histograma").getContext("2d");
    charts.histograma = new Chart(ctx, {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Frecuencia", data: [], backgroundColor: "#fbbf24", borderRadius: 6 }] },
      options: opciones({
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,.12)" } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,.12)" }, beginAtZero: true }
        }
      })
    });
  }

  function crearDona() {
    const ctx = document.getElementById("donaSemana").getContext("2d");
    charts.donaSemana = new Chart(ctx, {
      type: "doughnut",
      data: baseData([], [], [], "#fff"),
      options: opciones({
        cutout: "62%",
        plugins: {
          legend: { position: "bottom", labels: { color: "#e2e8f0", padding: 10 } }
        }
      })
    });
  }

  // ---- Actualización ----
  function actualizar() {
    const d = datosFiltrados();
    const total = d.reduce((s, v) => s + v.total, 0);
    const promedio = d.length ? total / d.length : 0;

    const porTipo = {};
    const porProd = {};
    const porMes = {};
    const porAnio = {};
    const porSemana = {};
    TIPOS.forEach(t => porTipo[t] = 0);
    PRODUCTOS.forEach(p => porProd[p] = 0);
    meses.forEach(m => porMes[m] = 0);
    anios.forEach(a => porAnio[a] = 0);
    DIAS.forEach(d => porSemana[d] = 0);

    d.forEach(v => {
      porTipo[v.tipo] += v.total;
      porProd[v.prod] += v.total;
      porMes[v.mes] += v.total;
      porAnio[v.anio] += v.total;
      porSemana[v.diaSem] += v.total;
    });

    const top = Object.entries(porProd).sort((a, b) => b[1] - a[1])[0];
    const bins = [[0, 100], [100, 300], [300, 600], [600, 1000], [1000, 2000], [2000, 5000]];
    const freq = bins.map(([lo, hi]) => d.filter(v => v.total >= lo && v.total < hi).length);

    document.getElementById("kpiTotal").textContent = fmt(total);
    document.getElementById("kpiCount").textContent = fmtNum(d.length);
    document.getElementById("kpiPromedio").textContent = fmt(promedio);
    document.getElementById("kpiTop").textContent = top ? `${top[0]} (${fmt(top[1])})` : "—";

    const ordenado = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

    charts.tortaTipo.data = baseData(
      ordenado(porTipo).map(x => x[0]), ordenado(porTipo).map(x => x[1]), PALETTE, "#0f172a"
    );
    charts.tortaTipo.update();

    charts.tortaProducto.data = baseData(
      ordenado(porProd).map(x => x[0]), ordenado(porProd).map(x => x[1]), PALETTE, "#0f172a"
    );
    charts.tortaProducto.update();

    charts.barrasMes.data.labels = ordenado(porMes).map(x => x[0]);
    charts.barrasMes.data.datasets[0].data = ordenado(porMes).map(x => x[1]);
    charts.barrasMes.data.datasets[0].backgroundColor = "#38bdf8";
    charts.barrasMes.update();

    charts.barrasAnio.data.labels = ordenado(porAnio).map(x => x[0]);
    charts.barrasAnio.data.datasets[0].data = ordenado(porAnio).map(x => x[1]);
    charts.barrasAnio.data.datasets[0].backgroundColor = "#818cf8";
    charts.barrasAnio.update();

    charts.histograma.data.labels = bins.map(([lo, hi]) => `${lo}-${hi}`);
    charts.histograma.data.datasets[0].data = freq;
    charts.histograma.update();

    charts.donaSemana.data = baseData(
      DIAS, DIAS.map(d => porSemana[d]), PALETTE, "#0f172a"
    );
    charts.donaSemana.update();

    const cuerpo = document.querySelector("#tablaVentas tbody");
    if (!d.length) {
      cuerpo.innerHTML = '<tr><td colspan="7" class="tabla-vacia">Sin registros para los filtros seleccionados</td></tr>';
    } else {
      cuerpo.innerHTML = d.map(v => `
        <tr>
          <td>${v.anio}</td>
          <td>${v.mes}</td>
          <td>${v.dia}</td>
          <td>${v.diaSem}</td>
          <td>${v.tipo}</td>
          <td>${v.prod}</td>
          <td class="col-total">${fmt(v.total)}</td>
        </tr>`).join("");
    }
  }

  selAnio.addEventListener("change", e => { filtroAnio = e.target.value; actualizar(); });
  selMes.addEventListener("change", e => { filtroMes = e.target.value; actualizar(); });

  crearPie("tortaTipo", "Torta por Tipo de Venta");
  crearPie("tortaProducto", "Torta por Producto");
  crearBarra("barrasMes", "col");
  crearBarra("barrasAnio", "col");
  crearHistograma();
  crearDona();
  actualizar();
})();
