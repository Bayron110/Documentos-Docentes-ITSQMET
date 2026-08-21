import { db } from "../../firebase/firebase.js";
import {
  ref,
  get,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const form               = document.getElementById("formPatrocinio");
const estado             = document.getElementById("estado");
const selectCarrera      = document.getElementById("carrera");
const selectCapacitacion = document.getElementById("capacitacion");
const capHint            = document.getElementById("capHint");
const btnReDescargar     = document.getElementById("btnReDescargar");
const nombresInput       = document.getElementById("nombres");
const cedulaInput        = document.getElementById("cedula");
const cedulaBadge        = document.getElementById("cedulaBadge");

const modalAviso         = document.getElementById("modalAviso");
const modalNombres       = document.getElementById("modalNombres");
const modalCapacitacion  = document.getElementById("modalCapacitacion");
const modalArchivo       = document.getElementById("modalArchivo");
const modalCerrar        = document.getElementById("modalCerrar");

const modalExiste        = document.getElementById("modalExiste");
const existeNombres      = document.getElementById("existeNombres");
const existeCapacitacion = document.getElementById("existeCapacitacion");
const existeCarrera      = document.getElementById("existeCarrera");
const existeCodigo       = document.getElementById("existeCodigo");
const existeCerrar       = document.getElementById("existeCerrar");
const existeDescargar    = document.getElementById("existeDescargar");

const API_BASE       = "https://backen-pdf-trabajo.onrender.com";

let ultimoDocumento     = null;
let documentoExistente  = null;
let mapaCapacitaciones  = {};
let _cedulaTimer = null;
let formularioActivo = true;

// ─────────────────────────────────────────────
// NUEVO: ESTADO DE VALIDACIÓN DE CÉDULA
// ─────────────────────────────────────────────
let cedulaValidada          = false; // true cuando la cédula pasó la validación (registrada o "primera vez" confirmada)
let capacitacionesCompletadas = {};  // { claveCapacitacion: registro } -> ya generó el acuerdo para esa capacitación

window.volver = () => { window.location.href = "../../index.html"; };

// ─────────────────────────────────────────────
// VALIDAR FORMULARIO ACTIVO EN TIEMPO REAL
// ─────────────────────────────────────────────
function mostrarMensajeFormularioCerrado() {
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
        <h2 style="margin-bottom:12px;color:#1e3a5f;">
          Formulario cerrado
        </h2>

        <p style="font-size:16px;color:#475569;line-height:1.6;">
          El administrador cerró este formulario.
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
  const formularioRef = ref(db, "Activador/patrocinio");

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

// ─────────────────────────────────────────────
// HELPERS DE ESTADO
// ─────────────────────────────────────────────
function setEstado(msg, tipo = "") {
  estado.textContent = msg;
  estado.className   = "pestado" + (tipo ? " " + tipo : "");
}

function setBadge(tipo, texto) {
  cedulaBadge.className   = "cedula-badge " + tipo;
  cedulaBadge.textContent = texto;
  cedulaBadge.classList.remove("oculto");
}

function clearBadge() {
  cedulaBadge.className = "cedula-badge oculto";
  cedulaBadge.textContent = "";
}

// ─────────────────────────────────────────────
// NUEVO: BLOQUEO / DESBLOQUEO DEL FORMULARIO SEGÚN CÉDULA
// ─────────────────────────────────────────────
function obtenerCamposDependientesDeCedula() {
  // Todos los campos del formulario excepto el input de cédula
  return Array.from(form.querySelectorAll("input, select, button"))
    .filter(el => el !== cedulaInput);
}

function deshabilitarFormulario() {
  obtenerCamposDependientesDeCedula().forEach(el => { el.disabled = true; });
}

function habilitarFormulario() {
  obtenerCamposDependientesDeCedula().forEach(el => { el.disabled = false; });
  // La capacitación depende de la carrera, así que arranca deshabilitada hasta elegir carrera
  limpiarSelectCapacitacion("Primero seleccione su carrera", true);
}

function resetearEstadoPorCedula() {
  cedulaValidada = false;
  capacitacionesCompletadas = {};
  nombresInput.value = "";
  selectCarrera.value = "";
  limpiarSelectCapacitacion("Ingrese su cédula primero", true);
  deshabilitarFormulario();

  const overlayPrevio = document.getElementById("modalPrimeraVezOverlay");
  if (overlayPrevio) overlayPrevio.remove();
  document.body.style.overflow = "";
}

// ─────────────────────────────────────────────
// NUEVO: MODAL "¿ES LA PRIMERA VEZ?"
// ─────────────────────────────────────────────
function mostrarModalPrimeraVez(cedula) {
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
        No encontramos registros previos con la cédula <strong>${cedula}</strong>.<br>
        ¿Es la primera vez que usas este sistema?
      </p>
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        <button id="btnPrimeraVezSi" style="
          padding:10px 18px;border:none;border-radius:8px;
          background:#2563eb;color:#fff;font-weight:600;cursor:pointer;font-size:14px;
        ">Sí, es mi primera vez</button>
        <button id="btnPrimeraVezNo" style="
          padding:10px 18px;border:1px solid #cbd5e1;border-radius:8px;
          background:#fff;color:#334155;font-weight:600;cursor:pointer;font-size:14px;
        ">No</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  document.getElementById("btnPrimeraVezSi").addEventListener("click", () => {
    overlay.remove();
    document.body.style.overflow = "";

    cedulaValidada = true;
    capacitacionesCompletadas = {};
    setBadge("clear", "Registro nuevo");
    setEstado("", "");
    habilitarFormulario();
  });

  document.getElementById("btnPrimeraVezNo").addEventListener("click", () => {
    overlay.remove();
    document.body.style.overflow = "";

    cedulaValidada = false;
    setBadge("found", "No registrado");
    setEstado(
      "No encontramos un docente registrado con esta cédula. Si cree que se trata de un error, verifique su número de cédula y vuelva a ingresar, o contáctese con la Unidad De Gestión de Procesos Academicos",
      "err"
    );
    deshabilitarFormulario();
  });
}

