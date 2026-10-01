import { db } from "../../firebase/firebase.js";
import {
  ref,
  get,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const form = document.getElementById("formPlanIndividual");
const estado = document.getElementById("estado");
const selectCarrera = document.getElementById("carrera");

const MAX_PALABRAS_RESPUESTA = 60;
const MAX_CARACTERES_RESPUESTA = 500; // respaldo: evita texto largo sin espacios (ej. "cccccc...")

// ── Límites especiales para la pregunta 07 (nivel académico actual) ──
// Subidos de 6 a 10 palabras para que no se corten títulos como
// "Ingeniero en Electrónica y Telecomunicaciones, Magíster en Redes"
const MAX_PALABRAS_RESPUESTA7 = 10;
const MAX_CARACTERES_RESPUESTA7 = 100; // respaldo proporcional

function limitarPalabras(textarea, maxPalabras, maxCaracteres) {
  if (!textarea) return;

  // Bloqueo nativo por caracteres (frena el spam sin espacios al instante)
  textarea.setAttribute("maxlength", maxCaracteres);

  // Crear contador visual debajo del textarea
  const contador = document.createElement("div");
  contador.className = "contador-palabras";
  contador.textContent = `0 / ${maxPalabras} palabras`;
  textarea.insertAdjacentElement("afterend", contador);

  function actualizarContador() {
    const palabras = textarea.value.trim().split(/\s+/).filter(Boolean);

    if (palabras.length > maxPalabras) {
      textarea.value = palabras.slice(0, maxPalabras).join(" ");
    }

    const totalActual = textarea.value.trim().split(/\s+/).filter(Boolean).length;
    contador.textContent = `${totalActual} / ${maxPalabras} palabras`;
    contador.classList.toggle("cerca-limite", totalActual >= maxPalabras * 0.8 && totalActual < maxPalabras);
    contador.classList.toggle("limite-alcanzado", totalActual >= maxPalabras);
  }

  textarea.addEventListener("input", actualizarContador);
}
const detalleEspecifica = document.getElementById("detalleEspecifica");
const detalleGenerica = document.getElementById("detalleGenerica");
const tablaCapacitacionesBody = document.querySelector("#tablaCapacitaciones tbody");
const listaTeoria = document.getElementById("listaTeoria");
const listaPractica = document.getElementById("listaPractica");
const btnReDescargar = document.getElementById("btnReDescargar");
const cedulaInput = document.getElementById("cedula");
const telefonoInput = document.getElementById("telefono");

const API_BASE = "https://backen-pdf-trabajo.onrender.com";

let carreraActual = null;
let ultimoDocumento = null;
let formularioActivo = true;
let yaMostroCierre = false;
let _cedulaTimer = null;
let cedulaBloqueada = false; // true cuando la cédula ya tiene plan generado
let cedulaValidada = false; // true cuando la cédula fue validada (registro existente o "primera vez" confirmada)
let sedeSeleccionada = null; // "Quito" o "Manta"

// ── Badge de cédula ────────────────────────────────────────────
let cedulaBadge = document.getElementById("cedulaBadge");

function setBadge(tipo, texto) {
  if (!cedulaBadge) return;
  cedulaBadge.className = "cedula-badge " + tipo;
  cedulaBadge.textContent = texto;
  cedulaBadge.classList.remove("oculto");
}

function clearBadge() {
  if (!cedulaBadge) return;
  cedulaBadge.className = "cedula-badge oculto";
  cedulaBadge.textContent = "";
}

// ── Bloquear/desbloquear el botón Siguiente del paso 1 ────────
function bloquearNavegacion(bloquear) {
  cedulaBloqueada = bloquear;
  window._cedulaBloqueada = bloquear; // expuesto para el stepper del HTML

  // Mostrar/ocultar aviso en el paso 1
  const aviso = document.getElementById("avisoCedulaBloqueada");
  if (aviso) aviso.classList.toggle("oculto", !bloquear);
}

// ── Bloqueo/desbloqueo de campos dependientes de la cédula ────
function obtenerCamposDependientesDeCedula() {
  return Array.from(form.querySelectorAll("input, select, button"))
    .filter(el => el !== cedulaInput && el.id !== "btnReDescargar");
}

function deshabilitarFormulario() {
  obtenerCamposDependientesDeCedula().forEach(el => { el.disabled = true; });
}

function habilitarFormulario() {
  obtenerCamposDependientesDeCedula().forEach(el => { el.disabled = false; });
}

// ── Exponer para el modal/html ──────────────────────────────────
window._ultimoDocumento = null;
window._reDescargarFn = async () => {
  if (!formularioActivo) {
    mostrarMensajeFormularioCerrado();
    return;
  }

  if (!ultimoDocumento) return;

  try {
    setEstado("Re-descargando PDF...", "");
    window.mostrarAnimacionGenerando?.();
    await generarDocumento(ultimoDocumento);
    window.ocultarAnimacionGenerando?.(true);
    setEstado("Documento descargado correctamente ✔", "ok");
  } catch (error) {
    window.ocultarAnimacionGenerando?.(false);
    console.error("Error en re-descarga:", error);
    setEstado(error.message || "Ocurrió un error al volver a descargar el documento", "err");
  }
};

window.volver = () => { window.location.href = "../../index.html"; };

// ─────────────────────────────────────────────
// FORMULARIO CERRADO POR ADMIN
// ─────────────────────────────────────────────
function mostrarMensajeFormularioCerrado() {
  if (yaMostroCierre) return;
  yaMostroCierre = true;

  try {
    window.ocultarAnimacionGenerando?.(false);
  } catch { }

  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#f4f7fb;
      font-family:Arial, sans-serif;
      padding:20px;
      text-align:center;
    ">
      <div style="
        max-width:480px;
        background:white;
        padding:32px;
        border-radius:18px;
        box-shadow:0 12px 35px rgba(0,0,0,.12);
      ">
        <div style="
          width:56px;
          height:56px;
          margin:0 auto 16px;
          border-radius:50%;
          background:#fee2e2;
          color:#b91c1c;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:28px;
          font-weight:bold;
        ">
          !
        </div>

        <h2 style="margin-bottom:12px;color:#1e3a5f;">
          Formulario cerrado
        </h2>

        <p style="font-size:16px;color:#475569;line-height:1.6;">
          El administrador cerró este formulario.
          <br><br>
          Por favor comuníquese con el administrador para que lo vuelva a habilitar.
        </p>

        <p style="margin-top:18px;font-size:14px;color:#64748b;">
          Será redirigido al panel principal...
        </p>
      </div>
    </div>
  `;

  setTimeout(() => {
    window.location.href = "../../index.html";
  }, 3500);
}

function escucharEstadoFormulario() {
  const formularioRef = ref(db, "Activador/planIndividual");

  onValue(formularioRef, (snapshot) => {
    const activo = snapshot.val();
    formularioActivo = activo !== false;
    if (activo === false) {
      mostrarMensajeFormularioCerrado();
    }
  }, (error) => {
    console.error("Error escuchando estado del formulario:", error);
  });
}

// ─── ESTADO HELPER ─────────────────────────────────────────────
function setEstado(msg, tipo = "") {
  estado.textContent = msg;
  estado.className = "";
  if (tipo) estado.classList.add(tipo);
}

// ─── UTILIDADES ────────────────────────────────────────────────
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

// ─── NUEVOS CAMPOS: herramientas (P05) y datos de contacto ─────
// Devuelve las herramientas marcadas en la pregunta 05 como "Moodle, Zoom, Canva"
function obtenerHerramientasSeleccionadas() {
  return Array.from(document.querySelectorAll('input[name="respuesta5"]:checked'))
    .map(c => c.value)
    .join(", ");
}

// Extrae los datos extra desde un plan ya guardado en Firebase
function extraDesdePlan(plan) {
  return {
    telefono: plan?.telefono || "",
    correo: plan?.correo || "",
    funcion: plan?.funcionSustantiva || "",
    contrato: plan?.tipoContrato || ""
  };
}

// Teléfono: solo dígitos
telefonoInput.addEventListener("input", () => {
  telefonoInput.value = telefonoInput.value.replace(/\D/g, "");
});

// ─── FECHAS LARGAS ──────────────────────────────────────────────
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

// ─── SITUACIÓN DE LA FORMACIÓN (Actual / Propuesta) ─────────────
// Fecha local de hoy en formato YYYY-MM-DD (no usar toISOString: en Ecuador
// devuelve UTC y en la noche cambia al día siguiente).
function fechaHoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Inicio posterior a hoy → "Propuesta"; inicio hoy o pasado → "Actual"; sin fecha → ""
function calcularSituacion(fechaInicio) {
  if (!fechaInicio) return "";
  return String(fechaInicio) > fechaHoyISO() ? "Propuesta" : "Actual";
}

// ─── CAPACITACIONES ────────────────────────────────────────────
function obtenerCapacitacionesDeCarrera(carreraData) {
  if (!carreraData?.capacitaciones || typeof carreraData.capacitaciones !== "object") return [];

  return Object.entries(carreraData.capacitaciones)
    .map(([key, value]) => ({
      key,
      origen: "especifica",
      capacitacion: value?.capacitacion || "",
      sede: value?.sede || "",
      tipo: value?.tipo || "Aprobación",
      horas: Number(value?.horas || 0),
      fechaInicio: value?.fechaInicio || "",
      fechaFin: value?.fechaFin || "",
      estado: value?.estado || "",
      teoriaTemas: Array.isArray(value?.teoriaTemas) ? value.teoriaTemas : [],
      practicaTemas: Array.isArray(value?.practicaTemas) ? value.practicaTemas : []
    }))
    .filter(cap => cap.capacitacion)
    .filter(cap => !sedeSeleccionada || normalizarTexto(cap.sede) === normalizarTexto(sedeSeleccionada))
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
      sede: value?.sede || "",
      tipo: value?.tipo || "Aprobación",
      horas: Number(value?.horas || 0),
      fechaInicio: value?.fechaInicio || "",
      fechaFin: value?.fechaFin || "",
      estado: value?.estado || "",
      teoriaTemas: Array.isArray(value?.teoriaTemas) ? value.teoriaTemas : [],
      practicaTemas: Array.isArray(value?.practicaTemas) ? value.practicaTemas : []
    }))
    .filter(cap => cap.capacitacion)
    .filter(cap => !sedeSeleccionada || normalizarTexto(cap.sede) === normalizarTexto(sedeSeleccionada))
    .sort((a, b) => Number(a.key) - Number(b.key));
}


function combinarCapacitaciones(carreraData, genericas) {
  return [...obtenerCapacitacionesDeCarrera(carreraData), ...genericas];
}

function renderDetalleCapacitacion(contenedor, data, tituloVacio) {
  if (!data?.capacitacion) {
    contenedor.innerHTML = `
      <div class="detalle-vacio">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        ${tituloVacio}
      </div>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="detalle-card">
      <p><strong>Nombre:</strong> ${valorSeguro(data.capacitacion, "-")}</p>
      <p><strong>Horas:</strong> ${valorSeguro(data.horas, 0)}</p>
      <p><strong>Fecha inicio:</strong> ${formatoFecha(data.fechaInicio)}</p>
      <p><strong>Fecha fin:</strong> ${formatoFecha(data.fechaFin)}</p>
      <p><strong>Tipo:</strong> ${valorSeguro(data.tipo, "-")}</p>
      <p><strong>Estado:</strong> ${valorSeguro(data.estado, "-")}</p>
    </div>`;
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

function renderTablaCapacitaciones(lista) {
  tablaCapacitacionesBody.innerHTML = "";

  if (!lista.length) {
    tablaCapacitacionesBody.innerHTML = `<tr><td colspan="7" class="td-empty">No hay capacitaciones cargadas para esta carrera</td></tr>`;
    return;
  }

  lista.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.contador}</td>
      <td>${valorSeguro(item.nombre, "-")}</td>
      <td>${valorSeguro(item.horas, 0)}</td>
      <td>${formatoFecha(item.fechaInicio)}</td>
      <td>${formatoFecha(item.fechaFin)}</td>
      <td>${valorSeguro(item.tipo, "-")}</td>
      <td>${valorSeguro(item.estado, "-")}</td>`;
    tablaCapacitacionesBody.appendChild(tr);
  });
}

