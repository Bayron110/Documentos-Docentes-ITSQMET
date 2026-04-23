import { db } from "../../firebase/firebase.js";
import {
    ref,
    get,
    set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const form = document.getElementById("formSeguimiento");
const cargando = document.getElementById("cargando");
const mensaje = document.getElementById("mensaje");
const codigoPreviewEl = document.getElementById("codigoPreview");
const btnGenerar = document.getElementById("btnGenerar");
const btnReDescargar = document.getElementById("btnReDescargar");
const previewImagenes = document.getElementById("previewImagenes");

const nombresInput = document.getElementById("nombres");
const cedulaInput = document.getElementById("cedula");
const carreraInput = document.getElementById("carrera");
const tituloInput = document.getElementById("titulo");
const formacionCursoSelect = document.getElementById("formacionCurso");
const carreraCursandoInput = document.getElementById("carreraCursando");
const instituacionInput = document.getElementById("instituacion");

const modalidadSelect = document.getElementById("modalidad");
const fechaInicioInput = document.getElementById("fechaInicio");
const fechaFinInput = document.getElementById("fechaFin");
const financiamientoSelect = document.getElementById("financiamiento");
const acuerdoPatrocinioSelect = document.getElementById("acuerdoPatrocinio");
const tipoApoyoSelect = document.getElementById("tipoApoyo");
const tdosInput = document.getElementById("tdos");

const estadoFormacionInput = document.getElementById("estadoFormacion");
const avanceInput = document.getElementById("avance");
const restanteInput = document.getElementById("restante");
const observacionesInput = document.getElementById("observaciones");

const fechaActualInput = document.getElementById("fechaActual");
const evidenciaInput = document.getElementById("evidencia");
const observaciones2Input = document.getElementById("observaciones2");
const imagenesInput = document.getElementById("imagenes");

const storage = getStorage();

const API_BASE =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
        ? "http://localhost:8000"
        : "https://TU-BACKEND.onrender.com";

let codigoUnidad = "UGPA-RGI2-01-PRO-251";
let anio = new Date().getFullYear().toString();
let mes = String(new Date().getMonth() + 1).padStart(2, "0");

let imagenArchivo = null;
let ultimoDocumento = null;

window.volver = () => {
    window.location.href = "../../index.html";
};

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
function mostrarMensaje(texto) {
    mensaje.textContent = texto;
    setTimeout(() => {
        mensaje.textContent = "";
    }, 4000);
}

function hoyInput() {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return "";
    const [anioLocal, mesLocal, dia] = String(fechaISO).split("-");
    return `${dia}/${mesLocal}/${anioLocal}`;
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

function limpiarNombreArchivo(texto) {
    return String(texto || "")
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
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
    const baseNormalizada = normalizarBaseCodigo(codigoUnidad);
    codigoPreviewEl.textContent = `${baseNormalizada}-${anio}-${mes}`;
}

function calcularRestante() {
    let avance = Number(avanceInput.value || 0);
    if (avance < 0) avance = 0;
    if (avance > 100) avance = 100;
    avanceInput.value = avance;
    restanteInput.value = 100 - avance;
}

function formularioValido() {
    return !!(
        nombresInput.value.trim() &&
        cedulaInput.value.trim() &&
        carreraInput.value.trim() &&
        tituloInput.value.trim() &&
        formacionCursoSelect.value.trim() &&
        carreraCursandoInput.value.trim() &&
        instituacionInput.value.trim() &&
        modalidadSelect.value.trim() &&
        fechaInicioInput.value &&
        fechaFinInput.value &&
        financiamientoSelect.value.trim() &&
        tipoApoyoSelect.value.trim() &&
        tdosInput.value.trim() &&
        estadoFormacionInput.value.trim() &&
        avanceInput.value !== "" &&
        restanteInput.value !== "" &&
        observacionesInput.value.trim() &&
        fechaActualInput.value &&
        evidenciaInput.value.trim() &&
        observaciones2Input.value.trim()
    );
}

function obtenerImageModuleClass() {
    const candidatos = [
        window.DocxtemplaterImageModuleFree,
        window.ImageModule,
        window.docxtemplaterImageModuleFree,
        window["docxtemplater-image-module-free"]
    ];

    for (const candidato of candidatos) {
        if (typeof candidato === "function") return candidato;
    }
    return null;
}

function asegurarLibrerias() {
    if (typeof window.PizZip === "undefined") {
        throw new Error("PizZip no está cargado");
    }

    if (typeof window.docxtemplater === "undefined") {
        throw new Error("docxtemplater no está cargado");
    }

    if (typeof window.saveAs === "undefined") {
        throw new Error("FileSaver no está cargado");
    }

    const ImageModuleClass = obtenerImageModuleClass();
    if (!ImageModuleClass) {
        throw new Error("La librería de imágenes no está cargada");
    }

    return ImageModuleClass;
}

// ─────────────────────────────────────────────
// IMAGEN
// ─────────────────────────────────────────────
function fileToUint8Array(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(new Uint8Array(reader.result));
        };

        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.readAsArrayBuffer(file);
    });
}