// ─────────────────────────────────────────────
// NUEVO: PROCESAR CÉDULA INGRESADA
// ─────────────────────────────────────────────
async function procesarCedula(cedula) {
  try {
    const snap = await get(ref(db, `patrociniosGenerados/${cedula}`));

    if (!snap.exists()) {
      // Nunca ha generado ningún acuerdo -> preguntar si es primera vez
      clearBadge();
      mostrarModalPrimeraVez(cedula);
      return;
    }

    // Docente con historial
    const registros = {};
    let masReciente = null;

    snap.forEach(child => {
      const d = child.val();
      registros[child.key] = d;

      if (!masReciente || String(d?.codigo || "").localeCompare(String(masReciente?.codigo || ""), "es") > 0) {
        masReciente = d;
      }
    });

    capacitacionesCompletadas = registros;
    cedulaValidada = true;

    setBadge("found", "Docente registrado");
    setEstado("", "");

    if (masReciente?.docente) {
      nombresInput.value = masReciente.docente;
    }

    habilitarFormulario();

    // Si tiene una carrera previa conocida, se la preseleccionamos para agilizar
    if (masReciente?.carrera) {
      const opcionExiste = Array.from(selectCarrera.options).some(o => o.value === masReciente.carrera);
      if (opcionExiste) {
        selectCarrera.value = masReciente.carrera;
        await cargarTodasLasCapacitaciones(masReciente.carrera);
      }
    }
  } catch (error) {
    console.error("Error al verificar la cédula:", error);
    clearBadge();
    setEstado("No se pudo verificar la cédula, intenta de nuevo", "err");
  }
}

// ─────────────────────────────────────────────
// MODAL 1 — AVISO DE ENVÍO
// ─────────────────────────────────────────────
function mostrarModalAviso(nombres, capacitacion, nombreArchivo) {
  modalNombres.textContent      = nombres;
  modalCapacitacion.textContent = capacitacion;
  modalArchivo.textContent      = nombreArchivo || "—";
  modalAviso.classList.remove("oculto");
  document.body.style.overflow = "hidden";
}

modalCerrar.addEventListener("click", () => {
  modalAviso.classList.add("oculto");
  document.body.style.overflow = "";
});