function renderListaHtml(contenedor, items) {
  contenedor.innerHTML = "";

  if (!items?.length) {
    contenedor.innerHTML = "<li class='li-empty'>Sin datos</li>";
    return;
  }

  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    contenedor.appendChild(li);
  });
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

  // Combina los títulos de teoría (o práctica) de varias capacitaciones en un solo pool
  function pool(capsGrupo, campo) {
    return capsGrupo.flatMap(c => obtenerTitulos(c[campo]));
  }

  // Devuelve hasta `cantidad` títulos elegidos al azar (sin repetir), sin mutar el original
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
    // Solo hay específica(s) → 3 temas de ese pool
    elegirAleatorios(pool(especificas, "teoriaTemas"), 3).forEach(t => agregarUnico(teoria, t));
    elegirAleatorios(pool(especificas, "practicaTemas"), 3).forEach(t => agregarUnico(practica, t));

  } else if (especificas.length === 0 && genericas.length > 0) {
    // Solo hay genérica(s) → 3 temas de ese pool
    elegirAleatorios(pool(genericas, "teoriaTemas"), 3).forEach(t => agregarUnico(teoria, t));
    elegirAleatorios(pool(genericas, "practicaTemas"), 3).forEach(t => agregarUnico(practica, t));

  } else if (especificas.length > 0 && genericas.length > 0) {
    // Hay ambas → sorteo: 2 de específica + 1 de genérica (teoría y práctica)
    const teoriaEspecifica = elegirAleatorios(pool(especificas, "teoriaTemas"), 2);
    const teoriaGenerica = elegirAleatorios(pool(genericas, "teoriaTemas"), 1);
    [...teoriaEspecifica, ...teoriaGenerica].forEach(t => agregarUnico(teoria, t));

    const practicaEspecifica = elegirAleatorios(pool(especificas, "practicaTemas"), 2);
    const practicaGenerica = elegirAleatorios(pool(genericas, "practicaTemas"), 1);
    [...practicaEspecifica, ...practicaGenerica].forEach(t => agregarUnico(practica, t));
  }

  return { teoria, practica };
}