async function urlToUint8Array(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("No se pudo descargar la imagen");
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    } catch (error) {
        console.warn("Error cargando imagen desde URL:", error);
        return imagenPlaceholder1x1();
    }
}

function imagenPlaceholder1x1() {
    return new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
    ]);
}

async function prepararImagenParaDoc() {
    if (!imagenArchivo) {
        return {
            bytes: imagenPlaceholder1x1(),
            esPlaceholder: true
        };
    }

    try {
        const bytes = await fileToUint8Array(imagenArchivo);

        if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
            return {
                bytes: imagenPlaceholder1x1(),
                esPlaceholder: true
            };
        }

        return {
            bytes,
            esPlaceholder: false
        };
    } catch (error) {
        console.warn("Error al preparar imagen, se usará placeholder:", error);
        return {
            bytes: imagenPlaceholder1x1(),
            esPlaceholder: true
        };
    }
}

function renderPreviewImagen() {
    previewImagenes.innerHTML = "";

    if (!imagenArchivo) return;

    const reader = new FileReader();
    reader.onload = () => {
        const item = document.createElement("div");
        item.className = "img-item";
        item.innerHTML = `<img src="${reader.result}" alt="Anexo">`;
        previewImagenes.appendChild(item);
    };
    reader.readAsDataURL(imagenArchivo);
}

async function subirImagenYObtenerURL(file, cedula, codigo) {
    if (!file) return null;

    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const ruta = `seguimientos/${cedula}_${limpiarClave(codigo)}.${extension}`;
    const referencia = storageRef(storage, ruta);

    await uploadBytes(referencia, file, {
        contentType: file.type || "image/jpeg"
    });

    return await getDownloadURL(referencia);
}

// ─────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────
async function cargarConfiguracion() {
    cargando.classList.remove("oculto");

    try {
        const snap = await get(ref(db, "config-seguimiento/1"));
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
    } catch (error) {
        console.error("Error cargando config-seguimiento:", error);
        mostrarMensaje("❌ Error al cargar la configuración");
    } finally {
        cargando.classList.add("oculto");
        actualizarCodigoPreview();
    }
}