// ─────────────────────────────────────────────
// MODAL 2 — YA EXISTE (se mantiene como red de seguridad ante condiciones de carrera)
// ─────────────────────────────────────────────
function mostrarModalExiste(data, dataDoc) {
  existeNombres.textContent      = data.docente      || "—";
  existeCapacitacion.textContent = data.capacitacion || "—";
  existeCarrera.textContent      = data.carrera      || "—";
  existeCodigo.textContent       = data.codigo       || "—";
  documentoExistente             = dataDoc;

  modalExiste.classList.remove("oculto");
  document.body.style.overflow = "hidden";
}

existeCerrar.addEventListener("click", () => {
  modalExiste.classList.add("oculto");
  document.body.style.overflow = "";
  documentoExistente = null;
  clearBadge();
});

existeDescargar.addEventListener("click", async () => {
  if (!formularioActivo) {
    window.location.href = "../../index.html";
    return;
  }

  if (!documentoExistente) return;

  modalExiste.classList.add("oculto");
  document.body.style.overflow = "";

  try {
    setEstado("Re-descargando PDF...", "");
    window.mostrarAnimacionGenerando?.();
    await generarDoc(documentoExistente);
    window.ocultarAnimacionGenerando?.(true);
    setEstado("Documento descargado correctamente ✔", "ok");
    btnReDescargar.classList.remove("oculto");
    ultimoDocumento = documentoExistente;
  } catch (error) {
    window.ocultarAnimacionGenerando?.(false);
    console.error("Error en re-descarga:", error);
    setEstado(error.message || "Ocurrió un error al descargar el documento", "err");
  }
});

// ─────────────────────────────────────────────
// BOTÓN RE-DESCARGAR
// ─────────────────────────────────────────────
btnReDescargar.addEventListener("click", async () => {
  if (!formularioActivo) {
    window.location.href = "../../index.html";
    return;
  }

  if (!ultimoDocumento) return;

  try {
    setEstado("Re-descargando PDF...", "");
    window.mostrarAnimacionGenerando?.();
    await generarDoc(ultimoDocumento);
    window.ocultarAnimacionGenerando?.(true);
    setEstado("Documento descargado correctamente ✔", "ok");
  } catch (error) {
    window.ocultarAnimacionGenerando?.(false);
    console.error("Error en re-descarga:", error);
    setEstado(error.message || "Ocurrió un error al volver a descargar el documento", "err");
  }
});