// ─── CONVERTIR DOCX A PDF ──────────────────────────────────────
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

function cargarConfiguracionTiempoReal() {
  const refConfig = ref(db, "config-plan-individual/1");

  onValue(
    refConfig,
    (snap) => {
      try {
        if (!snap.exists()) return;

        const data = snap.val();
        const codigo = String(data?.codigo || "").trim();

        if (!codigo) return;

        const partes = codigo.split("-");

        if (partes.length >= 7) {
          window.codigoUnidad = partes.slice(0, 5).join("-");
        }

      } catch (error) {
        console.error("Error escuchando config-plan-individual:", error);
      }
    },
    (error) => {
      console.error("Error en tiempo real:", error);
    }
  );
}

// ─── CARRERAS ──────────────────────────────────────────────────
async function cargarCarreras() {
  try {
    const snap = await get(ref(db, "carreras"));

    selectCarrera.innerHTML = '<option value="">-- Seleccione una carrera --</option>';

    if (!snap.exists()) {
      selectCarrera.innerHTML = '<option value="">No hay carreras registradas</option>';
      return;
    }

    const carreras = [];

    snap.forEach(child => {
      const d = child.val();
      if (d?.nombre) carreras.push(d.nombre);
    });

    carreras.sort((a, b) => a.localeCompare(b, "es"));

    carreras.forEach(nombre => {
      const opt = document.createElement("option");
      opt.value = nombre;
      opt.textContent = nombre;
      selectCarrera.appendChild(opt);
    });

  } catch (error) {
    console.error("Error al cargar carreras:", error);
    setEstado("No se pudieron cargar las carreras", "err");
  }
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

async function cargarDatosAutomaticosDeCarrera(nombreCarrera) {
  if (!nombreCarrera) {
    carreraActual = null;
    renderDetalleCapacitacion(detalleEspecifica, null, "Primero seleccione una carrera");
    renderDetalleCapacitacion(detalleGenerica, null, "Primero seleccione una carrera");
    renderTablaCapacitaciones([]);
    renderListaHtml(listaTeoria, []);
    renderListaHtml(listaPractica, []);
    return;
  }

  const [carreraData, genericas] = await Promise.all([
    obtenerCarreraPorNombre(nombreCarrera),
    obtenerCapacitacionesGenericasGlobal()
  ]);

  carreraActual = carreraData;

  const caps = combinarCapacitaciones(carreraData, genericas);

  renderDetalleCapacitacion(detalleEspecifica, caps[0] || null, "No hay capacitación 1");
  renderDetalleCapacitacion(detalleGenerica, caps[1] || null, "No hay capacitación 2");
  renderTablaCapacitaciones(construirListaCapacitaciones(caps));

  const acts = obtenerActividadesDesdeCapacitaciones(caps);

  renderListaHtml(listaTeoria, acts.teoria);
  renderListaHtml(listaPractica, acts.practica);
}

// ─── CÓDIGO PLAN INDIVIDUAL ────────────────────────────────────
async function obtenerCodigoBasePlanIndividual() {
  const snap = await get(ref(db, "config-plan-individual/1"));

  if (!snap.exists()) {
    throw new Error("No existe la configuración de plan individual");
  }

  const data = snap.val();
  const codigo = String(data?.codigo || "").trim();

  if (!codigo) {
    throw new Error("La configuración de plan individual no tiene código");
  }

  return codigo;
}

function partirCodigo(codigo) {
  const partes = String(codigo || "").trim().split("-");

  if (partes.length !== 7) {
    throw new Error("El código del plan individual no tiene el formato esperado");
  }

  return {
    prefijo: partes[0],
    bloque: partes[1],
    secuencia: partes[2],
    pro: partes[3],
    unidad: partes[4],
    anio: partes[5],
    mes: partes[6]
  };
}

function construirCodigo(partes, nuevaSecuencia) {
  return [
    partes.prefijo,
    partes.bloque,
    String(nuevaSecuencia).padStart(2, "0"),
    partes.pro,
    partes.unidad,
    partes.anio,
    partes.mes
  ].join("-");
}

// Compara dos códigos por año-mes primero y secuencia como desempate,
// en vez de comparar el string completo (donde la secuencia pesa antes
// que el año-mes y puede dar un "más reciente" incorrecto).
function compararCodigos(codigoA, codigoB) {
  try {
    const a = partirCodigo(codigoA);
    const b = partirCodigo(codigoB);
    const claveA = `${a.anio}${a.mes}`;
    const claveB = `${b.anio}${b.mes}`;
    if (claveA !== claveB) return claveA.localeCompare(claveB);
    return Number(a.secuencia) - Number(b.secuencia);
  } catch {
    return 0;
  }
}

async function generarCodigoSecuencialPlan() {
  const codigoBase = await obtenerCodigoBasePlanIndividual();
  const partesBase = partirCodigo(codigoBase);
  const snap = await get(ref(db, "planesGenerados"));

  let maxSecuencia = 0;

  if (snap.exists()) {
    snap.forEach(snapCedula => {
      snapCedula.forEach(snapPlan => {
        const data = snapPlan.val();
        const cg = String(data?.codigo || "").trim();

        if (!cg) return;

        try {
          const partes = partirCodigo(cg);

          if (partes.anio === partesBase.anio && partes.mes === partesBase.mes) {
            const sec = Number(partes.secuencia);
            if (!Number.isNaN(sec) && sec > maxSecuencia) {
              maxSecuencia = sec;
            }
          }
        } catch { }
      });
    });
  }

  return construirCodigo(partesBase, maxSecuencia + 1);
}

// ─── PLANES GENERADOS ──────────────────────────────────────────
async function obtenerPlanExistente(cedula) {
  const snap = await get(ref(db, `planesGenerados/${cedula}`));

  if (!snap.exists()) return null;

  let ultimo = null;

  snap.forEach(child => {
    const data = child.val();

    if (!ultimo || compararCodigos(data?.codigo, ultimo?.codigo) > 0) {
      ultimo = data;
    }
  });

  return ultimo;
}

async function guardarPlanGenerado(payload) {
  const claveCodigo = limpiarClave(payload.codigo);
  await set(ref(db, `planesGenerados/${payload.cedula}/${claveCodigo}`), payload);
}

// ─── GENERAR DOCX → PDF ────────────────────────────────────────
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

// ─── CONSTRUIR dataDoc ────────────────────────────────────────
function construirDataDoc({ codigo, nombres, carrera, respuestas, caps, acts, formE, formG, extra = {} }) {
  const { r1, r2, r3, r4, r5, r6, r7, r8, r9, r10 } = respuestas;

  return {
    Codigo: codigo,
    NombresC: nombres,
    Nombresc: nombres,
    CarreraDocente: carrera,
    Carreradocente: carrera,

    // ── Datos de contacto / laborales ──
    Telefono: extra.telefono || "",
    Correo: extra.correo || "",
    FuncionSustantiva: extra.funcion || "",
    TipoContrato: extra.contrato || "",

    Respuesta1: r1,
    Respuesta2: r2,
    Respuesta3: r3,
    Respuesta4: r4,
    Respuesta5: r5,
    Respuesta6: r6,
    Respuesta7: r7,
    Respuesta8: r8,
    Respuesta9: r9,
    Respuesta10: r10,

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
    situacion: calcularSituacion(formE.inicio),

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
function mostrarModalSede() {
  const overlayPrevio = document.getElementById("modalSedeOverlay");
  if (overlayPrevio) overlayPrevio.remove();

  const overlay = document.createElement("div");
  overlay.id = "modalSedeOverlay";
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(15,23,42,.55);
    display:flex; align-items:center; justify-content:center;
    z-index:9999; padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      max-width:420px;width:100%;background:#ffffff;padding:28px;border-radius:16px;
      box-shadow:0 12px 35px rgba(0,0,0,.2); text-align:center; font-family:Arial, sans-serif;
    ">
      <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:19px;">Seleccione su sede</h3>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 22px;">
        ¿A qué sede pertenece? Esto determina las capacitaciones que se le mostrarán.
      </p>
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        <button id="btnSedeQuito" style="
          padding:10px 22px;border:none;border-radius:8px;
          background:#2563eb;color:#fff;font-weight:600;cursor:pointer;font-size:14px;
        ">Quito</button>
        <button id="btnSedeManta" style="
          padding:10px 22px;border:none;border-radius:8px;
          background:#2563eb;color:#fff;font-weight:600;cursor:pointer;font-size:14px;
        ">Manta</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const cerrarConSede = (sede) => {
    sedeSeleccionada = sede;
    overlay.remove();
    document.body.style.overflow = "";
    iniciarFormulario(); // recién aquí arranca todo lo demás
  };

  document.getElementById("btnSedeQuito").addEventListener("click", () => cerrarConSede("Quito"));
  document.getElementById("btnSedeManta").addEventListener("click", () => cerrarConSede("Manta"));
}
// ─── MODAL "PRIMERA VEZ" (misma dinámica que patrocinio.js) ────
function mostrarModalPrimeraVezPlan(cedula) {
  const overlayPrevio = document.getElementById("modalPrimeraVezOverlay");
  if (overlayPrevio) overlayPrevio.remove();

  const overlay = document.createElement("div");
  overlay.id = "modalPrimeraVezOverlay";
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(15,23,42,.55);
    display:flex; align-items:center; justify-content:center;
    z-index:9999; padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      max-width:440px;width:100%;background:#ffffff;padding:28px;border-radius:16px;
      box-shadow:0 12px 35px rgba(0,0,0,.2); text-align:center; font-family:Arial, sans-serif;
    ">
      <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:19px;">Cédula no registrada</h3>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 22px;">
        No encontramos un plan individual previo con la cédula <strong>${cedula}</strong>.<br>
        ¿Es la primera vez que Generas tu plan Individual del Periodo?
      </p>
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        <button id="btnPrimeraVezSiPlan" style="
          padding:10px 18px;border:none;border-radius:8px;
          background:#2563eb;color:#fff;font-weight:600;cursor:pointer;font-size:14px;
        ">Sí, es mi primera vez</button>
        <button id="btnPrimeraVezNoPlan" style="
          padding:10px 18px;border:1px solid #cbd5e1;border-radius:8px;
          background:#fff;color:#334155;font-weight:600;cursor:pointer;font-size:14px;
        ">No</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  document.getElementById("btnPrimeraVezSiPlan").addEventListener("click", () => {
    overlay.remove();
    document.body.style.overflow = "";

    cedulaValidada = true;
    bloquearNavegacion(false);
    setBadge("clear", "Registro nuevo");
    setEstado("", "");
    habilitarFormulario();
  });

  document.getElementById("btnPrimeraVezNoPlan").addEventListener("click", () => {
    overlay.remove();
    document.body.style.overflow = "";

    cedulaValidada = false;
    setBadge("found", "No registrado");
    setEstado(
      "No encontramos un docente registrado con esta cédula. Verifique el número o contáctese con la Unidad de Gestión de Procesos Académicos.",
      "err"
    );
    deshabilitarFormulario();
  });
}

