import { db } from "../../firebase/firebase.js";

import {
  ref,
  get,
  set,
  push
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const form = document.getElementById("formPatrocinio");
const estado = document.getElementById("estado");

window.volver = () => window.location.href = "../../index.html";

function limpiarNombreArchivo(texto) {
  return texto.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────
// CARGAR SELECTS
// ─────────────────────────────
async function cargarCarreras() {
  try {
    const snap = await get(ref(db, "carreras"));
    const select = document.getElementById("carrera");

    select.innerHTML = '<option value="">-- Seleccione una carrera --</option>';

    if (snap.exists()) {
      snap.forEach((child) => {
        const data = child.val();
        if (!data?.nombre) return;

        const opt = document.createElement("option");
        opt.value = data.nombre;
        opt.textContent = data.nombre;
        select.appendChild(opt);
      });
    }
  } catch (error) {
    console.error("Error al cargar carreras:", error);
    estado.textContent = "No se pudieron cargar las carreras";
  }
}

async function cargarCapacitaciones() {
  try {
    const snap = await get(ref(db, "capacitaciones"));
    const select = document.getElementById("capacitacion");

    select.innerHTML = '<option value="">-- Seleccione una capacitación --</option>';

    if (snap.exists()) {
      snap.forEach((child) => {
        const data = child.val();
        if (!data?.nombre) return;

        const opt = document.createElement("option");
        opt.value = data.nombre;
        opt.textContent = data.nombre;
        select.appendChild(opt);
      });
    }
  } catch (error) {
    console.error("Error al cargar capacitaciones:", error);
    estado.textContent = "No se pudieron cargar las capacitaciones";
  }
}

// ─────────────────────────────
// VALIDAR FORMULARIO
// ─────────────────────────────
async function validarFormulario() {
  const snap = await get(ref(db, "config/formularios"));

  if (!snap.exists()) {
    throw new Error("No existe la configuración de formularios");
  }

  const formularios = snap.val();

  if (!formularios.patrocinio) {
    throw new Error("Formulario de patrocinio deshabilitado");
  }
}

// ─────────────────────────────
// VALIDAR SI YA EXISTE LA CÉDULA
// ─────────────────────────────
async function verificarPatrocinioExistente(cedula) {
  const snap = await get(ref(db, "registrosPatrocinio"));

  if (!snap.exists()) return false;

  let existe = false;
  const cedulaBuscada = String(cedula).trim();

  snap.forEach((child) => {
    const data = child.val();
    const cedulaGuardada = String(data?.cedula || "").trim();

    if (cedulaGuardada === cedulaBuscada) {
      existe = true;
    }
  });

  return existe;
}

// ─────────────────────────────
// OBTENER CONFIG GENERAL
// ─────────────────────────────
async function obtenerConfigGeneral() {
  const snap = await get(ref(db, "config/general"));

  if (!snap.exists()) {
    return {
      anio: String(new Date().getFullYear()),
      mes: String(new Date().getMonth() + 1).padStart(2, "0"),
      fecha1Texto: "desde el 2 dia del mes de marzo de 2026",
      prefijoFijo: "UGPA",
      bloqueFijo: "RGI2"
    };
  }

  const data = snap.val();

  return {
    anio: String(data.anio || new Date().getFullYear()),
    mes: String(data.mes || String(new Date().getMonth() + 1).padStart(2, "0")).padStart(2, "0"),
    fecha1Texto: data.fecha1Texto || "desde el 2 dia del mes de marzo de 2026",
    prefijoFijo: data.prefijoFijo || "UGPA",
    bloqueFijo: data.bloqueFijo || "RGI2"
  };
}

// ─────────────────────────────
// GENERAR CÓDIGO SECUENCIAL REAL
// - revisa registrosPatrocinio
// - mismo mes => sigue
// - distinto mes => empieza en 01
// ─────────────────────────────
async function generarCodigoSecuencial() {
  try {
    const config = await obtenerConfigGeneral();
    const { anio, mes, fecha1Texto, prefijoFijo, bloqueFijo } = config;

    const snap = await get(ref(db, "registrosPatrocinio"));

    let maxSecuencia = 0;

    if (snap.exists()) {
      snap.forEach((child) => {
        const data = child.val();
        const codigo = String(data?.codigo || "").trim();

        if (!codigo) return;

        const partes = codigo.split("-");

        if (partes.length < 5) return;

        const secuencia = parseInt(partes[1], 10);
        const codigoAnio = String(partes[3] || "");
        const codigoMes = String(partes[4] || "").padStart(2, "0");

        if (codigoAnio === anio && codigoMes === mes) {
          if (!isNaN(secuencia) && secuencia > maxSecuencia) {
            maxSecuencia = secuencia;
          }
        }
      });
    }

    const siguienteSecuencia = maxSecuencia + 1;
    const sec = String(siguienteSecuencia).padStart(2, "0");

    return {
      codigo: `${prefijoFijo}-${sec}-${bloqueFijo}-${anio}-${mes}`,
      fecha1Texto
    };
  } catch (error) {
    console.error("Error en generarCodigoSecuencial:", error);
    throw new Error("No se pudo generar el código");
  }
}

// ─────────────────────────────
// GUARDAR REGISTRO
// ─────────────────────────────
async function guardarRegistro(nombre, cedula, carrera, codigo) {
  await set(push(ref(db, "registrosPatrocinio")), {
    docente: nombre,
    cedula: cedula,
    carrera: carrera,
    codigo,
    fechaCreacion: new Date().toLocaleDateString("es-EC"),
    horaCreacion: new Date().toLocaleTimeString("es-EC"),
    timestamp: Date.now(),
    tipo: "patrocinio"
  });
}

// ─────────────────────────────
// GENERAR DOCUMENTO
// ─────────────────────────────
async function generarDocumento({
  nombres,
  carrera,
  cedula,
  capacitacion,
  codigo,
  fecha1Texto
}) {
  const response = await fetch("../../doc/patrocinio.docx");

  if (!response.ok) {
    throw new Error("No se pudo cargar la plantilla Word");
  }

  const content = await response.arrayBuffer();

  const zip = new PizZip(content);
  const doc = new window.docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });

  doc.render({
    NombresC: nombres,
    Carrera1: carrera,
    Cedula1: cedula,
    NombreCA: capacitacion,
    Codigo: codigo,
    Fecha1: fecha1Texto
  });

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  saveAs(blob, limpiarNombreArchivo(`${codigo} ${nombres}.docx`));
}