// ─────────────────────────────────────────────
// BUSCAR POR CÉDULA EN EL MES ACTUAL
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
        const cedulaGuardada = String(data?.cedula || "").trim();

        if (!codigo || !cedulaGuardada) return;

        const partes = codigo.split("-");
        if (partes.length < 7) return;

        const anioGuardado = String(partes[5] || "");
        const mesGuardado = String(partes[6] || "").padStart(2, "0");

        if (
            cedulaGuardada === cedulaLimpia &&
            anioGuardado === anio &&
            mesGuardado === mes
        ) {
            encontrado = {
                id: child.key,
                ...data
            };
        }
    });

    return encontrado;
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
                const secuencia = Number(partes[2]);
                const anioGuardado = partes[5];
                const mesGuardado = partes[6];

                if (anioGuardado === anio && mesGuardado === mes && !isNaN(secuencia)) {
                    if (secuencia > maxSecuencia) maxSecuencia = secuencia;
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
// RECONSTRUIR PARA WORD
// ─────────────────────────────────────────────
async function construirDataDocDesdeRegistro(registro) {
    const datos = registro?.datosDocumento || {};

    const formacion = datos.formacion || "";
    const modalidad = datos.modalidad || "";
    const financiamiento = datos.financiamiento || "";
    const tipoApoyo = datos.tipoApoyo || "";
    const acuerdoPatrocinio = datos.acuerdoPatrocinio || "Si";

    let imageBytes = imagenPlaceholder1x1();
    let esPlaceholder = true;

    if (datos.imagenURL) {
        imageBytes = await urlToUint8Array(datos.imagenURL);
        esPlaceholder = false;
    }

    return {
        Codigo: registro?.codigo || "",
        NombresC: registro?.nombre || "",
        Cedula1: registro?.cedula || "",
        Carrera1: registro?.carrera || "",
        Titulo: datos.Titulo || "",

        Tecnologia: formacion === "Tecnología Universitaria",
        Licenciatura: formacion === "Licenciatura",
        Ingenieria: formacion === "Ingeniería",
        Maestria: formacion === "Maestría",
        Doctorado: formacion === "Doctorado",

        CarreraCursando: registro?.CarreraCursando || "",
        instituacion: datos.instituacion || "",

        Presencial: modalidad === "Presencial",
        Virtual: modalidad === "Virtual",
        Hibrida: modalidad === "Híbrida",

        Finicio: formatearFecha(registro?.Einicio || ""),
        Ffin: formatearFecha(registro?.Efin || ""),

        Total: financiamiento === "Total",
        Parcial: financiamiento === "Parcial",
        NoAplica: financiamiento === "No aplica",

        Si: acuerdoPatrocinio === "Si",
        No: false,

        Economico: tipoApoyo === "Economico",
        Tiempo: tipoApoyo === "Tiempo",

        Tdos: datos.Tdos || "",

        Estado: datos.Estado || "",
        avance: datos.avance || "",
        restante: datos.restante || "",
        observaciones: datos.observaciones || "",

        fechaActual: datos.fechaActual || "",
        evidencia: datos.evidencia || "",
        observaciones2: datos.observaciones2 || "",

        añoActual: datos.añoActual || new Date().getFullYear().toString(),

        image: imageBytes,
        imageMeta: {
            esPlaceholder
        }
    };
}

// ─────────────────────────────────────────────
// FIREBASE
// ─────────────────────────────────────────────
async function guardarRegistro(codigo, imagenURL = null) {
    const cedula = cedulaInput.value.trim();
    const key = `${cedula}_${limpiarClave(codigo)}`;
    const ahora = new Date();

    await set(ref(db, `seguimientoGenerados/${key}`), {
        carrera: carreraInput.value.trim(),
        cedula,
        nombre: nombresInput.value.trim(),
        codigo,
        fecha: ahora.toLocaleDateString("es-EC"),
        CarreraCursando: carreraCursandoInput.value.trim(),
        Einicio: fechaInicioInput.value,
        Efin: fechaFinInput.value,
        datosDocumento: {
            Codigo: codigo,
            NombresC: nombresInput.value.trim(),
            Cedula1: cedula,
            Carrera1: carreraInput.value.trim(),
            Titulo: tituloInput.value.trim(),

            CarreraCursando: carreraCursandoInput.value.trim(),
            instituacion: instituacionInput.value.trim(),

            formacion: formacionCursoSelect.value.trim(),
            modalidad: modalidadSelect.value.trim(),
            financiamiento: financiamientoSelect.value.trim(),
            acuerdoPatrocinio: "Si",
            tipoApoyo: tipoApoyoSelect.value.trim(),

            Tdos: tdosInput.value.trim(),

            Estado: estadoFormacionInput.value.trim(),
            avance: `${avanceInput.value}%`,
            restante: `${restanteInput.value}%`,
            observaciones: observacionesInput.value.trim(),

            fechaActual: formatearFecha(fechaActualInput.value),
            evidencia: evidenciaInput.value.trim(),
            observaciones2: observaciones2Input.value.trim(),

            añoActual: new Date().getFullYear().toString(),

            imagenURL: imagenURL || null
        }
    });
}

// ─────────────────────────────────────────────
// DOCX -> PDF
// ─────────────────────────────────────────────
async function convertirDocxAPdf(blobDocx, nombreBase) {
    const formData = new FormData();
    formData.append("file", blobDocx, `${nombreBase}.docx`);
    formData.append("tipo_documento", "seguimiento");

    const response = await fetch(`${API_BASE}/convertir-pdf`, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        let mensajeError = "No se pudo convertir el documento a PDF";
        try {
            const errorData = await response.json();
            mensajeError = errorData.detail || mensajeError;
        } catch {
        }
        throw new Error(mensajeError);
    }

    const blobPdf = await response.blob();
    window.saveAs(blobPdf, `${nombreBase}.pdf`);
}

// ─────────────────────────────────────────────
// GENERAR DOCUMENTO
// ─────────────────────────────────────────────
async function generarDocumento(dataDoc, imageBytes, esPlaceholder = false) {
    const ImageModuleClass = asegurarLibrerias();

    const response = await fetch("../../doc/seguimiento.docx");
    if (!response.ok) {
        throw new Error("No se pudo cargar la plantilla seguimiento.docx");
    }

    const content = await response.arrayBuffer();
    const zip = new window.PizZip(content);

    const bytesFinales =
        imageBytes instanceof Uint8Array && imageBytes.length > 0
            ? imageBytes
            : imagenPlaceholder1x1();

    const imageModule = new ImageModuleClass({
        centered: true,
        getImage() {
            return bytesFinales;
        },
        getSize() {
            if (esPlaceholder) return [1, 1];
            return [420, 300];
        }
    });

    const doc = new window.docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true
    });

    try {
        doc.render({
            ...dataDoc,
            image: "ok"
        });
    } catch (error) {
        console.error("Error renderizando DOCX:", error);
        throw new Error(error?.message || "Error al renderizar el documento Word");
    }

    const blobDocx = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    const nombreBase = limpiarNombreArchivo(`${dataDoc.Codigo}-${dataDoc.NombresC}`);
    await convertirDocxAPdf(blobDocx, nombreBase);
}