// ─── DETECCIÓN DE CÉDULA EN TIEMPO REAL ───────────────────────
cedulaInput.addEventListener("input", () => {
  // NUEVO: solo permitir dígitos
  cedulaInput.value = cedulaInput.value.replace(/\D/g, "");

  clearTimeout(_cedulaTimer);

  // Resetear estado mientras se escribe
  cedulaValidada = false;
  bloquearNavegacion(false);
  clearBadge();
  deshabilitarFormulario();

  const overlayPrevio = document.getElementById("modalPrimeraVezOverlay");
  if (overlayPrevio) overlayPrevio.remove();
  document.body.style.overflow = "";

  const val = cedulaInput.value.trim();

  if (val.length < 10) {
    return;
  }

  setBadge("checking", "Verificando…");

  _cedulaTimer = setTimeout(async () => {
    try {
      const planExistente = await obtenerPlanExistente(val);

      if (!planExistente) {
        clearBadge();
        mostrarModalPrimeraVezPlan(val);
        return;
      }

      // Cédula con historial -> se bloquea la navegación y se ofrece re-descarga
      cedulaValidada = true;
      setBadge("found", "Ya existe");
      bloquearNavegacion(true);

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

      // Para las caps y acts necesitamos cargar la carrera del plan guardado
      let caps = [];
      let acts = { teoria: [], practica: [] };

      try {
        const carreraData = await obtenerCarreraPorNombre(planExistente.carrera);
        const genericas = await obtenerCapacitacionesGenericasGlobal();

        if (carreraData) {
          const capsCombinadas = combinarCapacitaciones(carreraData, genericas);
          caps = construirListaCapacitaciones(capsCombinadas);
          acts = obtenerActividadesDesdeCapacitaciones(capsCombinadas);
        }
      } catch { }

      ultimoDocumento = construirDataDoc({
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
          r8: planExistente.respuesta8 || "",
          r9: planExistente.respuesta9 || "",
          r10: planExistente.respuesta10 || ""
        },
        caps,
        acts,
        formE: formEGuardada,
        formG: formGGuardada,
        extra: extraDesdePlan(planExistente)
      });

      window._ultimoDocumento = ultimoDocumento;
      btnReDescargar.classList.remove("oculto");

      // Abrir el modal de re-descarga automáticamente
      window.abrirModalReDescarga?.();

    } catch (err) {
      console.error("Error verificando cédula:", err);
      clearBadge();
      bloquearNavegacion(false);
    }
  }, 700);
});

