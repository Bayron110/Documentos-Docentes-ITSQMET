import { db } from "../../firebase/firebase.js";
import {
    ref,
    get,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ─────────────────────────────────────────────
// PANTALLAS
// ─────────────────────────────────────────────
const pantallaPrevia = document.getElementById("pantallaPrevia");
const pantallaNoFormacion = document.getElementById("pantallaNoFormacion");
const pantallaConfirmacion = document.getElementById("pantallaConfirmacion");
const pantallaFormulario = document.getElementById("pantallaFormulario");
const pantallaYaRegistradoNoF = document.getElementById("pantallaYaRegistradoNoF");
const pantallaBloqueado = document.getElementById("pantallaBloqueado");

const btnSiFormacion = document.getElementById("btnSiFormacion");
const btnNoFormacion = document.getElementById("btnNoFormacion");
const btnVolverPregunta = document.getElementById("btnVolverPregunta");
const btnIrInicio = document.getElementById("btnIrInicio");
const btnIrInicioYaReg = document.getElementById("btnIrInicioYaReg");
const btnVolverDesdeYaReg = document.getElementById("btnVolverDesdeYaReg");
const btnIrInicioBloqueado = document.getElementById("btnIrInicioBloqueado");

// Datos en pantalla "ya registrado sin formación"
const yaRegNombre = document.getElementById("yaReg_nombre");
const yaRegCedula = document.getElementById("yaReg_cedula");
const yaRegCarrera = document.getElementById("yaReg_carrera");
const yaRegFecha = document.getElementById("yaReg_fecha");
const yaRegObservacion = document.getElementById("yaReg_observacion");

// Mini formulario (No formación)
const formNoFormacion = document.getElementById("formNoFormacion");
const nfNombres = document.getElementById("nf_nombres");
const nfCedula = document.getElementById("nf_cedula");
const nfCarrera = document.getElementById("nf_carrera");
const nfTitulo = document.getElementById("nf_titulo");
const nfObservaciones = document.getElementById("nf_observaciones");
const btnGuardarNoFormacion = document.getElementById("btnGuardarNoFormacion");
const mensajeNoFormacion = document.getElementById("mensajeNoFormacion");

// Formulario principal
const form = document.getElementById("formSeguimiento");
const cargando = document.getElementById("cargando");
const mensaje = document.getElementById("mensaje");
const codigoPreviewEl = document.getElementById("codigoPreview");
const btnGenerar = document.getElementById("btnGenerar");
const btnReDescargar = document.getElementById("btnReDescargar");

const nombresInput = document.getElementById("nombres");
const cedulaInput = document.getElementById("cedula");
const cedulaStatus = document.getElementById("cedulaStatus");
const cedulaStatusText = document.getElementById("cedulaStatusText");

const nfCedulaStatus = document.getElementById("nfCedulaStatus");
const nfCedulaStatusText = document.getElementById("nfCedulaStatusText");

let timerCedula = null;
let timerCedulaNF = null;

// ── Sección 1: identificación del seguimiento
const periodoSelect = document.getElementById("periodo");          // primero | segundo
const fechaActualInput = document.getElementById("fechaActual");   // fecha de seguimiento

// ── Sección 2: datos vinculados
const carreraInput = document.getElementById("carrera");
const programaInput = document.getElementById("programa");
const institucionInput = document.getElementById("institucion");

// ── Sección 3: estado
const estadoSelect = document.getElementById("estadoFormacion");   // en_curso | suspendida | retirada | culminada

// ── Sección 4: avance
const avanceInput = document.getElementById("avance");
const restanteInput = document.getElementById("restante");

// ── Sección 5 y 6: semestre
const situacionSelect = document.getElementById("situacion");      // regular | pendientes | suspension | retiro | culmino
const resultadoSelect = document.getElementById("resultado");      // aprobo | pendientes | sin_notas | no_aplica | culminada

// ── Evidencias
const matriculaSelect = document.getElementById("matricula");      // presentada | no_aplica
const notasSelect = document.getElementById("notas");              // presentada | no_aplica
const culminacionSelect = document.getElementById("culminacion");  // presentada | no_aplica

// ── Sección 7: novedades
const novedadSelect = document.getElementById("novedad");          // ninguna | institucion | programa | suspension | retiro | culminacion

// ── Anexos (2 imágenes)
const imagenMatriculaInput = document.getElementById("imagenMatricula");
const imagenNotasInput = document.getElementById("imagenNotas");
const previewMatricula = document.getElementById("previewMatricula");
const previewNotas = document.getElementById("previewNotas");

// Modal documento existente
const modalEl = document.getElementById("modalDocumentoExistente");
const cerrarModalX = document.getElementById("cerrarModalX");
const btnCerrarModal = document.getElementById("btnCerrarModal");
const btnModalReDescargar = document.getElementById("btnModalReDescargar");
const modalCodigo = document.getElementById("modalCodigo");
const modalDocente = document.getElementById("modalDocente");
const modalCedula = document.getElementById("modalCedula");
const modalCarrera = document.getElementById("modalCarrera");
const modalFecha = document.getElementById("modalFecha");

// Modal éxito
const modalExitoEl = document.getElementById("modalExitoDescarga");
const modalExitoCodigo = document.getElementById("exitoCodigo");
const modalExitoNombre = document.getElementById("exitoNombre");
const modalExitoFecha = document.getElementById("exitoFecha");
const btnCerrarExito = document.getElementById("btnCerrarExito");
const btnIrInicioExito = document.getElementById("btnIrInicioExito");
const btnReDescargarExito = document.getElementById("btnReDescargarExito");

const storage = getStorage();
const API_BASE = "https://backen-pdf-trabajo.onrender.com";

const RETRY_CONFIG = {
    maxIntentos: 3,
    delayBase: 4000,
    delayMax: 15000,
    multiplicador: 2
};

let codigoUnidad = "UGPA-RGI2-01-PRO-251";
let anio = new Date().getFullYear().toString();
let mes = String(new Date().getMonth() + 1).padStart(2, "0");

let archivoMatricula = null;
let archivoNotas = null;
let ultimoDocumento = null; // { data, imagenes: { imagen1: {bytes, esPlaceholder}, imagen2: {...} } }

let formularioActivo = true;
let yaMostroCierre = false;

window.volver = () => { window.location.href = "../../index.html"; };

// ─────────────────────────────────────────────
// CASILLAS DEL WORD
// ─────────────────────────────────────────────
// Para cambiar el símbolo (por ejemplo solo "X") se modifica aquí.
const CASILLA_MARCADA = "☒";
const CASILLA_VACIA = "☐";
const marca = (cond) => (cond ? CASILLA_MARCADA : CASILLA_VACIA);

// placeholder del Word → valor del select que lo activa
const OPCIONES = {
    periodo: {
        perPrimero: "primero",
        perSegundo: "segundo"
    },
    estado: {
        estEnCurso: "en_curso",
        estSuspendida: "suspendida",
        estRetirada: "retirada",
        estCulminada: "culminada"
    },
    situacion: {
        sitRegular: "regular",
        sitPendientes: "pendientes",
        sitSuspension: "suspension",
        sitRetiro: "retiro",
        sitCulmino: "culmino"
    },
    resultado: {
        resAprobo: "aprobo",
        resPendientes: "pendientes",
        resSinNotas: "sin_notas",
        resNoAplica: "no_aplica",
        resCulminada: "culminada"
    },
    novedad: {
        novNinguna: "ninguna",
        novInstitucion: "institucion",
        novPrograma: "programa",
        novSuspension: "suspension",
        novRetiro: "retiro",
        novCulminacion: "culminacion"
    }
};

// Sección 9 (Continuidad del patrocinio): se calcula con el estado (sección 3)
// y la novedad (sección 7). Solo se marca UNA casilla.
const CASILLAS_CONTINUIDAD = [
    "contContinua",
    "contSuspendido",
    "contActualizacion",
    "contCierreRetiro",
    "contCierreCulminacion"
];

function calcularContinuidad(v) {
    const estado = v?.estado || "";
    const novedad = v?.novedad || "";

    // Prioridad: los cierres y la suspensión mandan sobre cualquier otra cosa
    if (estado === "retirada") return "contCierreRetiro";
    if (estado === "culminada") return "contCierreCulminacion";
    if (estado === "suspendida") return "contSuspendido";

    // Formación en curso, pero con cambio de institución o programa
    if (novedad === "institucion" || novedad === "programa") return "contActualizacion";

    if (estado === "en_curso") return "contContinua";

    // Sin estado válido no se marca ninguna
    return null;
}

function marcarContinuidad(v) {
    const seleccionada = calcularContinuidad(v);
    return Object.fromEntries(
        CASILLAS_CONTINUIDAD.map(tag => [tag, marca(tag === seleccionada)])
    );
}

function marcarGrupo(mapa, valorSeleccionado) {
    const salida = {};
    for (const [tag, valor] of Object.entries(mapa)) {
        salida[tag] = marca(valor === valorSeleccionado);
    }
    return salida;
}

// ─────────────────────────────────────────────
// TODAS LAS PANTALLAS
// ─────────────────────────────────────────────
function todasLasPantallas() {
    return [
        pantallaPrevia,
        pantallaNoFormacion,
        pantallaConfirmacion,
        pantallaFormulario,
        pantallaYaRegistradoNoF,
        pantallaBloqueado
    ].filter(Boolean);
}

function mostrarSolo(pantallaVisible) {
    todasLasPantallas().forEach(p => p.classList.add("oculto"));
    pantallaVisible.classList.remove("oculto");
    pantallaVisible.classList.remove("pantalla-entrada");
    void pantallaVisible.offsetWidth;
    pantallaVisible.classList.add("pantalla-entrada");
}

// ─────────────────────────────────────────────
// PANTALLA BLOQUEADO
// ─────────────────────────────────────────────
function mostrarPantallaBloqueado({ tipo, nombre, cedula, carrera, fecha }) {
    // tipo: "seguimiento_existe" | "sinformacion_existe"
    const tituloEl = document.getElementById("bloq_titulo");
    const descripcionEl = document.getElementById("bloq_descripcion");
    const nombreEl = document.getElementById("bloq_nombre");
    const cedulaEl = document.getElementById("bloq_cedula");
    const carreraEl = document.getElementById("bloq_carrera");
    const fechaEl = document.getElementById("bloq_fecha");
    const badgeEl = document.getElementById("bloq_badge");

    if (tipo === "seguimiento_existe") {
        if (tituloEl) tituloEl.textContent = "Ya tiene un seguimiento registrado este mes";
        if (descripcionEl) descripcionEl.textContent = "Usted ya completó el formulario de seguimiento docente en el presente mes. No es posible registrar nuevamente que no está en proceso de formación mientras exista un seguimiento activo.";
        if (badgeEl) badgeEl.textContent = "Seguimiento registrado";
        if (badgeEl) badgeEl.className = "bloq-badge bloq-badge--azul";
    } else {
        if (tituloEl) tituloEl.textContent = "Ya registró que no está en formación este mes";
        if (descripcionEl) descripcionEl.textContent = "Usted ya indicó que no se encuentra en proceso de formación durante el presente mes. No es posible registrar un seguimiento mientras exista ese registro. Comuníquese con el administrador si esto es un error.";
        if (badgeEl) badgeEl.textContent = "Sin formación registrado";
        if (badgeEl) badgeEl.className = "bloq-badge bloq-badge--naranja";
    }

    if (nombreEl) nombreEl.textContent = nombre || "---";
    if (cedulaEl) cedulaEl.textContent = cedula || "---";
    if (carreraEl) carreraEl.textContent = carrera || "---";
    if (fechaEl) fechaEl.textContent = fecha || "---";

    mostrarSolo(pantallaBloqueado);
}

// ─────────────────────────────────────────────
// MODAL ÉXITO
// ─────────────────────────────────────────────
function abrirModalExito(codigo, nombre) {
    if (!modalExitoEl) return;
    const ahora = new Date();
    const fechaHora = ahora.toLocaleDateString("es-EC") + " · " +
        ahora.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

    if (modalExitoCodigo) modalExitoCodigo.textContent = codigo || "---";
    if (modalExitoNombre) modalExitoNombre.textContent = nombre || "---";
    if (modalExitoFecha) modalExitoFecha.textContent = fechaHora;

    modalExitoEl.classList.remove("oculto");
    document.body.style.overflow = "hidden";
}

function cerrarModalExito() {
    if (!modalExitoEl) return;
    modalExitoEl.classList.add("oculto");
    document.body.style.overflow = "";
}

if (btnCerrarExito) btnCerrarExito.addEventListener("click", cerrarModalExito);
if (btnIrInicioExito) btnIrInicioExito.addEventListener("click", () => { cerrarModalExito(); window.location.href = "../../index.html"; });
if (btnReDescargarExito) btnReDescargarExito.addEventListener("click", async () => { cerrarModalExito(); await reDescargar(); });
if (modalExitoEl) modalExitoEl.addEventListener("click", (e) => { if (e.target === modalExitoEl) cerrarModalExito(); });

// ─────────────────────────────────────────────
// BUSCAR REGISTRO SIN FORMACIÓN (mes actual)
// ─────────────────────────────────────────────
async function buscarRegistroSinFormacion(cedula) {
    const cedulaLimpia = String(cedula || "").trim();
    if (!cedulaLimpia) return null;
    const key = `${cedulaLimpia}_${anio}_${mes}`;
    const snap = await get(ref(db, `docentesSinFormacion/${key}`));
    if (!snap.exists()) return null;
    return snap.val();
}

// ─────────────────────────────────────────────
// BUSCAR SEGUIMIENTO EXISTENTE (mes actual)
// ─────────────────────────────────────────────
async function buscarSeguimientoExistentePorCedula(cedula) {
    const cedulaLimpia = String(cedula || "").trim();
    if (!cedulaLimpia) return null;

    const snap = await get(ref(db, "seguimientoGenerados"));
    if (!snap.exists()) return null;

    let encontrado = null;
    snap.forEach((child) => {
        if (encontrado) return;
        const data = child.val();
        const codigo = String(data?.codigo || "").trim();
        const ced = String(data?.cedula || "").trim();
        if (!codigo || !ced) return;
        const partes = codigo.split("-");
        if (partes.length < 7) return;
        const anioG = String(partes[5] || "");
        const mesG = String(partes[6] || "").padStart(2, "0");
        if (ced === cedulaLimpia && anioG === anio && mesG === mes) {
            encontrado = { id: child.key, ...data };
        }
    });

    return encontrado;
}

// ─────────────────────────────────────────────────────────────────────────
// VERIFICACIÓN CRUZADA FUERTE — retorna objeto con el conflicto si existe
// ─────────────────────────────────────────────────────────────────────────
async function verificarConflictos(cedula) {
    const cedulaLimpia = String(cedula || "").trim();
    if (!cedulaLimpia) return null;

    const [registroNoF, registroSeg] = await Promise.all([
        buscarRegistroSinFormacion(cedulaLimpia),
        buscarSeguimientoExistentePorCedula(cedulaLimpia)
    ]);

    if (registroNoF) {
        return {
            tipo: "sinformacion_existe",
            nombre: registroNoF.nombre || "",
            cedula: registroNoF.cedula || cedulaLimpia,
            carrera: registroNoF.carrera || "",
            fecha: registroNoF.fecha || ""
        };
    }

    if (registroSeg) {
        return {
            tipo: "seguimiento_existe",
            nombre: registroSeg.nombre || "",
            cedula: registroSeg.cedula || cedulaLimpia,
            carrera: registroSeg.carrera || "",
            fecha: registroSeg.fecha || ""
        };
    }

    return null;
}

// ─────────────────────────────────────────────
// PANTALLA YA REGISTRADO SIN FORMACIÓN
// ─────────────────────────────────────────────
function mostrarPantallaYaRegistradoNoF(registro) {
    if (yaRegNombre) yaRegNombre.textContent = registro?.nombre || "---";
    if (yaRegCedula) yaRegCedula.textContent = registro?.cedula || "---";
    if (yaRegCarrera) yaRegCarrera.textContent = registro?.carrera || "---";
    if (yaRegFecha) yaRegFecha.textContent = registro?.fecha || "---";
    if (yaRegObservacion) yaRegObservacion.textContent = registro?.observacion || "Sin observaciones";
    mostrarSolo(pantallaYaRegistradoNoF);
}

// ─────────────────────────────────────────────
// NAVEGACIÓN ENTRE PANTALLAS
// ─────────────────────────────────────────────
btnSiFormacion.addEventListener("click", () => {
    mostrarSolo(pantallaFormulario);
});

btnNoFormacion.addEventListener("click", () => {
    mostrarSolo(pantallaNoFormacion);
});

btnVolverPregunta.addEventListener("click", () => {
    mostrarSolo(pantallaPrevia);
    formNoFormacion.reset();
    mostrarMensajeNF("");
});

btnIrInicio.addEventListener("click", () => {
    window.location.href = "../../index.html";
});

if (btnIrInicioYaReg) {
    btnIrInicioYaReg.addEventListener("click", () => {
        window.location.href = "../../index.html";
    });
}
if (btnVolverDesdeYaReg) {
    btnVolverDesdeYaReg.addEventListener("click", () => {
        mostrarSolo(pantallaPrevia);
    });
}
if (btnIrInicioBloqueado) {
    btnIrInicioBloqueado.addEventListener("click", () => {
        window.location.href = "../../index.html";
    });
}

// ─────────────────────────────────────────────
// MINI FORMULARIO — NO FORMACIÓN
// ─────────────────────────────────────────────
function mostrarMensajeNF(texto, esError = false) {
    mensajeNoFormacion.textContent = texto;
    mensajeNoFormacion.style.color = esError
        ? "var(--clr-estado-err)"
        : "var(--clr-estado-ok)";
}

function mostrarEstadoCedula(statusEl, textEl, tipo, texto) {
    if (!statusEl || !textEl) return;

    statusEl.classList.remove("oculto", "ok", "error");
    textEl.textContent = texto;

    if (tipo === "ok") statusEl.classList.add("ok");
    if (tipo === "error") statusEl.classList.add("error");
}

// Verificación al salir del campo cédula en el mini formulario
async function verificarCedulaNoFormacion() {
    const cedula = nfCedula.value.trim();
    if (!cedula) return;

    mostrarMensajeNF("Verificando...");
    btnGuardarNoFormacion.disabled = true;

    try {
        const conflicto = await verificarConflictos(cedula);

        if (conflicto) {
            mostrarPantallaBloqueado(conflicto);
            formNoFormacion.reset();
            mostrarMensajeNF("");
            return;
        }

        mostrarMensajeNF("");
        btnGuardarNoFormacion.disabled = false;
    } catch (error) {
        console.error("Error verificando cédula:", error);
        mostrarMensajeNF("");
        btnGuardarNoFormacion.disabled = false;
    }
}

nfCedula.addEventListener("input", () => {
    // Solo números, máximo 10 dígitos
    nfCedula.value = nfCedula.value.replace(/\D/g, "").slice(0, 10);

    clearTimeout(timerCedulaNF);

    const cedula = nfCedula.value.trim();

    if (cedula.length < 10) {
        nfCedulaStatus.classList.add("oculto");
        return;
    }

    timerCedulaNF = setTimeout(async () => {
        mostrarEstadoCedula(nfCedulaStatus, nfCedulaStatusText, "loading", "Verificando cédula...");

        try {
            await verificarCedulaNoFormacion();
            mostrarEstadoCedula(nfCedulaStatus, nfCedulaStatusText, "ok", "Cédula verificada");
        } catch (error) {
            mostrarEstadoCedula(nfCedulaStatus, nfCedulaStatusText, "error", "No se pudo verificar");
        }
    }, 600);
});

// Submit del mini formulario
formNoFormacion.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = nfNombres.value.trim();
    const cedula = nfCedula.value.trim();
    const carrera = nfCarrera.value.trim();
    const titulo = nfTitulo.value.trim();
    const observacion = nfObservaciones.value.trim();

    if (!nombre || !cedula || !carrera || !titulo) {
        mostrarMensajeNF("❌ Complete todos los campos requeridos", true);
        return;
    }

    btnGuardarNoFormacion.disabled = true;
    mostrarMensajeNF("Verificando...");

    try {
        const conflicto = await verificarConflictos(cedula);

        if (conflicto) {
            mostrarPantallaBloqueado(conflicto);
            formNoFormacion.reset();
            mostrarMensajeNF("");
            return;
        }

        mostrarMensajeNF("Guardando...");

        const ahora = new Date();
        const fechaHoy = ahora.toLocaleDateString("es-EC");
        const horaActual = ahora.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
        const key = `${cedula}_${anio}_${mes}`;

        await set(ref(db, `docentesSinFormacion/${key}`), {
            nombre,
            cedula,
            carrera,
            titulo,
            observacion: observacion || "Sin observaciones",
            fecha: fechaHoy,
            hora: horaActual,
            anio,
            mes,
            enProcesoFormacion: false,
            registradoEn: new Date().toISOString()
        });

        mostrarSolo(pantallaConfirmacion);
    } catch (error) {
        console.error("Error guardando registro sin formación:", error);
        mostrarMensajeNF("❌ Error al guardar. Intente nuevamente.", true);
    } finally {
        btnGuardarNoFormacion.disabled = false;
    }
});