// ─────────────────────────────────────────────
// RE-DESCARGAR
// ─────────────────────────────────────────────
async function reDescargar() {
    if (!ultimoDocumento) {
        mostrarMensaje("❌ No hay documento para re-descargar");
        return;
    }

    try {
        let bytesImagen = ultimoDocumento.image;
        let esPlaceholder = ultimoDocumento.imageMeta?.esPlaceholder === true;

        if (imagenArchivo) {
            const resultadoImagenActual = await prepararImagenParaDoc();
            bytesImagen = resultadoImagenActual.bytes;
            esPlaceholder = resultadoImagenActual.esPlaceholder;
        }

        await generarDocumento(
            ultimoDocumento,
            bytesImagen,
            esPlaceholder
        );
        mostrarMensaje("✅ PDF descargado nuevamente");
    } catch (error) {
        console.error("Error re-descargando seguimiento:", error);
        mostrarMensaje(error.message || "❌ Error al volver a descargar el PDF");
    }
}

// ─────────────────────────────────────────────
// CREAR OBJETO DOCUMENTO
// ─────────────────────────────────────────────
function construirDataDoc(codigo, resultadoImagen) {
    return {
        Codigo: codigo,
        NombresC: nombresInput.value.trim(),
        Cedula1: cedulaInput.value.trim(),
        Carrera1: carreraInput.value.trim(),
        Titulo: tituloInput.value.trim(),

        Tecnologia: formacionCursoSelect.value === "Tecnología Universitaria",
        Licenciatura: formacionCursoSelect.value === "Licenciatura",
        Ingenieria: formacionCursoSelect.value === "Ingeniería",
        Maestria: formacionCursoSelect.value === "Maestría",
        Doctorado: formacionCursoSelect.value === "Doctorado",

        CarreraCursando: carreraCursandoInput.value.trim(),
        instituacion: instituacionInput.value.trim(),

        Presencial: modalidadSelect.value === "Presencial",
        Virtual: modalidadSelect.value === "Virtual",
        Hibrida: modalidadSelect.value === "Híbrida",

        Finicio: formatearFecha(fechaInicioInput.value),
        Ffin: formatearFecha(fechaFinInput.value),

        Total: financiamientoSelect.value === "Total",
        Parcial: financiamientoSelect.value === "Parcial",
        NoAplica: financiamientoSelect.value === "No aplica",

        Si: true,
        No: false,

        Economico: tipoApoyoSelect.value === "Economico",
        Tiempo: tipoApoyoSelect.value === "Tiempo",

        Tdos: tdosInput.value.trim(),

        Estado: estadoFormacionInput.value.trim(),
        avance: `${avanceInput.value}%`,
        restante: `${restanteInput.value}%`,
        observaciones: observacionesInput.value.trim(),

        fechaActual: formatearFecha(fechaActualInput.value),
        evidencia: evidenciaInput.value.trim(),
        observaciones2: observaciones2Input.value.trim(),

        añoActual: new Date().getFullYear().toString(),

        image: resultadoImagen.bytes,
        imageMeta: {
            esPlaceholder: resultadoImagen.esPlaceholder
        }
    };
}