// ─────────────────────────────────────────────
// DETECCIÓN DE CÉDULA EN TIEMPO REAL (REEMPLAZADA)
// ─────────────────────────────────────────────
cedulaInput.addEventListener("input", () => {
  clearTimeout(_cedulaTimer);
  const val = cedulaInput.value.trim();

  resetearEstadoPorCedula();

  if (val.length < 10) {
    clearBadge();
    return;
  }

  setBadge("checking", "Verificando…");

  _cedulaTimer = setTimeout(() => {
    procesarCedula(val);
  }, 700);
});

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
function limpiarNombreArchivo(texto) {
  return String(texto || "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTexto(texto) {
  return String(texto || "").trim().toLowerCase();
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

function limpiarSelectCapacitacion(mensaje = "-- Seleccione una capacitación --", deshabilitado = false) {
  selectCapacitacion.innerHTML = "";
  const opt = document.createElement("option");
  opt.value       = "";
  opt.textContent = mensaje;
  selectCapacitacion.appendChild(opt);
  selectCapacitacion.disabled = deshabilitado;
  capHint.textContent = "";
}

function convertirMesANombre(numeroMes) {
  const meses = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"
  ];
  return meses[Number(numeroMes) - 1] || "";
}

function formatearFechaTexto(fechaISO) {
  if (!fechaISO) return "";
  const partes = String(fechaISO).split("-");
  if (partes.length !== 3) return "";
  const mesNombre = convertirMesANombre(partes[1]);
  if (!mesNombre || !Number(partes[2]) || !partes[0]) return "";
  return `desde el ${Number(partes[2])} de ${mesNombre} de ${partes[0]}`;
}

function obtenerAnioMesDesdeFecha(fechaISO) {
  if (!fechaISO) throw new Error("La capacitación seleccionada no tiene fecha de inicio");
  const partes = String(fechaISO).split("-");
  if (partes.length !== 3) throw new Error("La fecha de inicio no tiene el formato esperado");
  const anio = partes[0];
  const mes  = String(partes[1]).padStart(2, "0");
  if (!anio || !mes) throw new Error("No se pudo obtener año y mes desde la capacitación");
  return { anio, mes };
}

function obtenerCapacitacionesDeCarrera(carreraData) {
  if (!carreraData?.capacitaciones || typeof carreraData.capacitaciones !== "object") return [];
  return Object.entries(carreraData.capacitaciones)
    .map(([key, value]) => ({ key, ...value }))
    .filter(cap => cap && cap.capacitacion)
    .sort((a, b) => Number(a.key) - Number(b.key));
}
function obtenerCapacitacionesGenericas(dataGenericas) {
  if (!dataGenericas || typeof dataGenericas !== "object") return [];
  return Object.entries(dataGenericas)
    .map(([key, value]) => ({ key, ...value }))
    .filter(cap => cap && cap.capacitacion)
    .filter(cap => cap.habilitada !== false) // NUEVO: oculta las deshabilitadas explícitamente
    .sort((a, b) => Number(a.key) - Number(b.key));
}

function obtenerNombreEstado(cap) {
  return cap?.estado ? ` (${cap.estado})` : "";
}

// ─────────────────────────────────────────────
// CONVERTIR DOCX A PDF
// ─────────────────────────────────────────────
async function convertirDocxAPdf(blobDocx, nombreBase) {
  const formData = new FormData();
  formData.append("file", blobDocx, `${nombreBase}.docx`);
  formData.append("tipo_documento", "patrocinio");

  const response = await fetch(`${API_BASE}/convertir-pdf`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    let mensajeError = "No se pudo convertir el documento a PDF";

    try {
      const errorData = await response.json();
      mensajeError = errorData.detail || mensajeError;
    } catch {}

    throw new Error(mensajeError);
  }

  const blobPdf = await response.blob();
  saveAs(blobPdf, `${nombreBase}.pdf`);
}

// ─────────────────────────────────────────────
// CARRERAS Y CAPACITACIONES (MODIFICADA: filtra las ya completadas por la cédula)
// ─────────────────────────────────────────────
async function cargarTodasLasCapacitaciones(carreraFiltro = null) {
  try {
    limpiarSelectCapacitacion("Cargando capacitaciones...", true);
    capHint.textContent = "";

    const [snap, snapGenericas] = await Promise.all([
      get(ref(db, "carreras")),
      get(ref(db, "capacitacionesGenericas"))
    ]);

    mapaCapacitaciones = {};
    selectCapacitacion.innerHTML = "";

    const optDefault = document.createElement("option");
    optDefault.value = "";
    optDefault.textContent = "-- Seleccione una capacitación --";
    selectCapacitacion.appendChild(optDefault);

    let totalCapsDisponibles = 0; // antes de filtrar por completadas
    let totalCapsMostradas   = 0; // después de filtrar

    // ── Capacitaciones específicas por carrera ──
    if (snap.exists()) {
      const carreras = [];

      snap.forEach(child => {
        const data = child.val();
        if (data?.nombre) carreras.push({ id: child.key, ...data });
      });

      carreras.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));

      for (const carrera of carreras) {
        const esLaCarreraFiltrada = !carreraFiltro || normalizarTexto(carrera.nombre) === normalizarTexto(carreraFiltro);
        if (carreraFiltro && !esLaCarreraFiltrada) continue;

        const caps = obtenerCapacitacionesDeCarrera(carrera);
        if (!caps.length) continue;

        const group = document.createElement("optgroup");
        group.label = carreraFiltro ? `★ ${carrera.nombre}` : carrera.nombre;
        let capsAgregadasAlGrupo = 0;

        for (const cap of caps) {
          const nombreCap = String(cap.capacitacion).trim();
          const claveCap  = limpiarClave(nombreCap);

          mapaCapacitaciones[claveCap] = {
            carrera: carrera.nombre,
            capKey: cap.key,
            capacitacion: nombreCap,
            data: cap,
            origen: "carrera"
          };

          totalCapsDisponibles++;

          // NUEVO: si la cédula validada ya generó el acuerdo de esta capacitación, se oculta
          if (capacitacionesCompletadas[claveCap]) continue;

          const opt = document.createElement("option");
          opt.value = nombreCap;
          opt.textContent = `${nombreCap}${obtenerNombreEstado(cap)}`;
          opt.dataset.carrera = carrera.nombre;
          opt.dataset.capKey = cap.key;

          group.appendChild(opt);
          capsAgregadasAlGrupo++;
          totalCapsMostradas++;
        }

        if (capsAgregadasAlGrupo > 0) {
          selectCapacitacion.appendChild(group);
        }
      }
    }

    // ── Capacitaciones genéricas (aplican a TODAS las carreras) ──
    if (snapGenericas.exists()) {
      const capsGenericas = obtenerCapacitacionesGenericas(snapGenericas.val());

      if (capsGenericas.length) {
        const groupGenerico = document.createElement("optgroup");
        groupGenerico.label = "Capacitaciones Generales (Todas las carreras)";
        let capsAgregadasAlGrupo = 0;

        for (const cap of capsGenericas) {
          const nombreCap = String(cap.capacitacion).trim();
          const claveCap  = limpiarClave(nombreCap);
          const carreraTexto = carreraFiltro || "Todas las carreras";

          mapaCapacitaciones[claveCap] = {
            carrera: carreraTexto,
            capKey: cap.key,
            capacitacion: nombreCap,
            data: cap,
            origen: "generica"
          };

          totalCapsDisponibles++;

          // NUEVO: filtrar completadas también aquí
          if (capacitacionesCompletadas[claveCap]) continue;

          const opt = document.createElement("option");
          opt.value = nombreCap;
          opt.textContent = `${nombreCap}${obtenerNombreEstado(cap)}`;
          opt.dataset.carrera = carreraTexto;
          opt.dataset.capKey = cap.key;

          groupGenerico.appendChild(opt);
          capsAgregadasAlGrupo++;
          totalCapsMostradas++;
        }

        if (capsAgregadasAlGrupo > 0) {
          selectCapacitacion.appendChild(groupGenerico);
        }
      }
    }

    if (totalCapsDisponibles === 0) {
      limpiarSelectCapacitacion("No hay capacitaciones disponibles", true);
      return;
    }

    if (totalCapsMostradas === 0) {
      // NUEVO: mensaje distinto cuando ya completó todo
      limpiarSelectCapacitacion("Ya generaste todos los acuerdos disponibles ✔", true);
      setEstado("Ya generaste el acuerdo de patrocinio de todas las capacitaciones disponibles.", "ok");
      return;
    }

    selectCapacitacion.disabled = false;

    const opcionesReales = Array.from(selectCapacitacion.querySelectorAll("option")).filter(o => o.value);

    if (opcionesReales.length === 1) {
      selectCapacitacion.value = opcionesReales[0].value;
      actualizarHint(opcionesReales[0].value);
    }

  } catch (error) {
    console.error("Error al cargar capacitaciones:", error);
    limpiarSelectCapacitacion("Error al cargar capacitaciones", true);
  }
}