// ─── EVENTOS ──────────────────────────────────────────────────
selectCarrera.addEventListener("change", async () => {
  await cargarDatosAutomaticosDeCarrera(selectCarrera.value.trim());
});

// ═══════════════════════════════════════════════════════════════
// VALIDACIÓN DE NIVEL — solo formación ESPECÍFICA.
// El nivel propuesto debe ser IGUAL o SUPERIOR al título actual (P07).
// La formación genérica no se valida.
//
// Si la P07 NO se puede interpretar, ahora SÍ se bloquea (antes se dejaba
// pasar cualquier texto, incluso una sola letra). Reconoce:
//   · Siglas:      Tnlg., Tlgo., Ing., Lcdo., Mgs., MSc., PhD, Dr., Doc...
//   · Palabras:    Ingeniero, Magíster, Tecnólogo, etc.
//   · Tipeos:      "tecnolg", "ingenero", "magistter"...
//   · Cortadas:    "ingenier", "licenciad"
// ═══════════════════════════════════════════════════════════════
const NIVELES = [
  "Técnico",          // 0
  "Tecnólogo",        // 1
  "Tercer nivel",     // 2
  "Especialización",  // 3
  "Maestría",         // 4
  "Doctorado (PhD)",  // 5
  "Posdoctorado"      // 6
];