// ─────────────────────────────
// SUBMIT FORM
// ─────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  estado.textContent = "Generando...";

  const nombres = document.getElementById("nombres").value.trim();
  const carrera = document.getElementById("carrera").value.trim();
  const cedula = document.getElementById("cedula").value.trim();
  const capacitacion = document.getElementById("capacitacion").value.trim();

  if (!nombres || !carrera || !cedula || !capacitacion) {
    estado.textContent = "Completa todos los campos";
    return;
  }

  try {
    await validarFormulario();

    const yaExiste = await verificarPatrocinioExistente(cedula);
    if (yaExiste) {
      estado.textContent = "Ya existe un acuerdo de patrocinio registrado para esta cédula";
      return;
    }

    const { codigo, fecha1Texto } = await generarCodigoSecuencial();

    await guardarRegistro(nombres, cedula, carrera, codigo);

    await generarDocumento({
      nombres,
      carrera,
      cedula,
      capacitacion,
      codigo,
      fecha1Texto
    });

    estado.textContent = "Documento generado correctamente ✔";

    form.reset();
    await cargarCarreras();
    await cargarCapacitaciones();
  } catch (err) {
    console.error("Error:", err);
    estado.textContent = err.message || "Ocurrió un error al generar el documento";
  }
});

// ─────────────────────────────
// INIT
// ─────────────────────────────
cargarCarreras();
cargarCapacitaciones();