function actualizarHint(valorCap) {
  if (!valorCap) {
    capHint.textContent = "";
    return;
  }

  const info = mapaCapacitaciones[limpiarClave(valorCap)];
  capHint.textContent = info?.carrera ? `Pertenece a: ${info.carrera}` : "";
}

async function cargarCarreras() {
  try {
    const snap = await get(ref(db, "carreras"));

    selectCarrera.innerHTML = '<option value="">-- Seleccione su carrera --</option>';

    const optTodas = document.createElement("option");
    optTodas.value = "__todas__";
    optTodas.textContent = "Todas las carreras";
    selectCarrera.appendChild(optTodas);

    if (!snap.exists()) {
      limpiarSelectCapacitacion("Primero seleccione su carrera", true);
      return;
    }

    const carreras = [];

    snap.forEach(child => {
      const data = child.val();
      if (data?.nombre) carreras.push(data.nombre);
    });

    carreras.sort((a, b) => String(a).localeCompare(String(b), "es"));

    for (const nombre of carreras) {
      const opt = document.createElement("option");
      opt.value = nombre;
      opt.textContent = nombre;
      selectCarrera.appendChild(opt);
    }

    limpiarSelectCapacitacion("Primero seleccione su carrera", true);

  } catch (error) {
    console.error("Error al cargar carreras:", error);
    setEstado("No se pudieron cargar las carreras", "err");
  }
}

