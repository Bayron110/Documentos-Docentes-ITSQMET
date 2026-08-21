import { db } from "../../firebase/firebase.js";
import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const form            = document.getElementById("formAvance");
const cedulaInput     = document.getElementById("cedula");
const estado          = document.getElementById("estado");
const btnBuscar       = document.getElementById("btnBuscar");
const presultados     = document.getElementById("presultados");
const listaPatrocinio = document.getElementById("listaPatrocinio");
const listaPlan       = document.getElementById("listaPlan");

const API_BASE = "https://backen-pdf-trabajo.onrender.com";

// ─────────────────────────────────────────────
// HELPERS DE ESTADO
// ─────────────────────────────────────────────
function setEstado(msg, tipo = "") {
  estado.textContent = msg;
  estado.className   = "pestado" + (tipo ? " " + tipo : "");
}

function setCargando(cargando) {
  btnBuscar.disabled = cargando;
  btnBuscar.style.opacity = cargando ? "0.6" : "1";
}

// ─────────────────────────────────────────────
// UTILIDADES (mismas que en el formulario de Plan Individual)
// ─────────────────────────────────────────────
function normalizarTexto(texto) {
  return String(texto || "").trim().toLowerCase();
}

function limpiarNombreArchivo(texto) {
  return String(texto || "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function limpiarClave(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function valorSeguro(valor, fallback = "") {
  return valor === undefined || valor === null || valor === "" ? fallback : valor;
}

function formatoFecha(fechaISO) {
  if (!fechaISO) return "";
  const partes = String(fechaISO).split("-");
  if (partes.length !== 3) return fechaISO;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function convertirMesANombre(numeroMes) {
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  return meses[Number(numeroMes) - 1] || "";
}

function formatearFechaLarga(fechaISO) {
  if (!fechaISO) return "";
  const partes = String(fechaISO).split("-");
  if (partes.length !== 3) return "";
  const anio = partes[0], mes = partes[1], dia = Number(partes[2]);
  if (!anio || !mes || !dia) return "";
  return `${dia} de ${convertirMesANombre(mes)} de ${anio}`;
}

function construirRangoFechaTexto(fechaInicio, fechaFin) {
  const inicio = formatearFechaLarga(fechaInicio);
  const fin = formatearFechaLarga(fechaFin);
  if (inicio && fin) return `desde el ${inicio} hasta el ${fin}`;
  if (inicio) return `desde el ${inicio}`;
  if (fin) return `hasta el ${fin}`;
  return "";
}

// Formato de fecha usado específicamente en el Acuerdo de Patrocinio (Fecha1)
function formatearFechaTextoPatrocinio(fechaISO) {
  if (!fechaISO) return "";
  const partes = String(fechaISO).split("-");
  if (partes.length !== 3) return "";
  const mesNombre = convertirMesANombre(partes[1]);
  if (!mesNombre || !Number(partes[2]) || !partes[0]) return "";
  return `desde el ${Number(partes[2])} de ${mesNombre} de ${partes[0]}`;
}

// ─────────────────────────────────────────────
// CAPACITACIONES / CARRERAS (necesarias para reconstruir el dataDoc)
// ─────────────────────────────────────────────
function obtenerCapacitacionesDeCarrera(carreraData) {
  if (!carreraData?.capacitaciones || typeof carreraData.capacitaciones !== "object") return [];

  return Object.entries(carreraData.capacitaciones)
    .map(([key, value]) => ({
      key,
      origen: "especifica",
      capacitacion: value?.capacitacion || "",
      tipo: value?.tipo || "Aprobación",
      horas: Number(value?.horas || 0),
      fechaInicio: value?.fechaInicio || "",
      fechaFin: value?.fechaFin || "",
      estado: value?.estado || "",
      teoriaTemas: Array.isArray(value?.teoriaTemas) ? value.teoriaTemas : [],
      practicaTemas: Array.isArray(value?.practicaTemas) ? value.practicaTemas : []
    }))
    .filter(cap => cap.capacitacion)
    .sort((a, b) => Number(a.key) - Number(b.key));
}

async function obtenerCapacitacionesGenericasGlobal() {
  const snap = await get(ref(db, "capacitacionesGenericas"));
  if (!snap.exists()) return [];

  return Object.entries(snap.val())
    .map(([key, value]) => ({
      key,
      origen: "generica",
      capacitacion: value?.capacitacion || "",
      tipo: value?.tipo || "Aprobación",
      horas: Number(value?.horas || 0),
      fechaInicio: value?.fechaInicio || "",
      fechaFin: value?.fechaFin || "",
      estado: value?.estado || "",
      teoriaTemas: Array.isArray(value?.teoriaTemas) ? value.teoriaTemas : [],
      practicaTemas: Array.isArray(value?.practicaTemas) ? value.practicaTemas : []
    }))
    .filter(cap => cap.capacitacion)
    .sort((a, b) => Number(a.key) - Number(b.key));
}

function combinarCapacitaciones(carreraData, genericas) {
  return [...obtenerCapacitacionesDeCarrera(carreraData), ...genericas];
}

function construirListaCapacitaciones(caps) {
  return caps.map((cap, index) => ({
    contador: index + 1,
    nombre: cap.capacitacion,
    horas: cap.horas || 0,
    fechaInicio: cap.fechaInicio || "",
    fechaFin: cap.fechaFin || "",
    tipo: cap.tipo || "Aprobación",
    estado: cap.estado || "-"
  }));
}

function obtenerActividadesDesdeCapacitaciones(caps) {
  const teoria = [];
  const practica = [];

  function agregarUnico(lista, valor) {
    const t = String(valor || "").trim();
    if (t && !lista.some(x => normalizarTexto(x) === normalizarTexto(t))) lista.push(t);
  }

  function obtenerTitulos(temas) {
    return (temas || [])
      .map(tema => String(tema?.titulo || "").trim())
      .filter(Boolean);
  }

  function pool(capsGrupo, campo) {
    return capsGrupo.flatMap(c => obtenerTitulos(c[campo]));
  }

  function elegirAleatorios(array, cantidad) {
    if (!array || !array.length) return [];
    const copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia.slice(0, cantidad);
  }

  const especificas = caps.filter(c => c.origen === "especifica");
  const genericas = caps.filter(c => c.origen === "generica");

  if (genericas.length === 0 && especificas.length > 0) {
    elegirAleatorios(pool(especificas, "teoriaTemas"), 3).forEach(t => agregarUnico(teoria, t));
    elegirAleatorios(pool(especificas, "practicaTemas"), 3).forEach(t => agregarUnico(practica, t));
  } else if (especificas.length === 0 && genericas.length > 0) {
    elegirAleatorios(pool(genericas, "teoriaTemas"), 3).forEach(t => agregarUnico(teoria, t));
    elegirAleatorios(pool(genericas, "practicaTemas"), 3).forEach(t => agregarUnico(practica, t));
  } else if (especificas.length > 0 && genericas.length > 0) {
    const teoriaEspecifica = elegirAleatorios(pool(especificas, "teoriaTemas"), 2);
    const teoriaGenerica = elegirAleatorios(pool(genericas, "teoriaTemas"), 1);
    [...teoriaEspecifica, ...teoriaGenerica].forEach(t => agregarUnico(teoria, t));

    const practicaEspecifica = elegirAleatorios(pool(especificas, "practicaTemas"), 2);
    const practicaGenerica = elegirAleatorios(pool(genericas, "practicaTemas"), 1);
    [...practicaEspecifica, ...practicaGenerica].forEach(t => agregarUnico(practica, t));
  }

  return { teoria, practica };
}

async function obtenerCarreraPorNombre(nombreCarrera) {
  const snap = await get(ref(db, "carreras"));
  if (!snap.exists()) return null;

  let found = null;
  snap.forEach(child => {
    const d = child.val();
    if (normalizarTexto(d?.nombre) === normalizarTexto(nombreCarrera)) {
      found = d;
    }
  });

  return found;
}

// Busca la fecha de inicio de una capacitación por nombre, primero en
// capacitaciones específicas de carrera y luego en genéricas (para Patrocinio).
async function buscarFechaInicioCapacitacion(nombreCapacitacion) {
  const nombreNormalizado = limpiarClave(nombreCapacitacion);

  const snapCarreras = await get(ref(db, "carreras"));
  if (snapCarreras.exists()) {
    let encontrada = "";
    snapCarreras.forEach(child => {
      if (encontrada) return;
      const data = child.val();
      if (!data?.capacitaciones) return;
      Object.values(data.capacitaciones).forEach(cap => {
        if (encontrada) return;
        if (limpiarClave(cap?.capacitacion) === nombreNormalizado) {
          encontrada = cap.fechaInicio || "";
        }
      });
    });
    if (encontrada) return encontrada;
  }

  const snapGenericas = await get(ref(db, "capacitacionesGenericas"));
  if (snapGenericas.exists()) {
    let encontrada = "";
    Object.values(snapGenericas.val()).forEach(cap => {
      if (encontrada) return;
      if (limpiarClave(cap?.capacitacion) === nombreNormalizado) {
        encontrada = cap.fechaInicio || "";
      }
    });
    if (encontrada) return encontrada;
  }

  return "";
}

// ─────────────────────────────────────────────
// CONSTRUIR dataDoc (idéntico al del formulario de Plan Individual)
// ─────────────────────────────────────────────
function construirDataDoc({ codigo, nombres, carrera, respuestas, caps, acts, formE, formG }) {
  const { r1, r2, r3, r4, r5, r6, r7, r8 } = respuestas;

  return {
    Codigo: codigo,
    NombresC: nombres,
    Nombresc: nombres,
    CarreraDocente: carrera,
    Carreradocente: carrera,

    Respuesta1: r1,
    Respuesta2: r2,
    Respuesta3: r3,
    Respuesta4: r4,
    Respuesta5: r5,
    Respuesta6: r6,
    Respuesta7: r7,
    Respuesta8: r8,

    capacitaciones: caps.map((item, index) => ({
      contador: index + 1,
      nombre: item.nombre,
      horas: item.horas,
      fechaInicio: formatoFecha(item.fechaInicio),
      fechaFin: formatoFecha(item.fechaFin),
      fecha: construirRangoFechaTexto(item.fechaInicio, item.fechaFin),
      tipo: item.tipo,
      estado: item.estado
    })),

    Teoria: acts.teoria,
    Practica: acts.practica,

    NombreFormacionEspecifica: formE.nombre,
    NivelFormacionEspecifica: formE.nivel,
    FechaInicioE: formatoFecha(formE.inicio),
    FechaFinE: formatoFecha(formE.fin),

    NombreFormacionGenerica: formG.nombre,
    NivelFormacionGenerica: formG.nivel,
    FechaInicioG: formatoFecha(formG.inicio),
    FechaFinG: formatoFecha(formG.fin),

    "NombreFormaciónEspecifica": formE.nombre,
    "NivelFormaciónEspecifica": formE.nivel,
    "NombreFormaciónGenerica": formG.nombre,
    "NivelFormaciónGenerica": formG.nivel
  };
}

// ─────────────────────────────────────────────
// CONVERTIR DOCX A PDF Y DESCARGAR — PLAN INDIVIDUAL
// ─────────────────────────────────────────────
async function convertirDocxAPdf(blobDocx, nombreBase) {
  const formData = new FormData();
  formData.append("file", blobDocx, `${nombreBase}.docx`);
  formData.append("tipo_documento", "plan_individual");

  const response = await fetch(`${API_BASE}/convertir-pdf`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    let msg = "No se pudo convertir el documento a PDF";
    try {
      const err = await response.json();
      msg = err.detail || msg;
    } catch { }
    throw new Error(msg);
  }

  const blobPdf = await response.blob();
  saveAs(blobPdf, `${nombreBase}.pdf`);
}

async function generarDocumento(data) {
  const response = await fetch("../../doc/individual.docx");

  if (!response.ok) {
    throw new Error("No se pudo cargar la plantilla Word del plan individual");
  }

  const content = await response.arrayBuffer();
  const zip = new PizZip(content);

  const doc = new window.docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });

  doc.render(data);

  const blobDocx = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  const nombreBase = limpiarNombreArchivo(`${data.Codigo}-${data.NombresC}`);
  await convertirDocxAPdf(blobDocx, nombreBase);
}