// ─────────────────────────────────────────────
// FORMULARIO CERRADO POR ADMIN
// ─────────────────────────────────────────────
function mostrarMensajeFormularioCerrado() {
    if (yaMostroCierre) return;
    yaMostroCierre = true;

    try { window.ocultarAnimacionGenerando?.(false); } catch { }
    try { cerrarModal(); } catch { }

    document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f7fb;font-family:Arial,sans-serif;padding:20px;text-align:center;">
            <div style="max-width:480px;background:white;padding:32px;border-radius:18px;box-shadow:0 12px 35px rgba(0,0,0,.12);">
                <div style="width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:#fee2e2;color:#b91c1c;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:bold;">!</div>
                <h2 style="margin-bottom:12px;color:#1e3a5f;">Formulario cerrado</h2>
                <p style="font-size:16px;color:#475569;line-height:1.6;">El administrador cerró este formulario.<br><br>Por favor comuníquese con el administrador para que lo vuelva a habilitar.</p>
                <p style="margin-top:18px;font-size:14px;color:#64748b;">Será redirigido al panel principal...</p>
            </div>
        </div>
    `;
    setTimeout(() => { window.location.href = "../../index.html"; }, 3500);
}

function escucharEstadoFormulario() {
    const formularioRef = ref(db, "Activador/seguimientoDocente");
    onValue(formularioRef, (snapshot) => {
        const activo = snapshot.val();
        formularioActivo = activo !== false;
        if (activo === false) mostrarMensajeFormularioCerrado();
    }, (error) => {
        console.error("Error escuchando estado del formulario:", error);
    });
}

// ─────────────────────────────────────────────
// MODAL DOCUMENTO EXISTENTE
// ─────────────────────────────────────────────
function abrirModal(registro) {
    modalCodigo.textContent = registro?.codigo || "---";
    modalDocente.textContent = registro?.nombre || "---";
    modalCedula.textContent = registro?.cedula || "---";
    modalCarrera.textContent = registro?.carrera || "---";
    modalFecha.textContent = registro?.fecha || "---";
    modalEl.classList.remove("oculto");
    document.body.style.overflow = "hidden";
}

function cerrarModal() {
    modalEl.classList.add("oculto");
    document.body.style.overflow = "";
}

cerrarModalX.addEventListener("click", cerrarModal);
btnCerrarModal.addEventListener("click", cerrarModal);
modalEl.addEventListener("click", (e) => { if (e.target === modalEl) cerrarModal(); });
btnModalReDescargar.addEventListener("click", async () => { cerrarModal(); await reDescargar(); });

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
function mostrarMensaje(texto) {
    mensaje.textContent = texto;
    setTimeout(() => { mensaje.textContent = ""; }, 6000);
}

function hoyInput() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return "";
    const texto = String(fechaISO);
    if (texto.includes("/")) return texto; // ya viene formateada
    const [a, m, d] = texto.split("-");
    return `${d}/${m}/${a}`;
}

function limpiarClave(texto) {
    return String(texto || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function limpiarNombreArchivo(texto) {
    return String(texto || "")
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, " ").trim();
}

function normalizarBaseCodigo(base) {
    const limpia = String(base || "").trim();
    if (!limpia) return "UGPA-RGI2-01-PRO-251";
    const partes = limpia.split("-").filter(Boolean);
    if (partes.length >= 5) {
        partes[2] = "01";
        return partes.slice(0, 5).join("-");
    }
    return "UGPA-RGI2-01-PRO-251";
}

function actualizarCodigoPreview() {
    if (codigoPreviewEl) {
        codigoPreviewEl.textContent = `${normalizarBaseCodigo(codigoUnidad)}-${anio}-${mes}`;
    }
}

function calcularRestante() {
    let avance = Number(avanceInput.value || 0);
    if (avance < 0) avance = 0;
    if (avance > 100) avance = 100;
    avanceInput.value = avanceInput.value === "" ? "" : avance;
    restanteInput.value = 100 - avance;
}

// Las imágenes solo son obligatorias si la evidencia se marcó como "presentada"
function matriculaRequiereImagen() { return matriculaSelect.value === "presentada"; }
function notasRequiereImagen() { return notasSelect.value === "presentada"; }

function formularioValido() {
    const camposBase = !!(
        nombresInput.value.trim() &&
        cedulaInput.value.trim() &&
        carreraInput.value.trim() &&
        programaInput.value.trim() &&
        institucionInput.value.trim() &&
        periodoSelect.value &&
        fechaActualInput.value &&
        estadoSelect.value &&
        avanceInput.value !== "" &&
        restanteInput.value !== "" &&
        situacionSelect.value &&
        resultadoSelect.value &&
        matriculaSelect.value &&
        notasSelect.value &&
        culminacionSelect.value &&
        novedadSelect.value
    );
    if (!camposBase) return false;

    if (matriculaRequiereImagen() && !archivoMatricula) return false;
    if (notasRequiereImagen() && !archivoNotas) return false;

    return true;
}

function obtenerImageModuleClass() {
    const candidatos = [
        window.DocxtemplaterImageModuleFree,
        window.ImageModule,
        window.docxtemplaterImageModuleFree,
        window["docxtemplater-image-module-free"]
    ];
    for (const c of candidatos) {
        if (typeof c === "function") return c;
    }
    return null;
}

function asegurarLibrerias() {
    if (typeof window.PizZip === "undefined") throw new Error("PizZip no está cargado");
    if (typeof window.docxtemplater === "undefined") throw new Error("docxtemplater no está cargado");
    if (typeof window.saveAs === "undefined") throw new Error("FileSaver no está cargado");
    const ImageModuleClass = obtenerImageModuleClass();
    if (!ImageModuleClass) throw new Error("La librería de imágenes no está cargada");
    return ImageModuleClass;
}

// ─────────────────────────────────────────────
// IMÁGENES
// ─────────────────────────────────────────────
function fileToUint8Array(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.readAsArrayBuffer(file);
    });
}

async function urlToUint8Array(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("No se pudo descargar la imagen");
        return new Uint8Array(await response.arrayBuffer());
    } catch {
        return imagenPlaceholder1x1();
    }
}

function imagenPlaceholder1x1() {
    return new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
}

async function prepararImagen(archivo) {
    if (!archivo) return { bytes: imagenPlaceholder1x1(), esPlaceholder: true };
    try {
        const bytes = await fileToUint8Array(archivo);
        if (!(bytes instanceof Uint8Array) || bytes.length === 0)
            return { bytes: imagenPlaceholder1x1(), esPlaceholder: true };
        return { bytes, esPlaceholder: false };
    } catch {
        return { bytes: imagenPlaceholder1x1(), esPlaceholder: true };
    }
}

function renderPreviewImagen(archivo, contenedor) {
    if (!contenedor) return;
    contenedor.innerHTML = "";
    if (!archivo) return;
    const reader = new FileReader();
    reader.onload = () => {
        const item = document.createElement("div");
        item.className = "img-item";
        item.innerHTML = `<img src="${reader.result}" alt="Anexo">`;
        contenedor.appendChild(item);
    };
    reader.readAsDataURL(archivo);
}

async function subirImagenYObtenerURL(file, cedula, codigo, sufijo) {
    if (!file) return null;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const ruta = `seguimientos/${cedula}_${limpiarClave(codigo)}_${sufijo}.${ext}`;
    const ref_ = storageRef(storage, ruta);
    await uploadBytes(ref_, file, { contentType: file.type || "image/jpeg" });
    return await getDownloadURL(ref_);
}

// ─────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────
function cargarConfiguracion() {
    cargando.classList.remove("oculto");
    const refConfig = ref(db, "config-seguimiento/1");

    onValue(refConfig, (snap) => {
        try {
            if (snap.exists()) {
                const data = snap.val();
                const codigoGuardado = String(data.codigo || "").trim();
                if (codigoGuardado) {
                    const partes = codigoGuardado.split("-");
                    if (partes.length >= 7) {
                        codigoUnidad = partes.slice(0, 5).join("-");
                        anio = partes[5] || anio;
                        mes = String(partes[6] || mes).padStart(2, "0");
                    }
                }
            }
            actualizarCodigoPreview();
        } catch (error) {
            console.error("Error procesando config-seguimiento:", error);
            mostrarMensaje("❌ Error al cargar la configuración");
        } finally {
            cargando.classList.add("oculto");
        }
    }, (error) => {
        console.error("Error escuchando config-seguimiento:", error);
        mostrarMensaje("❌ Error al escuchar la configuración");
        cargando.classList.add("oculto");
    });
}

// ─────────────────────────────────────────────
// CÓDIGO SECUENCIAL
// ─────────────────────────────────────────────
async function generarCodigoSecuencial() {
    const base = normalizarBaseCodigo(codigoUnidad);
    const snap = await get(ref(db, "seguimientoGenerados"));
    let maxSecuencia = 0;

    if (snap.exists()) {
        snap.forEach((child) => {
            const data = child.val();
            const codigo = String(data?.codigo || "").trim();
            const partes = codigo.split("-");
            if (partes.length >= 7) {
                const sec = Number(partes[2]);
                const anioG = partes[5];
                const mesG = partes[6];
                if (anioG === anio && mesG === mes && !isNaN(sec)) {
                    if (sec > maxSecuencia) maxSecuencia = sec;
                }
            }
        });
    }

    const siguiente = String(maxSecuencia + 1).padStart(2, "0");
    const partesBase = base.split("-");
    partesBase[2] = siguiente;
    return `${partesBase.join("-")}-${anio}-${mes}`;
}

// ─────────────────────────────────────────────
// VALORES CRUDOS  →  DATA DEL WORD
// ─────────────────────────────────────────────
// "valores" es el objeto que se guarda en Firebase y desde el cual se
// puede reconstruir el documento cuantas veces se necesite.
function leerValoresFormulario() {
    return {
        nombre: nombresInput.value.trim(),
        cedula: cedulaInput.value.trim(),
        carrera: carreraInput.value.trim(),
        programa: programaInput.value.trim(),
        institucion: institucionInput.value.trim(),

        periodo: periodoSelect.value,
        fechaRealizacion: fechaActualInput.value, // ISO yyyy-mm-dd
        anio: new Date().getFullYear().toString(),

        estado: estadoSelect.value,
        avance: String(avanceInput.value),
        restante: String(restanteInput.value),

        situacion: situacionSelect.value,
        resultado: resultadoSelect.value,

        matricula: matriculaSelect.value,
        notas: notasSelect.value,
        culminacion: culminacionSelect.value,

        novedad: novedadSelect.value
    };
}

function construirDataDoc(codigo, v) {
    return {
        Codigo: codigo,
        NombresC: v.nombre || "",
        cedula: v.cedula || "",
        carrera: v.carrera || "",
        programa: v.programa || "",
        institucion: v.institucion || "",

        AnioActual: v.anio || new Date().getFullYear().toString(),
        fechaRealizacion: formatearFecha(v.fechaRealizacion || ""),

        // La plantilla ya trae el símbolo "%" → se envía solo el número
        PorcentajeAvance1: v.avance ?? "",
        PorcentajeRestante: v.restante ?? "",

        // Casillas por grupo
        ...marcarGrupo(OPCIONES.periodo, v.periodo),
        ...marcarGrupo(OPCIONES.estado, v.estado),
        ...marcarGrupo(OPCIONES.situacion, v.situacion),
        ...marcarGrupo(OPCIONES.resultado, v.resultado),
        ...marcarGrupo(OPCIONES.novedad, v.novedad),

        // Evidencias: Presentada / No aplica
        matriculaPresentada: marca(v.matricula === "presentada"),
        matriculaNoAplica: marca(v.matricula === "no_aplica"),
        notasPresentada: marca(v.notas === "presentada"),
        notasNoAplica: marca(v.notas === "no_aplica"),
        culminacionPresentada: marca(v.culminacion === "presentada"),
        culminacionNoAplica: marca(v.culminacion === "no_aplica"),

        // Sección 9: continuidad del patrocinio (según estado y novedad)
        ...marcarContinuidad(v),

        // Claves de imagen: {%imagen1} y {%imagen2} en el Word
        imagen1: "imagen1",
        imagen2: "imagen2"
    };
}

// ─────────────────────────────────────────────
// RECONSTRUIR DOCUMENTO DESDE REGISTRO GUARDADO
// ─────────────────────────────────────────────
async function construirDocumentoDesdeRegistro(registro) {
    const d = registro?.datosDocumento || {};

    const valores = {
        nombre: registro?.nombre || d.nombre || "",
        cedula: registro?.cedula || d.cedula || "",
        carrera: registro?.carrera || d.carrera || "",
        programa: d.programa || registro?.CarreraCursando || "",
        institucion: d.institucion || d.instituacion || "",

        periodo: d.periodo || "",
        fechaRealizacion: d.fechaRealizacion || "",
        anio: d.anio || d.añoActual || new Date().getFullYear().toString(),

        estado: d.estado || "",
        avance: String(d.avance ?? "").replace("%", ""),
        restante: String(d.restante ?? "").replace("%", ""),

        situacion: d.situacion || "",
        resultado: d.resultado || "",

        matricula: d.matricula || "",
        notas: d.notas || "",
        culminacion: d.culminacion || "",

        novedad: d.novedad || ""
    };

    const data = construirDataDoc(registro?.codigo || "", valores);

    const imagenMatricula = d.imagenMatriculaURL
        ? { bytes: await urlToUint8Array(d.imagenMatriculaURL), esPlaceholder: false }
        : { bytes: imagenPlaceholder1x1(), esPlaceholder: true };

    const imagenNotas = d.imagenNotasURL
        ? { bytes: await urlToUint8Array(d.imagenNotasURL), esPlaceholder: false }
        : { bytes: imagenPlaceholder1x1(), esPlaceholder: true };

    return {
        data,
        imagenes: { imagen1: imagenMatricula, imagen2: imagenNotas }
    };
}

// ─────────────────────────────────────────────
// FIREBASE — GUARDAR SEGUIMIENTO
// ─────────────────────────────────────────────
async function guardarRegistro(codigo, valores, urls) {
    const cedula = valores.cedula;
    const key = `${cedula}_${limpiarClave(codigo)}`;
    const ahora = new Date();

    await set(ref(db, `seguimientoGenerados/${key}`), {
        carrera: valores.carrera,
        cedula,
        nombre: valores.nombre,
        codigo,
        fecha: ahora.toLocaleDateString("es-EC"),
        datosDocumento: {
            ...valores,
            Codigo: codigo,
            imagenMatriculaURL: urls.matricula || null,
            imagenNotasURL: urls.notas || null
        }
    });
}

// ─────────────────────────────────────────────
// CONVERTIR DOCX → PDF (con reintentos)
// ─────────────────────────────────────────────
function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function convertirDocxAPdf(blobDocx, nombreBase) {
    const { maxIntentos, delayBase, delayMax, multiplicador } = RETRY_CONFIG;
    let ultimoError = null;

    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            if (intento > 1) window.actualizarMensajeReintento?.(intento, maxIntentos);

            const formData = new FormData();
            formData.append("file", blobDocx, `${nombreBase}.docx`);
            formData.append("tipo_documento", "seguimiento");

            const response = await fetch(`${API_BASE}/convertir-pdf`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                let msg = `Error del servidor (${response.status})`;
                try { const err = await response.json(); msg = err.detail || msg; } catch { }
                throw new Error(msg);
            }

            const blobPdf = await response.blob();
            if (!blobPdf || blobPdf.size === 0) throw new Error("El servidor devolvió un PDF vacío");

            window.saveAs(blobPdf, `${nombreBase}.pdf`);
            return;

        } catch (error) {
            ultimoError = error;
            console.warn(`Intento ${intento}/${maxIntentos} fallido:`, error.message);
            if (intento < maxIntentos) {
                const delay = Math.min(delayBase * Math.pow(multiplicador, intento - 1), delayMax);
                window.actualizarMensajeEsperando?.(intento, maxIntentos, Math.round(delay / 1000));
                await esperar(delay);
            }
        }
    }

    throw new Error(
        `No se pudo generar el PDF después de ${maxIntentos} intentos. ` +
        `Último error: ${ultimoError?.message || "Error desconocido"}. ` +
        `Use el botón Re-descargar para intentarlo nuevamente.`
    );
}

// ─────────────────────────────────────────────
// GENERAR DOCUMENTO WORD + PDF
// ─────────────────────────────────────────────
// documento = { data, imagenes: { imagen1: {bytes, esPlaceholder}, imagen2: {...} } }
async function generarDocumento(documento) {
    const ImageModuleClass = asegurarLibrerias();

    const response = await fetch("../../doc/seguimiento.docx");
    if (!response.ok) throw new Error("No se pudo cargar la plantilla seguimiento.docx");

    const content = await response.arrayBuffer();
    const zip = new window.PizZip(content);

    const { data, imagenes } = documento;

    const bytesPorTag = {};
    const tamanoPorTag = {};
    for (const tag of ["imagen1", "imagen2"]) {
        const img = imagenes?.[tag];
        const valida = img?.bytes instanceof Uint8Array && img.bytes.length > 0;
        const esPlaceholder = !valida || img.esPlaceholder === true;
        bytesPorTag[tag] = valida ? img.bytes : imagenPlaceholder1x1();
        tamanoPorTag[tag] = esPlaceholder ? [1, 1] : [420, 300];
    }

    const imageModule = new ImageModuleClass({
        centered: true,
        getImage(tagValue) {
            return bytesPorTag[tagValue] || imagenPlaceholder1x1();
        },
        getSize(img, tagValue) {
            return tamanoPorTag[tagValue] || [1, 1];
        }
    });

    const doc = new window.docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true,
        nullGetter() { return ""; }
    });

    try {
        doc.render(data);
    } catch (error) {
        throw new Error(error?.message || "Error al renderizar el documento Word");
    }

    const blobDocx = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
    const nombreBase = limpiarNombreArchivo(`${data.Codigo}-${data.NombresC}`);
    await convertirDocxAPdf(blobDocx, nombreBase);
}

// ─────────────────────────────────────────────
// RE-DESCARGAR
// ─────────────────────────────────────────────
async function reDescargar() {
    if (!formularioActivo) { mostrarMensajeFormularioCerrado(); return; }
    if (!ultimoDocumento) { mostrarMensaje("❌ No hay documento para re-descargar"); return; }

    try {
        window.mostrarAnimacionGenerando?.();

        // Si el usuario cargó imágenes nuevas en el formulario, se usan esas
        if (archivoMatricula) ultimoDocumento.imagenes.imagen1 = await prepararImagen(archivoMatricula);
        if (archivoNotas) ultimoDocumento.imagenes.imagen2 = await prepararImagen(archivoNotas);

        await generarDocumento(ultimoDocumento);
        window.ocultarAnimacionGenerando?.(true);
        abrirModalExito(ultimoDocumento.data.Codigo, ultimoDocumento.data.NombresC);

    } catch (error) {
        console.error("Error re-descargando seguimiento:", error);
        window.ocultarAnimacionGenerando?.(false);
        mostrarMensaje(error.message || "❌ Error al volver a descargar el PDF");
    }
}

// ─────────────────────────────────────────────
// VALIDAR CÉDULA EN FORMULARIO PRINCIPAL
// ─────────────────────────────────────────────
async function validarCedulaExistente() {
    if (!formularioActivo) { mostrarMensajeFormularioCerrado(); return; }

    const cedula = cedulaInput.value.trim();
    btnReDescargar.classList.add("oculto");
    if (!cedula) return;

    try {
        const registroNoF = await buscarRegistroSinFormacion(cedula);
        if (registroNoF) {
            mostrarPantallaBloqueado({
                tipo: "sinformacion_existe",
                nombre: registroNoF.nombre || "",
                cedula: registroNoF.cedula || cedula,
                carrera: registroNoF.carrera || "",
                fecha: registroNoF.fecha || ""
            });
            return;
        }

        const encontrado = await buscarSeguimientoExistentePorCedula(cedula);
        if (!encontrado) return;

        ultimoDocumento = await construirDocumentoDesdeRegistro(encontrado);
        btnReDescargar.classList.remove("oculto");
        abrirModal(encontrado);
    } catch (error) {
        console.error("Error validando cédula:", error);
    }
}

// ─────────────────────────────────────────────
// EVENTOS — FORMULARIO PRINCIPAL
// ─────────────────────────────────────────────
avanceInput.addEventListener("input", calcularRestante);

if (imagenMatriculaInput) {
    imagenMatriculaInput.addEventListener("change", (e) => {
        const archivos = Array.from(e.target.files || []);
        archivoMatricula = archivos.length ? archivos[0] : null;
        renderPreviewImagen(archivoMatricula, previewMatricula);
    });
}

if (imagenNotasInput) {
    imagenNotasInput.addEventListener("change", (e) => {
        const archivos = Array.from(e.target.files || []);
        archivoNotas = archivos.length ? archivos[0] : null;
        renderPreviewImagen(archivoNotas, previewNotas);
    });
}

cedulaInput.addEventListener("input", () => {
    // Solo números, máximo 10 dígitos
    cedulaInput.value = cedulaInput.value.replace(/\D/g, "").slice(0, 10);

    clearTimeout(timerCedula);

    const cedula = cedulaInput.value.trim();

    if (cedula.length < 10) {
        cedulaStatus.classList.add("oculto");
        return;
    }

    timerCedula = setTimeout(async () => {
        mostrarEstadoCedula(cedulaStatus, cedulaStatusText, "loading", "Verificando cédula...");

        try {
            await validarCedulaExistente();
            mostrarEstadoCedula(cedulaStatus, cedulaStatusText, "ok", "Cédula verificada");
        } catch (error) {
            mostrarEstadoCedula(cedulaStatus, cedulaStatusText, "error", "No se pudo verificar");
        }
    }, 600);
});

btnReDescargar.addEventListener("click", reDescargar);

// ─────────────────────────────────────────────
// SUBMIT FORMULARIO PRINCIPAL
// ─────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!formularioActivo) { mostrarMensajeFormularioCerrado(); return; }

    const cedula = cedulaInput.value.trim();

    if (cedula) {
        try {
            const conflicto = await verificarConflictos(cedula);

            if (conflicto) {
                if (conflicto.tipo === "sinformacion_existe") {
                    mostrarPantallaBloqueado(conflicto);
                    return;
                }

                if (conflicto.tipo === "seguimiento_existe") {
                    const registroSeg = await buscarSeguimientoExistentePorCedula(cedula);
                    if (registroSeg) {
                        ultimoDocumento = await construirDocumentoDesdeRegistro(registroSeg);
                        btnReDescargar.classList.remove("oculto");
                        abrirModal(registroSeg);
                    }
                    return;
                }
            }
        } catch (error) {
            console.error("Error verificando registro existente:", error);
        }
    }

    if (!formularioValido()) {
        mostrarMensaje("❌ Complete todos los campos requeridos y adjunte las imágenes de las evidencias presentadas");
        return;
    }

    btnGenerar.disabled = true;
    btnReDescargar.classList.add("oculto");
    window.mostrarAnimacionGenerando?.();

    let codigoGenerado = null;
    let nombreDocente = null;

    try {
        if (!formularioActivo) {
            window.ocultarAnimacionGenerando?.(false);
            mostrarMensajeFormularioCerrado();
            return;
        }

        codigoGenerado = await generarCodigoSecuencial();
        const valores = leerValoresFormulario();
        nombreDocente = valores.nombre;

        if (!formularioActivo) {
            window.ocultarAnimacionGenerando?.(false);
            mostrarMensajeFormularioCerrado();
            return;
        }

        const [imagenMatricula, imagenNotas] = await Promise.all([
            prepararImagen(archivoMatricula),
            prepararImagen(archivoNotas)
        ]);

        const [urlMatricula, urlNotas] = await Promise.all([
            archivoMatricula ? subirImagenYObtenerURL(archivoMatricula, valores.cedula, codigoGenerado, "matricula") : null,
            archivoNotas ? subirImagenYObtenerURL(archivoNotas, valores.cedula, codigoGenerado, "notas") : null
        ]);

        if (!formularioActivo) {
            window.ocultarAnimacionGenerando?.(false);
            mostrarMensajeFormularioCerrado();
            return;
        }

        ultimoDocumento = {
            data: construirDataDoc(codigoGenerado, valores),
            imagenes: { imagen1: imagenMatricula, imagen2: imagenNotas }
        };

        await guardarRegistro(codigoGenerado, valores, { matricula: urlMatricula, notas: urlNotas });
        await generarDocumento(ultimoDocumento);

        window.ocultarAnimacionGenerando?.(true);
        btnReDescargar.classList.remove("oculto");
        abrirModalExito(codigoGenerado, nombreDocente);

    } catch (error) {
        console.error("Error generando seguimiento:", error);
        window.ocultarAnimacionGenerando?.(false);

        if (codigoGenerado) {
            btnReDescargar.classList.remove("oculto");
            mostrarMensaje(
                "⚠️ El documento se guardó en el sistema pero no se pudo descargar el PDF. " +
                "Use el botón 'Re-descargar' para intentarlo nuevamente."
            );
        } else {
            mostrarMensaje(error.message || "❌ Error al generar el PDF de seguimiento");
        }
    } finally {
        btnGenerar.disabled = false;
    }
});

// ─────────────────────────────────────────────
// CONTADOR Y LÍMITE DE PALABRAS (mini formulario)
// ─────────────────────────────────────────────
function contarPalabras(texto) {
    const limpio = String(texto || "").trim();
    if (!limpio) return [];
    return limpio.split(/\s+/);
}

function inicializarLimitePalabras(textarea) {
    if (!textarea) return;
    const max = Number(textarea.dataset.maxPalabras || 20);
    const contador = document.getElementById(`contador_${textarea.id}`);
    if (!contador) return;

    function actualizar() {
        let palabras = contarPalabras(textarea.value);

        if (palabras.length > max) {
            textarea.value = palabras.slice(0, max).join(" ");
            palabras = contarPalabras(textarea.value);
        }

        contador.textContent = `${palabras.length} / ${max} palabras`;
        contador.classList.remove("aviso", "limite");

        if (palabras.length >= max) {
            contador.classList.add("limite");
        } else if (palabras.length >= max * 0.85) {
            contador.classList.add("aviso");
        }
    }

    textarea.addEventListener("input", actualizar);
    textarea.addEventListener("paste", () => setTimeout(actualizar, 0));
    actualizar();
}

document.querySelectorAll(".limit-palabras").forEach(inicializarLimitePalabras);

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
fechaActualInput.value = hoyInput();
calcularRestante();
cargarConfiguracion();
escucharEstadoFormulario();