// ─────────────────────────────────────────────
// VALIDAR SOLO CON CÉDULA
// ─────────────────────────────────────────────
async function validarCedulaExistente() {
    const cedula = cedulaInput.value.trim();

    btnReDescargar.classList.add("oculto");

    if (!cedula) return;

    try {
        const encontrado = await buscarSeguimientoExistentePorCedula(cedula);

        if (!encontrado) return;

        ultimoDocumento = await construirDataDocDesdeRegistro(encontrado);
        btnReDescargar.classList.remove("oculto");
        mostrarMensaje("⚠️ Esta cédula ya generó seguimiento este mes. Puede volver a descargarlo.");
    } catch (error) {
        console.error("Error validando cédula:", error);
    }
}

// ─────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────
avanceInput.addEventListener("input", calcularRestante);

imagenesInput.addEventListener("change", (e) => {
    const archivos = Array.from(e.target.files || []);
    imagenArchivo = archivos.length ? archivos[0] : null;
    renderPreviewImagen();
});

cedulaInput.addEventListener("change", validarCedulaExistente);
cedulaInput.addEventListener("blur", validarCedulaExistente);

btnReDescargar.addEventListener("click", reDescargar);

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cedula = cedulaInput.value.trim();

    if (cedula) {
        try {
            const registroExistente = await buscarSeguimientoExistentePorCedula(cedula);
            if (registroExistente) {
                ultimoDocumento = await construirDataDocDesdeRegistro(registroExistente);
                btnReDescargar.classList.remove("oculto");
                mostrarMensaje("⚠️ Esta cédula ya generó seguimiento este mes. Use re-descargar.");
                return;
            }
        } catch (error) {
            console.error("Error verificando registro existente:", error);
        }
    }

    if (!formularioValido()) {
        mostrarMensaje("❌ Complete todos los campos requeridos");
        return;
    }

    if (fechaFinInput.value < fechaInicioInput.value) {
        mostrarMensaje("❌ La fecha de finalización no puede ser menor a la fecha de inicio");
        return;
    }

    btnGenerar.disabled = true;
    btnGenerar.textContent = "Generando...";
    btnReDescargar.classList.add("oculto");

    try {
        const codigo = await generarCodigoSecuencial();
        const resultadoImagen = await prepararImagenParaDoc();

        const imagenURL = imagenArchivo
            ? await subirImagenYObtenerURL(imagenArchivo, cedulaInput.value.trim(), codigo)
            : null;

        const dataDoc = construirDataDoc(codigo, resultadoImagen);
        ultimoDocumento = dataDoc;

        await guardarRegistro(codigo, imagenURL);

        await generarDocumento(
            dataDoc,
            dataDoc.image,
            dataDoc.imageMeta.esPlaceholder === true
        );

        btnReDescargar.classList.remove("oculto");
        mostrarMensaje("✅ Seguimiento generado correctamente en PDF");
    } catch (error) {
        console.error("Error generando seguimiento:", error);
        mostrarMensaje(error.message || "❌ Error al generar el PDF de seguimiento");
    } finally {
        btnGenerar.disabled = false;
        btnGenerar.textContent = "Generar";
    }
});

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
fechaActualInput.value = hoyInput();
calcularRestante();
cargarConfiguracion();