// ─────────────────────────────────────────────
// CONVERTIR DOCX A PDF Y DESCARGAR — ACUERDO DE PATROCINIO
// ─────────────────────────────────────────────
async function convertirDocxAPdfPatrocinio(blobDocx, nombreBase) {
  const formData = new FormData();
  formData.append("file", blobDocx, `${nombreBase}.docx`);
  formData.append("tipo_documento", "patrocinio");

  const response = await fetch(`${API_BASE}/convertir-pdf`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    let msg = "No se pudo convertir el documento a PDF";
    try {
      const err = await response.json();
      msg = err.detail || msg;
    } catch { }
    throw new Error(msg);
  }

  const blobPdf = await response.blob();
  saveAs(blobPdf, `${nombreBase}.pdf`);
}

async function generarDocumentoPatrocinio(data) {
  const response = await fetch("../../doc/patrocinio.docx");

  if (!response.ok) {
    throw new Error("No se pudo cargar la plantilla Word del acuerdo de patrocinio");
  }

  const content = await response.arrayBuffer();
  const zip = new PizZip(content);

  const doc = new window.docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });

  doc.render(data);

  const blobDocx = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  const nombreBase = limpiarNombreArchivo(`${data.Codigo}-${data.NombresC}`);
  await convertirDocxAPdfPatrocinio(blobDocx, nombreBase);
}

