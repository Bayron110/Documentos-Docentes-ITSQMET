import { db } from "../../firebase/firebase.js";
import {
  ref,
  get,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const form            = document.getElementById("formPlanIndividual");
const estado          = document.getElementById("estado");
const selectCarrera   = document.getElementById("carrera");

const detalleEspecifica        = document.getElementById("detalleEspecifica");
const detalleGenerica          = document.getElementById("detalleGenerica");
const tablaCapacitacionesBody  = document.querySelector("#tablaCapacitaciones tbody");
const listaTeoria              = document.getElementById("listaTeoria");
const listaPractica            = document.getElementById("listaPractica");
const btnReDescargar           = document.getElementById("btnReDescargar");
const cedulaInput              = document.getElementById("cedula");

const API_BASE = "https://backen-pdf-trabajo.onrender.com";

let carreraActual    = null;
let ultimoDocumento  = null;
let formularioActivo = true;
let yaMostroCierre   = false;
let _cedulaTimer     = null;
let cedulaBloqueada  = false; // true cuando la cédula ya tiene plan generado

// ── Badge de cédula ────────────────────────────────────────────
let cedulaBadge = document.getElementById("cedulaBadge");

function setBadge(tipo, texto) {
  if (!cedulaBadge) return;
  cedulaBadge.className   = "cedula-badge " + tipo;
  cedulaBadge.textContent = texto;
  cedulaBadge.classList.remove("oculto");
}

function clearBadge() {
  if (!cedulaBadge) return;
  cedulaBadge.className   = "cedula-badge oculto";
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

// ── Exponer para el modal/html ──────────────────────────────────
window._ultimoDocumento = null;
window._reDescargarFn   = async () => {
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
  } catch {}

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

// ─── FECHAS LARGAS ──────────────────────────────────────────────
function convertirMesANombre(numeroMes) {
  const meses = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"
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
  const fin    = formatearFechaLarga(fechaFin);
  if (inicio && fin) return `desde el ${inicio} hasta el ${fin}`;
  if (inicio) return `desde el ${inicio}`;
  if (fin)    return `hasta el ${fin}`;
  return "";
}

// ─── CAPACITACIONES ────────────────────────────────────────────
function obtenerCapacitacionesDeCarrera(carreraData) {
  if (!carreraData?.capacitaciones || typeof carreraData.capacitaciones !== "object") return [];

  return Object.entries(carreraData.capacitaciones)
    .map(([key, value]) => ({
      key,
      capacitacion:  value?.capacitacion  || "",
      tipo:          value?.tipo          || "Aprobación",
      horas:         Number(value?.horas  || 0),
      fechaInicio:   value?.fechaInicio   || "",
      fechaFin:      value?.fechaFin      || "",
      estado:        value?.estado        || "",
      teoriaTemas:   Array.isArray(value?.teoriaTemas)  ? value.teoriaTemas  : [],
      practicaTemas: Array.isArray(value?.practicaTemas) ? value.practicaTemas : []
    }))
    .filter(cap => cap.capacitacion)
    .sort((a, b) => Number(a.key) - Number(b.key));
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

function construirListaCapacitaciones(carreraData) {
  return obtenerCapacitacionesDeCarrera(carreraData).map((cap, index) => ({
    contador:    index + 1,
    nombre:      cap.capacitacion,
    horas:       cap.horas   || 0,
    fechaInicio: cap.fechaInicio || "",
    fechaFin:    cap.fechaFin    || "",
    tipo:        cap.tipo    || "Aprobación",
    estado:      cap.estado  || "-"
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

function obtenerActividadesDesdeCapacitaciones(carreraData) {
  const teoria = [];
  const practica = [];

  obtenerCapacitacionesDeCarrera(carreraData).forEach(cap => {
    cap.teoriaTemas.forEach(tema => {
      const t = String(tema?.titulo || "").trim();
      if (t && !teoria.some(x => normalizarTexto(x) === normalizarTexto(t))) teoria.push(t);
    });

    cap.practicaTemas.forEach(tema => {
      const t = String(tema?.titulo || "").trim();
      if (t && !practica.some(x => normalizarTexto(x) === normalizarTexto(t))) practica.push(t);
    });
  });

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
    } catch {}
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
    renderDetalleCapacitacion(detalleGenerica,   null, "Primero seleccione una carrera");
    renderTablaCapacitaciones([]);
    renderListaHtml(listaTeoria, []);
    renderListaHtml(listaPractica, []);
    return;
  }

  const carreraData = await obtenerCarreraPorNombre(nombreCarrera);
  carreraActual = carreraData;

  const caps = obtenerCapacitacionesDeCarrera(carreraData);

  renderDetalleCapacitacion(detalleEspecifica, caps[0] || null, "No hay capacitación 1");
  renderDetalleCapacitacion(detalleGenerica,   caps[1] || null, "No hay capacitación 2");
  renderTablaCapacitaciones(construirListaCapacitaciones(carreraData));

  const acts = obtenerActividadesDesdeCapacitaciones(carreraData);

  renderListaHtml(listaTeoria,   acts.teoria);
  renderListaHtml(listaPractica, acts.practica);
}

// ─── CÓDIGO PLAN INDIVIDUAL ────────────────────────────────────
async function obtenerCodigoBasePlanIndividual() {
  const snap = await get(ref(db, "config-plan-individual/1"));

  if (!snap.exists()) {
    throw new Error("No existe la configuración de plan individual");
  }

  const data   = snap.val();
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
        } catch {}
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

    if (!ultimo) {
      ultimo = data;
      return;
    }

    if (String(data?.codigo || "").localeCompare(String(ultimo?.codigo || ""), "es") > 0) {
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
      contador:   index + 1,
      nombre:     item.nombre,
      horas:      item.horas,
      fechaInicio: formatoFecha(item.fechaInicio),
      fechaFin:    formatoFecha(item.fechaFin),
      fecha:       construirRangoFechaTexto(item.fechaInicio, item.fechaFin),
      tipo:        item.tipo,
      estado:      item.estado
    })),

    Teoria:   acts.teoria,
    Practica: acts.practica,

    NombreFormacionEspecifica: formE.nombre,
    NivelFormacionEspecifica:  formE.nivel,
    FechaInicioE: formatoFecha(formE.inicio),
    FechaFinE:    formatoFecha(formE.fin),

    NombreFormacionGenerica: formG.nombre,
    NivelFormacionGenerica:  formG.nivel,
    FechaInicioG: formatoFecha(formG.inicio),
    FechaFinG:    formatoFecha(formG.fin),

    "NombreFormaciónEspecifica": formE.nombre,
    "NivelFormaciónEspecifica":  formE.nivel,
    "NombreFormaciónGenerica":   formG.nombre,
    "NivelFormaciónGenerica":    formG.nivel
  };
}

// ─── DETECCIÓN DE CÉDULA EN TIEMPO REAL ───────────────────────
cedulaInput.addEventListener("input", () => {
  clearTimeout(_cedulaTimer);

  // Resetear bloqueo mientras se escribe
  bloquearNavegacion(false);
  clearBadge();

  const val = cedulaInput.value.trim();

  if (val.length < 10) {
    return;
  }

  setBadge("checking", "Verificando…");

  _cedulaTimer = setTimeout(async () => {
    try {
      const planExistente = await obtenerPlanExistente(val);

      if (planExistente) {
        setBadge("found", "Ya existe");
        bloquearNavegacion(true);

        // Construir el objeto dataDoc con los datos guardados
        const formEGuardada = {
          nombre: planExistente.nombreFormacionEspecifica || "",
          nivel:  planExistente.nivelFormacionEspecifica  || "",
          inicio: planExistente.fechaInicioE || "",
          fin:    planExistente.fechaFinE    || ""
        };

        const formGGuardada = {
          nombre: planExistente.nombreFormacionGenerica || "",
          nivel:  planExistente.nivelFormacionGenerica  || "",
          inicio: planExistente.fechaInicioG || "",
          fin:    planExistente.fechaFinG    || ""
        };

        // Para las caps y acts necesitamos cargar la carrera del plan guardado
        let caps = [];
        let acts = { teoria: [], practica: [] };

        try {
          const carreraData = await obtenerCarreraPorNombre(planExistente.carrera);
          if (carreraData) {
            caps = construirListaCapacitaciones(carreraData);
            acts = obtenerActividadesDesdeCapacitaciones(carreraData);
          }
        } catch {}

        ultimoDocumento = construirDataDoc({
          codigo:  planExistente.codigo,
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

        window._ultimoDocumento = ultimoDocumento;
        btnReDescargar.classList.remove("oculto");

        // Abrir el modal de re-descarga automáticamente
        window.abrirModalReDescarga?.();

      } else {
        setBadge("clear", "Disponible");
        bloquearNavegacion(false);
      }
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

// ─── SUBMIT ───────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!formularioActivo) {
    mostrarMensajeFormularioCerrado();
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

  const nombres  = document.getElementById("nombres").value.trim();
  const carrera  = document.getElementById("carrera").value.trim();
  const cedula   = document.getElementById("cedula").value.trim();

  const r1 = document.getElementById("respuesta1").value.trim();
  const r2 = document.getElementById("respuesta2").value.trim();
  const r3 = document.getElementById("respuesta3").value.trim();
  const r4 = document.getElementById("respuesta4").value.trim();
  const r5 = document.getElementById("respuesta5").value.trim();
  const r6 = document.getElementById("respuesta6").value.trim();
  const r7 = document.getElementById("respuesta7").value.trim();
  const r8 = document.getElementById("respuesta8").value.trim();

  const nombreFormacionEspecifica = document.getElementById("nombreFormacionEspecifica").value.trim();
  const nivelFormacionEspecifica  = document.getElementById("nivelFormacionEspecifica").value.trim();
  const fechaInicioE = document.getElementById("fechaInicioE").value.trim();
  const fechaFinE    = document.getElementById("fechaFinE").value.trim();

  const nombreFormacionGenerica = document.getElementById("nombreFormacionGenerica").value.trim();
  const nivelFormacionGenerica  = document.getElementById("nivelFormacionGenerica").value.trim();
  const fechaInicioG = document.getElementById("fechaInicioG").value.trim();
  const fechaFinG    = document.getElementById("fechaFinG").value.trim();

  if (!nombres || !carrera || !cedula) {
    setEstado("Complete los datos del docente", "err");
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

  window.mostrarAnimacionGenerando?.();

  try {
    if (!formularioActivo) {
      window.ocultarAnimacionGenerando?.(false);
      mostrarMensajeFormularioCerrado();
      return;
    }

    const planExistente       = await obtenerPlanExistente(cedula);
    const listaCapacitaciones = construirListaCapacitaciones(carreraActual);
    const actividades         = obtenerActividadesDesdeCapacitaciones(carreraActual);

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
          r8: planExistente.respuesta8 || ""
        },
        caps: listaCapacitaciones,
        acts: actividades,
        formE: formEGuardada,
        formG: formGGuardada
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
      respuestas: { r1, r2, r3, r4, r5, r6, r7, r8 },
      caps: listaCapacitaciones,
      acts: actividades,
      formE,
      formG
    });

    await guardarPlanGenerado({
      docente: nombres,
      cedula,
      carrera,
      codigo,
      respuesta1: r1,
      respuesta2: r2,
      respuesta3: r3,
      respuesta4: r4,
      respuesta5: r5,
      respuesta6: r6,
      respuesta7: r7,
      respuesta8: r8,
      nombreFormacionEspecifica,
      nivelFormacionEspecifica,
      fechaInicioE,
      fechaFinE,
      nombreFormacionGenerica,
      nivelFormacionGenerica,
      fechaInicioG,
      fechaFinG
    });

    ultimoDocumento         = dataDoc;
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
escucharEstadoFormulario();
cargarCarreras();
cargarConfiguracionTiempoReal();