// Siglas y abreviaturas exactas (ya normalizadas: sin tildes, sin puntos)
const SIGLAS = {
  // 0 Técnico
  tec: 0, tecn: 0, tcn: 0,
  // 1 Tecnólogo
  tnlg: 1, tnlgo: 1, tnlga: 1, tlg: 1, tlgo: 1, tlga: 1, tecnlg: 1,
  // 2 Tercer nivel
  ing: 2, lic: 2, lcdo: 2, lcda: 2, arq: 2, abg: 2, econ: 2, psic: 2,
  tercer: 2, bachelor: 2,
  // 3 Especialización
  esp: 3, espec: 3,
  // 4 Maestría
  msc: 4, msca: 4, mgs: 4, mgtr: 4, mg: 4, mag: 4, mtr: 4, mtro: 4, mtra: 4, mba: 4, mcs: 4,
  // 5 Doctorado
  phd: 5, php: 5, ph: 5, doc: 5, dr: 5, dra: 5,
  // 6 Posdoctorado
  posdoctorado: 6, postdoc: 6
};

// Palabras completas (para prefijo y tolerancia a errores de tipeo).
// Si un docente tiene una profesión que no esté aquí, solo hay que agregarla.
const PALABRAS_NIVEL = [
  [0, "tecnico"], [0, "tecnica"],
  [1, "tecnologo"], [1, "tecnologa"],
  [2, "ingeniero"], [2, "ingeniera"], [2, "licenciado"], [2, "licenciada"],
  [2, "licenciatura"], [2, "arquitecto"], [2, "arquitecta"], [2, "abogado"],
  [2, "abogada"], [2, "economista"], [2, "contador"], [2, "contadora"],
  [2, "psicologo"], [2, "psicologa"], [2, "medico"], [2, "medica"],
  [2, "odontologo"], [2, "odontologa"], [2, "veterinario"], [2, "veterinaria"],
  [2, "biologo"], [2, "biologa"], [2, "quimico"], [2, "quimica"],
  [2, "disenador"], [2, "disenadora"], [2, "administrador"], [2, "administradora"],
  [2, "sociologo"], [2, "sociologa"], [2, "enfermero"], [2, "enfermera"],
  [2, "nutricionista"], [2, "pedagogo"], [2, "pedagoga"], [2, "periodista"],
  [2, "comunicador"], [2, "comunicadora"], [2, "fisico"], [2, "matematico"],
  [2, "geologo"], [2, "farmaceutico"], [2, "bioquimico"],
  [3, "especializacion"], [3, "especialista"],
  [4, "magister"], [4, "maestria"], [4, "master"],
  [5, "doctor"], [5, "doctora"], [5, "doctorado"],
  [6, "posdoctorado"], [6, "postdoctorado"]
];

// Quita lo que aún no es título: "estudiante de maestría", "egresado de...", "doctorando..."
const PATRON_NO_TITULADO = /(doctorando|doctoranda|estudiante|egresad[oa]|cursando|candidat[oa])[^,;\n]*/g;

// En Ecuador estos "Doctor en ..." son títulos de tercer nivel, no PhD
const PATRON_DOCTOR_TERCER_NIVEL =
  /\b(doctor|doctora|dr|dra)\s+en\s+(medicina|jurisprudencia|odontologia|veterinaria|derecho|leyes)/g;

// Distancia de Levenshtein (cuántas letras hay que cambiar para pasar de a a b)
function distanciaEdicion(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Nivel de UNA palabra: sigla exacta → prefijo (>=5 letras) → error de tipeo
function nivelDePalabra(tok) {
  if (Object.prototype.hasOwnProperty.call(SIGLAS, tok)) return SIGLAS[tok];
  if (tok.length < 5) return null; // palabras cortas solo valen como sigla exacta

  // Palabra cortada: "ingenier", "licenciad", "tecnic"
  for (const [nivel, ref] of PALABRAS_NIVEL) {
    if (ref.startsWith(tok)) return nivel;
  }

  // Error de tipeo: tolerancia según el largo de la palabra de referencia
  let mejor = null, mejorDist = Infinity;
  for (const [nivel, ref] of PALABRAS_NIVEL) {
    const tol = ref.length >= 9 ? 2 : ref.length >= 6 ? 1 : 0;
    if (!tol || Math.abs(ref.length - tok.length) > tol) continue;
    const d = distanciaEdicion(tok, ref);
    if (d <= tol && d < mejorDist) { mejor = nivel; mejorDist = d; }
  }
  return mejor;
}

// Devuelve el índice de NIVELES (el más alto encontrado) o null si no se entiende
function detectarNivelActual(texto) {
  const t = String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ph\.?\s?d|dr\.?)\s*\(\s*c\s*\)/g, " ")   // PhD(c), Dr(c) = aún no titulado
    .replace(PATRON_NO_TITULADO, " ")
    .replace(/\./g, "")                                      // "ph.d." → "phd", "m.sc." → "msc"
    .replace(/\b(pos|post)\s*-?\s*(doctor\w*|doc)\b/g, "posdoctorado")
    .replace(PATRON_DOCTOR_TERCER_NIVEL, " tercer nivel ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!t) return null;

  const tokens = t.split(" ");
  let maximo = null;
  let despuesDeEn = false;

  for (const tok of tokens) {
    // Lo que va después de "en" es el área ("Técnico en Química"), no la profesión
    if (despuesDeEn) {
      if (["la", "el", "los", "las"].includes(tok)) continue;
      despuesDeEn = false;
      continue;
    }
    if (tok === "en") { despuesDeEn = true; continue; }

    const nivel = nivelDePalabra(tok);
    if (nivel !== null && (maximo === null || nivel > maximo)) maximo = nivel;
  }
  return maximo;
}