// ─────────────────────────────────────────────
// RE-DESCARGA DE UN PLAN INDIVIDUAL EXISTENTE
// Reconstruye el mismo dataDoc que se usó al generarlo y
// vuelve a producir el PDF, sin tocar Firebase.
// ─────────────────────────────────────────────
async function reDescargarPlan(planExistente, btnEl) {
  const textoOriginal = btnEl.textContent;

  try {
    btnEl.disabled = true;
    btnEl.textContent = "Generando...";

    const formEGuardada = {
      nombre: planExistente.nombreFormacionEspecifica || "",
      nivel: planExistente.nivelFormacionEspecifica || "",
      inicio: planExistente.fechaInicioE || "",
      fin: planExistente.fechaFinE || ""
    };

    const formGGuardada = {
      nombre: planExistente.nombreFormacionGenerica || "",
      nivel: planExistente.nivelFormacionGenerica || "",
      inicio: planExistente.fechaInicioG || "",
      fin: planExistente.fechaFinG || ""
    };

    let caps = [];
    let acts = { teoria: [], practica: [] };

    const carreraData = await obtenerCarreraPorNombre(planExistente.carrera);
    const genericas = await obtenerCapacitacionesGenericasGlobal();

    if (carreraData) {
      const capsCombinadas = combinarCapacitaciones(carreraData, genericas);
      caps = construirListaCapacitaciones(capsCombinadas);
      acts = obtenerActividadesDesdeCapacitaciones(capsCombinadas);
    }

    const dataDoc = construirDataDoc({
      codigo: planExistente.codigo,
      nombres: planExistente.docente,
      carrera: planExistente.carrera,
      respuestas: {
        r1: planExistente.respuesta1 || "",
        r2: planExistente.respuesta2 || "",
        r3: planExistente.respuesta3 || "",
        r4: planExistente.respuesta4 || "",
        r5: planExistente.respuesta5 || "",
        r6: planExistente.respuesta6 || "",
        r7: planExistente.respuesta7 || "",
        r8: planExistente.respuesta8 || ""
      },
      caps,
      acts,
      formE: formEGuardada,
      formG: formGGuardada
    });

    await generarDocumento(dataDoc);

  } catch (error) {
    console.error("Error al re-descargar el plan:", error);
    setEstado(error.message || "Ocurrió un error al volver a descargar el plan", "err");
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = textoOriginal;
  }
}