async function obtenerDatosCapacitacion(nombreCapacitacion) {
  const nombreNormalizado = limpiarClave(nombreCapacitacion);

  // 1) Buscar primero en capacitaciones por carrera
  const snap = await get(ref(db, "carreras"));

  if (snap.exists()) {
    let resultado = null;

    snap.forEach(child => {
      if (resultado) return;

      const data = child.val();
      const caps = obtenerCapacitacionesDeCarrera(data);

      for (const cap of caps) {
        if (limpiarClave(cap.capacitacion) === nombreNormalizado) {
          resultado = {
            capData: cap,
            carreraNombre: data.nombre,
            capKey: cap.key
          };
          break;
        }
      }
    });

    if (resultado) return resultado;
  }

  // 2) Si no se encontró, buscar en capacitacionesGenericas
  const snapGenericas = await get(ref(db, "capacitacionesGenericas"));

  if (snapGenericas.exists()) {
    const capsGenericas = obtenerCapacitacionesGenericas(snapGenericas.val());

    for (const cap of capsGenericas) {
      if (limpiarClave(cap.capacitacion) === nombreNormalizado) {
        const carreraSeleccionada = selectCarrera.value.trim();
        const carreraNombre = (carreraSeleccionada && carreraSeleccionada !== "__todas__")
          ? carreraSeleccionada
          : "Todas las carreras";

        return {
          capData: cap,
          carreraNombre,
          capKey: cap.key
        };
      }
    }
  }

  return null;
}
// ─────────────────────────────────────────────
// CÓDIGO DE PATROCINIO
// ─────────────────────────────────────────────
function construirCodigo(anio, mes, secuencia) {
  return `UGPA-RGI2-${String(secuencia).padStart(2, "0")}-PRO-134-${anio}-${mes}`;
}

function partirCodigo(codigo) {
  const partes = String(codigo || "").trim().split("-");
  if (partes.length !== 7) throw new Error("Código con formato inválido");

  return {
    anio: partes[5],
    mes: partes[6],
    secuencia: partes[2]
  };
}

async function generarCodigoSecuencial(fechaInicioCapacitacion) {
  const { anio, mes } = obtenerAnioMesDesdeFecha(fechaInicioCapacitacion);
  const snap = await get(ref(db, "patrociniosGenerados"));

  let maxSecuencia = 0;

  if (snap.exists()) {
    snap.forEach(snapCedula => {
      snapCedula.forEach(snapCap => {
        const data = snapCap.val();
        const codigoGuardado = String(data?.codigo || "").trim();

        if (!codigoGuardado) return;

        try {
          const partes = partirCodigo(codigoGuardado);

          if (partes.anio === anio && partes.mes === mes) {
            const sec = Number(partes.secuencia);
            if (!Number.isNaN(sec) && sec > maxSecuencia) {
              maxSecuencia = sec;
            }
          }
        } catch {}
      });
    });
  }

  return construirCodigo(anio, mes, maxSecuencia + 1);
}

// ─────────────────────────────────────────────
// PATROCINIOS GENERADOS
// ─────────────────────────────────────────────
async function obtenerPatrocinioExistente(cedula, capacitacion) {
  const clave = limpiarClave(capacitacion);
  const snap  = await get(ref(db, `patrociniosGenerados/${cedula}/${clave}`));
  return snap.exists() ? snap.val() : null;
}

async function guardarPatrocinioGenerado({ docente, cedula, carrera, capacitacion, codigo }) {
  const clave = limpiarClave(capacitacion);

  await set(ref(db, `patrociniosGenerados/${cedula}/${clave}`), {
    docente,
    cedula,
    carrera,
    capacitacion,
    codigo
  });
}

// ─────────────────────────────────────────────
// GENERAR DOCX → PDF
// ─────────────────────────────────────────────
async function generarDoc(data) {
  const res = await fetch("../../doc/patrocinio.docx");

  if (!res.ok) {
    throw new Error("No se pudo cargar la plantilla Word");
  }

  const content = await res.arrayBuffer();
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
  return `${nombreBase}.pdf`;
}