// Devuelve { ok, msg } — solo para la formación específica.
// estricto = true  → un título no reconocido SÍ bloquea (submit / al salir del campo)
// estricto = false → solo avisa cuando el nivel es menor (mientras escribe)
function validarNivelEspecifica(estricto = true) {
  const r7 = document.getElementById("respuesta7").value.trim();
  const propuesto = NIVELES.indexOf(document.getElementById("nivelFormacionEspecifica").value);

  if (!r7) return { ok: true, msg: "" }; // lo cubre "required"

  const actual = detectarNivelActual(r7);

  if (actual === null) {
    if (!estricto) return { ok: true, msg: "" };
    return {
      ok: false,
      msg: "No se reconoce su título en la pregunta 07. Escríbalo completo o con su sigla (ej.: Ingeniero en Sistemas, Tnlg., Mgs., MSc., PhD)."
    };
  }

  // Sin nivel propuesto: lo cubre "required"
  if (propuesto === -1) return { ok: true, msg: "" };

  if (propuesto < actual) {
    return {
      ok: false,
      msg: `Su título actual es de nivel ${NIVELES[actual]}. La formación específica debe ser del mismo nivel o superior.`
    };
  }

  return { ok: true, msg: "" };
}

// Aviso inline debajo del select de nivel específico
function obtenerAviso(el) {
  let aviso = el.parentElement.querySelector(".aviso-nivel");
  if (!aviso) {
    aviso = document.createElement("div");
    aviso.className = "aviso-nivel oculto";
    el.insertAdjacentElement("afterend", aviso);
  }
  return aviso;
}

function mostrarAviso(el, msg) {
  const aviso = obtenerAviso(el);
  aviso.textContent = msg;
  aviso.classList.toggle("oculto", !msg);
}

function refrescarAvisoNivel(estricto = false) {
  const el = document.getElementById("nivelFormacionEspecifica");
  const { msg } = validarNivelEspecifica(estricto);
  mostrarAviso(el, msg);
}

// Mientras escribe: aviso suave. Al salir del campo / cambiar el select: aviso estricto.
["respuesta7", "nivelFormacionEspecifica"].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener("input", () => refrescarAvisoNivel(false));
  el.addEventListener("change", () => refrescarAvisoNivel(true));
});