// ─────────────────────────────────────────────
// RE-DESCARGA DE UN ACUERDO DE PATROCINIO EXISTENTE
// Reconstruye el mismo dataDoc que arma patrocinio.js
// (NombresC, Carrera1, Cedula1, NombreCA, Codigo, Fecha1)
// y vuelve a producir el PDF, sin tocar Firebase.
// ─────────────────────────────────────────────
async function reDescargarPatrocinio(patrocinioData, btnEl) {
  const textoOriginal = btnEl.textContent;

  try {
    btnEl.disabled = true;
    btnEl.textContent = "Generando...";

    const fechaInicio = await buscarFechaInicioCapacitacion(patrocinioData.capacitacion);
    const fecha = formatearFechaTextoPatrocinio(fechaInicio);

    const dataDoc = {
      NombresC: patrocinioData.docente,
      Carrera1: patrocinioData.carrera,
      Cedula1:  patrocinioData.cedula,
      NombreCA: patrocinioData.capacitacion,
      Codigo:   patrocinioData.codigo,
      Fecha1:   fecha
    };

    await generarDocumentoPatrocinio(dataDoc);

  } catch (error) {
    console.error("Error al re-descargar el patrocinio:", error);
    setEstado(error.message || "Ocurrió un error al volver a descargar el acuerdo de patrocinio", "err");
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = textoOriginal;
  }
}

// ─────────────────────────────────────────────
// RENDER DE REGISTROS
// ─────────────────────────────────────────────