// ─────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────
selectCarrera.addEventListener("change", async () => {
  const val = selectCarrera.value.trim();
  capHint.textContent = "";

  if (!val) {
    limpiarSelectCapacitacion("Primero seleccione su carrera", true);
    return;
  }

  const filtro = val === "__todas__" ? null : val;
  await cargarTodasLasCapacitaciones(filtro);
});

selectCapacitacion.addEventListener("change", () => {
  actualizarHint(selectCapacitacion.value);
});

// ─────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!formularioActivo) {
    alert("El formulario de patrocinio está cerrado.");
    window.location.href = "../../index.html";
    return;
  }

  // NUEVO: no se puede enviar sin validar la cédula primero
  if (!cedulaValidada) {
    setEstado("Debe ingresar y validar su número de cédula antes de continuar", "err");
    return;
  }

  setEstado("Procesando...", "");
  btnReDescargar.classList.add("oculto");
  ultimoDocumento = null;

  const nombres      = nombresInput.value.trim();
  const cedula       = cedulaInput.value.trim();
  const capacitacion = selectCapacitacion.value.trim();

  if (!nombres || !cedula || !capacitacion) {
    setEstado("Completa todos los campos", "err");
    return;
  }

  window.mostrarAnimacionGenerando?.();

  try {
    const resultado = await obtenerDatosCapacitacion(capacitacion);

    if (!resultado) {
      window.ocultarAnimacionGenerando?.(false);
      setEstado("No se encontró la capacitación seleccionada", "err");
      return;
    }

    const { capData, carreraNombre } = resultado;

    const fecha = formatearFechaTexto(capData.fechaInicio);

    if (!fecha) {
      window.ocultarAnimacionGenerando?.(false);
      setEstado("La capacitación no tiene una fecha de inicio válida", "err");
      return;
    }

    // Red de seguridad: por si hubo una condición de carrera y ya se generó mientras tanto
    const yaExiste = await obtenerPatrocinioExistente(cedula, capacitacion);

    if (yaExiste) {
      window.ocultarAnimacionGenerando?.(false);

      const dataDoc = {
        NombresC: yaExiste.docente,
        Carrera1: yaExiste.carrera,
        Cedula1:  yaExiste.cedula,
        NombreCA: yaExiste.capacitacion,
        Codigo:   yaExiste.codigo,
        Fecha1:   fecha
      };

      ultimoDocumento = dataDoc;

      mostrarModalExiste(yaExiste, dataDoc);
      setEstado("Ya generaste este documento para esa capacitación", "");
      btnReDescargar.classList.remove("oculto");
      return;
    }

    const codigo = await generarCodigoSecuencial(capData.fechaInicio);

    await guardarPatrocinioGenerado({
      docente: nombres,
      cedula,
      carrera: carreraNombre,
      capacitacion,
      codigo
    });

    const dataDoc = {
      NombresC: nombres,
      Carrera1: carreraNombre,
      Cedula1:  cedula,
      NombreCA: capacitacion,
      Codigo:   codigo,
      Fecha1:   fecha
    };

    ultimoDocumento = dataDoc;

    const nombreArchivo = await generarDoc(dataDoc);

    window.ocultarAnimacionGenerando?.(true);
    setEstado("Documento generado correctamente ✔", "ok");

    mostrarModalAviso(nombres, capacitacion, nombreArchivo);

    // NUEVO: marcamos localmente esta capacitación como completada y refrescamos el select
    capacitacionesCompletadas[limpiarClave(capacitacion)] = dataDoc;

    form.reset();
    cedulaInput.value = cedula; // mantenemos la cédula visible tras el reset
    resetearEstadoPorCedula();
    clearBadge();

    await cargarCarreras();

  } catch (error) {
    window.ocultarAnimacionGenerando?.(false);
    console.error("Error:", error);
    setEstado(error.message || "Ocurrió un error al generar el documento", "err");
  }
});

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
escucharEstadoFormulario();
cargarCarreras();
deshabilitarFormulario(); // NUEVO: todo bloqueado hasta que se valide la cédula