// ─── SUBMIT ───────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!formularioActivo) {
    mostrarMensajeFormularioCerrado();
    return;
  }

  // No se puede enviar sin validar la cédula primero
  if (!cedulaValidada) {
    setEstado("Debe ingresar y validar su número de cédula antes de continuar", "err");
    return;
  }

  // Si la cédula ya tiene plan, no dejar generar — mostrar modal
  if (cedulaBloqueada && ultimoDocumento) {
    window.abrirModalReDescarga?.();
    return;
  }

  setEstado("", "");
  btnReDescargar.classList.add("oculto");
  ultimoDocumento = null;
  window._ultimoDocumento = null;

  const nombres = document.getElementById("nombres").value.trim();
  const carrera = document.getElementById("carrera").value.trim();
  const cedula = document.getElementById("cedula").value.trim();

  // ── Nuevos datos personales / laborales ──
  const telefono = document.getElementById("telefono").value.trim();
  const correo = document.getElementById("correo").value.trim();
  const funcionSustantiva = document.getElementById("funcionSustantiva").value.trim();
  const tipoContrato = document.getElementById("tipoContrato").value.trim();

  const r1 = document.getElementById("respuesta1").value.trim();
  const r2 = document.getElementById("respuesta2").value.trim();
  const r3 = document.getElementById("respuesta3").value.trim();
  const r4 = document.getElementById("respuesta4").value.trim();
  const r5 = obtenerHerramientasSeleccionadas(); // selección múltiple
  const r6 = document.getElementById("respuesta6").value.trim();
  const r7 = document.getElementById("respuesta7").value.trim();
  const r8 = document.getElementById("respuesta8").value.trim();
  const r9 = document.getElementById("respuesta9").value.trim();
  const r10 = document.getElementById("respuesta10").value.trim();

  const nombreFormacionEspecifica = document.getElementById("nombreFormacionEspecifica").value.trim();
  const nivelFormacionEspecifica = document.getElementById("nivelFormacionEspecifica").value.trim();
  const fechaInicioE = document.getElementById("fechaInicioE").value.trim();
  const fechaFinE = document.getElementById("fechaFinE").value.trim();

  const nombreFormacionGenerica = document.getElementById("nombreFormacionGenerica").value.trim();
  const nivelFormacionGenerica = document.getElementById("nivelFormacionGenerica").value.trim();
  const fechaInicioG = document.getElementById("fechaInicioG").value.trim();
  const fechaFinG = document.getElementById("fechaFinG").value.trim();

  if (!nombres || !carrera || !cedula) {
    setEstado("Complete los datos del docente", "err");
    return;
  }

  if (!/^\d{10}$/.test(telefono)) {
    setEstado("Ingrese un número de teléfono válido de 10 dígitos", "err");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    setEstado("Ingrese un correo electrónico válido", "err");
    return;
  }

  if (!funcionSustantiva || !tipoContrato) {
    setEstado("Seleccione la función sustantiva y el tipo de contrato", "err");
    return;
  }

  if (!r5) {
    setEstado("Seleccione al menos una herramienta tecnológica en la pregunta 05", "err");
    return;
  }

  if (!r9 || !r10) {
    setEstado("Responda las preguntas 09 y 10", "err");
    return;
  }

  if (!carreraActual) {
    setEstado("Seleccione una carrera válida", "err");
    return;
  }

  if (fechaFinE && fechaInicioE && fechaFinE < fechaInicioE) {
    setEstado("La fecha fin específica no puede ser menor a la fecha inicio", "err");
    return;
  }

  if (fechaFinG && fechaInicioG && fechaFinG < fechaInicioG) {
    setEstado("La fecha fin genérica no puede ser menor a la fecha inicio", "err");
    return;
  }

  // La P07 debe ser un título reconocible y el nivel de la formación ESPECÍFICA
  // debe ser igual o superior a ese título (validación estricta)
  {
    const { ok, msg } = validarNivelEspecifica(true);
    if (!ok) {
      mostrarAviso(document.getElementById("nivelFormacionEspecifica"), msg);
      setEstado(`Formación específica: ${msg}`, "err");
      return;
    }
  }

  window.mostrarAnimacionGenerando?.();

  try {
    if (!formularioActivo) {
      window.ocultarAnimacionGenerando?.(false);
      mostrarMensajeFormularioCerrado();
      return;
    }

    const planExistente = await obtenerPlanExistente(cedula);
    const genericas = await obtenerCapacitacionesGenericasGlobal();
    const capsCombinadas = combinarCapacitaciones(carreraActual, genericas);

    const listaCapacitaciones = construirListaCapacitaciones(capsCombinadas);
    const actividades = obtenerActividadesDesdeCapacitaciones(capsCombinadas);
    const formE = {
      nombre: nombreFormacionEspecifica,
      nivel: nivelFormacionEspecifica,
      inicio: fechaInicioE,
      fin: fechaFinE
    };

    const formG = {
      nombre: nombreFormacionGenerica,
      nivel: nivelFormacionGenerica,
      inicio: fechaInicioG,
      fin: fechaFinG
    };

    if (planExistente) {
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

      ultimoDocumento = construirDataDoc({
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
          r8: planExistente.respuesta8 || "",
          r9: planExistente.respuesta9 || "",
          r10: planExistente.respuesta10 || ""
        },
        caps: listaCapacitaciones,
        acts: actividades,
        formE: formEGuardada,
        formG: formGGuardada,
        extra: extraDesdePlan(planExistente)
      });

      window._ultimoDocumento = ultimoDocumento;

      window.ocultarAnimacionGenerando?.(false);
      window.abrirModalReDescarga?.();

      setEstado("El plan ya fue generado anteriormente. Puede volver a descargarlo.", "");
      btnReDescargar.classList.remove("oculto");
      return;
    }

    const codigo = await generarCodigoSecuencialPlan();

    if (!formularioActivo) {
      window.ocultarAnimacionGenerando?.(false);
      mostrarMensajeFormularioCerrado();
      return;
    }

    const dataDoc = construirDataDoc({
      codigo,
      nombres,
      carrera,
      respuestas: { r1, r2, r3, r4, r5, r6, r7, r8, r9, r10 },
      caps: listaCapacitaciones,
      acts: actividades,
      formE,
      formG,
      extra: { telefono, correo, funcion: funcionSustantiva, contrato: tipoContrato }
    });

    await guardarPlanGenerado({
      docente: nombres,
      cedula,
      carrera,
      codigo,
      telefono,
      correo,
      funcionSustantiva,
      tipoContrato,
      respuesta1: r1,
      respuesta2: r2,
      respuesta3: r3,
      respuesta4: r4,
      respuesta5: r5,
      respuesta6: r6,
      respuesta7: r7,
      respuesta8: r8,
      respuesta9: r9,
      respuesta10: r10,
      nombreFormacionEspecifica,
      nivelFormacionEspecifica,
      fechaInicioE,
      fechaFinE,
      nombreFormacionGenerica,
      nivelFormacionGenerica,
      fechaInicioG,
      fechaFinG,
      sede: sedeSeleccionada
    });

    ultimoDocumento = dataDoc;
    window._ultimoDocumento = dataDoc;

    await generarDocumento(dataDoc);

    window.ocultarAnimacionGenerando?.(true);
    setEstado("Plan individual generado correctamente ✔", "ok");
    btnReDescargar.classList.remove("oculto");

  } catch (error) {
    window.ocultarAnimacionGenerando?.(false);
    console.error("Error:", error);
    setEstado(error.message || "Ocurrió un error al generar el plan individual", "err");
  }
});

// ─── INIT ─────────────────────────────────────────────────────
function iniciarFormulario() {
  escucharEstadoFormulario();
  cargarCarreras();
  cargarConfiguracionTiempoReal();
}

// P05 ya no es textarea (ahora son checkboxes), por eso no está en esta lista
["respuesta1", "respuesta2", "respuesta3", "respuesta4", "respuesta6"]
  .forEach(id => limitarPalabras(document.getElementById(id), MAX_PALABRAS_RESPUESTA, MAX_CARACTERES_RESPUESTA));

limitarPalabras(document.getElementById("respuesta7"), MAX_PALABRAS_RESPUESTA7, MAX_CARACTERES_RESPUESTA7);

deshabilitarFormulario();
mostrarModalSede();