// Registro de Acuerdo de Patrocinio con botón de re-descarga
function renderRegistroPatrocinio(data) {
  const entregadoBool = data.entregado === true || data.entregado === "true";

  const div = document.createElement("div");
  div.className = "pregistro";
  div.innerHTML = `
    <div class="pregistro-info">
      <span class="pregistro-nombre">${valorSeguro(data.capacitacion, "Capacitación sin nombre")}</span>
      <span class="pregistro-detalle">Carrera: ${valorSeguro(data.carrera, "—")} · Código: ${valorSeguro(data.codigo, "—")}</span>
    </div>
    <div class="pregistro-acciones">
      <span class="pbadge-estado ${entregadoBool ? "entregado" : "pendiente"}">
        ${entregadoBool ? "Entregado" : "Pendiente"}
      </span>
      <button type="button" class="btn-redescargar">Volver a descargar</button>
    </div>
  `;

  const btn = div.querySelector(".btn-redescargar");
  btn.addEventListener("click", () => reDescargarPatrocinio(data, btn));

  return div;
}

// Registro de Plan Individual con botón de re-descarga
function renderRegistroPlan(planData) {
  const div = document.createElement("div");
  div.className = "pregistro";
  div.innerHTML = `
    <div class="pregistro-info">
      <span class="pregistro-nombre">${valorSeguro(planData.codigo, "Plan sin código")}</span>
      <span class="pregistro-detalle">Carrera: ${valorSeguro(planData.carrera, "—")}</span>
    </div>
    <div class="pregistro-acciones">
      <span class="pbadge-estado ${planData.entregado === true || planData.entregado === "true" ? "entregado" : "pendiente"}">
        ${planData.entregado === true || planData.entregado === "true" ? "Entregado" : "Pendiente"}
      </span>
      <button type="button" class="btn-redescargar">Volver a descargar</button>
    </div>
  `;

  const btn = div.querySelector(".btn-redescargar");
  btn.addEventListener("click", () => reDescargarPlan(planData, btn));

  return div;
}

function renderSinRegistro(contenedor, mensaje) {
  contenedor.innerHTML = `<div class="psin-registro">${mensaje}</div>`;
}

// ─────────────────────────────────────────────
// BÚSQUEDA EN FIREBASE
// ─────────────────────────────────────────────
async function buscarNodoPorCedula(nodoBase, cedula) {
  const snap = await get(ref(db, `${nodoBase}/${cedula}`));
  if (!snap.exists()) return [];

  const registros = [];
  snap.forEach(child => {
    registros.push({ key: child.key, ...child.val() });
  });
  return registros;
}

// ─────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const cedula = cedulaInput.value.trim();

  if (!cedula) {
    setEstado("Ingresa una cédula", "err");
    return;
  }

  setEstado("Buscando...", "");
  setCargando(true);
  presultados.classList.add("oculto");
  listaPatrocinio.innerHTML = "";
  listaPlan.innerHTML       = "";

  try {
    const [patrocinios, planes] = await Promise.all([
      buscarNodoPorCedula("patrociniosGenerados", cedula),
      buscarNodoPorCedula("planesGenerados", cedula)
    ]);

    if (patrocinios.length === 0 && planes.length === 0) {
      setEstado("No se encontró ningún registro para esta cédula. Puede que la cédula no pertenezca a un docente registrado o que aún no haya completado ningún formulario.", "err");
      setCargando(false);
      return;
    }

    // ── Acuerdo de Patrocinio (con opción de re-descarga) ──
    if (patrocinios.length === 0) {
      renderSinRegistro(listaPatrocinio, "Sin registros de Acuerdo de Patrocinio para esta cédula.");
    } else {
      patrocinios.forEach(p => {
        // La cédula no siempre viaja dentro del registro guardado, la añadimos
        // porque reDescargarPatrocinio la necesita para reconstruir el dataDoc.
        listaPatrocinio.appendChild(renderRegistroPatrocinio({ ...p, cedula }));
      });
    }

    // ── Plan Individual (con opción de re-descarga) ──
    if (planes.length === 0) {
      renderSinRegistro(listaPlan, "Sin registros de Plan Individual para esta cédula.");
    } else {
      planes.forEach(p => {
        listaPlan.appendChild(renderRegistroPlan({ ...p, cedula }));
      });
    }

    presultados.classList.remove("oculto");
    setEstado(`Consulta realizada correctamente ✔`, "ok");

  } catch (error) {
    console.error("Error al consultar avance:", error);
    setEstado(error.message || "Ocurrió un error al consultar la información", "err");
  } finally {
    setCargando(false);
  }
});