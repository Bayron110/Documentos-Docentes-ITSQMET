import { db } from "../../firebase/firebase.js";
import {
  ref,
  get,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const form = document.getElementById("formPlanIndividual");
const estado = document.getElementById("estado");
const selectCarrera = document.getElementById("carrera");

const detalleEspecifica = document.getElementById("detalleEspecifica");
const detalleGenerica = document.getElementById("detalleGenerica");
const tablaCapacitacionesBody = document.querySelector("#tablaCapacitaciones tbody");
const listaTeoria = document.getElementById("listaTeoria");
const listaPractica = document.getElementById("listaPractica");
const btnReDescargar = document.getElementById("btnReDescargar");

const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "https://TU-BACKEND.onrender.com";

let carreraActual = null;
let ultimoDocumento = null;

window.volver = () => {
  window.location.href = "../../index.html";
};

// ─────────────────────────────────────────────
// UTILIDADES
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

// ─────────────────────────────────────────────
// FECHAS LARGAS PARA EL WORD
// ─────────────────────────────────────────────
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

  const anio = partes[0];
  const mes = partes[1];
  const dia = Number(partes[2]);

  if (!anio || !mes || !dia) return "";

  return `${dia} de ${convertirMesANombre(mes)} de ${anio}`;
}

function construirRangoFechaTexto(fechaInicio, fechaFin) {
  const inicio = formatearFechaLarga(fechaInicio);
  const fin = formatearFechaLarga(fechaFin);

  if (inicio && fin) {
    return `desde el ${inicio} hasta el ${fin}`;
  }

  if (inicio) {
    return `desde el ${inicio}`;
  }

  if (fin) {
    return `hasta el ${fin}`;
  }

  return "";
}

function obtenerCapacitacionesDeCarrera(carreraData) {
  if (!carreraData?.capacitaciones || typeof carreraData.capacitaciones !== "object") {
    return [];
  }

  return Object.entries(carreraData.capacitaciones)
    .map(([key, value]) => ({
      key,
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

function renderDetalleCapacitacion(contenedor, data, tituloVacio) {
  if (!data || !data.capacitacion) {
    contenedor.innerHTML = `<div class="detalle-vacio">${tituloVacio}</div>`;
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
    </div>
  `;
}

function construirListaCapacitaciones(carreraData) {
  const caps = obtenerCapacitacionesDeCarrera(carreraData);

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
    tablaCapacitacionesBody.innerHTML = `
      <tr>
        <td colspan="7">No hay capacitaciones cargadas para esta carrera</td>
      </tr>
    `;
    return;
  }

  lista.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.contador}</td>
      <td>${valorSeguro(item.nombre, "-")}</td>
      <td>${valorSeguro(item.horas, 0)}</td>
      <td>${formatoFecha(item.fechaInicio)}</td>
      <td>${formatoFecha(item.fechaFin)}</td>
      <td>${valorSeguro(item.tipo, "-")}</td>
      <td>${valorSeguro(item.estado, "-")}</td>
    `;
    tablaCapacitacionesBody.appendChild(tr);
  });
}

function renderListaHtml(contenedor, items) {
  contenedor.innerHTML = "";

  if (!items || !items.length) {
    contenedor.innerHTML = "<li>Sin datos</li>";
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    contenedor.appendChild(li);
  });
}

function obtenerActividadesDesdeCapacitaciones(carreraData) {
  const teoria = [];
  const practica = [];

  const caps = obtenerCapacitacionesDeCarrera(carreraData);

  caps.forEach((cap) => {
    cap.teoriaTemas.forEach((tema) => {
      const titulo = String(tema?.titulo || "").trim();
      if (titulo && !teoria.some(t => normalizarTexto(t) === normalizarTexto(titulo))) {
        teoria.push(titulo);
      }
    });

    cap.practicaTemas.forEach((tema) => {
      const titulo = String(tema?.titulo || "").trim();
      if (titulo && !practica.some(p => normalizarTexto(p) === normalizarTexto(titulo))) {
        practica.push(titulo);
      }
    });
  });

  return { teoria, practica };
}

// ─────────────────────────────────────────────
// CONVERTIR DOCX A PDF
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
    let mensajeError = "No se pudo convertir el documento a PDF";
    try {
      const errorData = await response.json();
      mensajeError = errorData.detail || mensajeError;
    } catch {
    }
    throw new Error(mensajeError);
  }

  const blobPdf = await response.blob();
  saveAs(blobPdf, `${nombreBase}.pdf`);
}

// ─────────────────────────────────────────────
// CARRERAS
// ─────────────────────────────────────────────
async function cargarCarreras() {
  try {
    const snap = await get(ref(db, "carreras"));

    selectCarrera.innerHTML = '<option value="">-- Seleccione una carrera --</option>';

    if (!snap.exists()) {
      selectCarrera.innerHTML = '<option value="">No hay carreras registradas</option>';
      return;
    }

    const carreras = [];

    snap.forEach((child) => {
      const data = child.val();
      if (data?.nombre) {
        carreras.push(data.nombre);
      }
    });

    carreras.sort((a, b) => a.localeCompare(b, "es"));

    carreras.forEach((nombre) => {
      const opt = document.createElement("option");
      opt.value = nombre;
      opt.textContent = nombre;
      selectCarrera.appendChild(opt);
    });
  } catch (error) {
    console.error("Error al cargar carreras:", error);
    estado.textContent = "No se pudieron cargar las carreras";
  }
}

async function obtenerCarreraPorNombre(nombreCarrera) {
  const snap = await get(ref(db, "carreras"));
  if (!snap.exists()) return null;

  let carreraEncontrada = null;

  snap.forEach((child) => {
    const data = child.val();
    if (normalizarTexto(data?.nombre) === normalizarTexto(nombreCarrera)) {
      carreraEncontrada = data;
    }
  });

  return carreraEncontrada;
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

  const carreraData = await obtenerCarreraPorNombre(nombreCarrera);
  carreraActual = carreraData;

  const caps = obtenerCapacitacionesDeCarrera(carreraData);
  const primeraCap = caps[0] || null;
  const segundaCap = caps[1] || null;

  renderDetalleCapacitacion(detalleEspecifica, primeraCap, "No hay capacitación 1");
  renderDetalleCapacitacion(detalleGenerica, segundaCap, "No hay capacitación 2");

  const lista = construirListaCapacitaciones(carreraData);
  renderTablaCapacitaciones(lista);

  const actividades = obtenerActividadesDesdeCapacitaciones(carreraData);
  renderListaHtml(listaTeoria, actividades.teoria);
  renderListaHtml(listaPractica, actividades.practica);
}

// ─────────────────────────────────────────────
// CÓDIGO PLAN INDIVIDUAL
// ─────────────────────────────────────────────
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

async function generarCodigoSecuencialPlan() {
  const codigoBase = await obtenerCodigoBasePlanIndividual();
  const partesBase = partirCodigo(codigoBase);

  const snap = await get(ref(db, "planesGenerados"));

  let maxSecuencia = 0;

  if (snap.exists()) {
    snap.forEach((snapCedula) => {
      snapCedula.forEach((snapPlan) => {
        const data = snapPlan.val();
        const codigoGuardado = String(data?.codigo || "").trim();

        if (!codigoGuardado) return;

        try {
          const partes = partirCodigo(codigoGuardado);
          if (partes.anio === partesBase.anio && partes.mes === partesBase.mes) {
            const sec = Number(partes.secuencia);
            if (!Number.isNaN(sec) && sec > maxSecuencia) {
              maxSecuencia = sec;
            }
          }
        } catch {
        }
      });
    });
  }

  return construirCodigo(partesBase, maxSecuencia + 1);
}

// ─────────────────────────────────────────────
// PLANES GENERADOS
// planesGenerados/{cedula}/{codigo}
// ─────────────────────────────────────────────
async function obtenerPlanExistente(cedula) {
  const snap = await get(ref(db, `planesGenerados/${cedula}`));
  if (!snap.exists()) return null;

  let ultimo = null;

  snap.forEach((child) => {
    const data = child.val();
    if (!ultimo) {
      ultimo = data;
      return;
    }

    const codigoActual = String(data?.codigo || "");
    const codigoUltimo = String(ultimo?.codigo || "");

    if (codigoActual.localeCompare(codigoUltimo, "es") > 0) {
      ultimo = data;
    }
  });

  return ultimo;
}

async function guardarPlanGenerado({
  docente,
  cedula,
  carrera,
  codigo,
  respuesta1,
  respuesta2,
  respuesta3,
  respuesta4,
  respuesta5,
  respuesta6,
  respuesta7,
  respuesta8,
  nombreFormacionEspecifica,
  nivelFormacionEspecifica,
  fechaInicioE,
  fechaFinE,
  nombreFormacionGenerica,
  nivelFormacionGenerica,
  fechaInicioG,
  fechaFinG
}) {
  const claveCodigo = limpiarClave(codigo);

  await set(ref(db, `planesGenerados/${cedula}/${claveCodigo}`), {
    docente,
    cedula,
    carrera,
    codigo,
    respuesta1,
    respuesta2,
    respuesta3,
    respuesta4,
    respuesta5,
    respuesta6,
    respuesta7,
    respuesta8,
    nombreFormacionEspecifica,
    nivelFormacionEspecifica,
    fechaInicioE,
    fechaFinE,
    nombreFormacionGenerica,
    nivelFormacionGenerica,
    fechaInicioG,
    fechaFinG
  });
}

// ─────────────────────────────────────────────
// GENERAR DOCX -> PDF
// ─────────────────────────────────────────────
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
// EVENTOS
// ─────────────────────────────────────────────
selectCarrera.addEventListener("change", async () => {
  const carrera = selectCarrera.value.trim();
  await cargarDatosAutomaticosDeCarrera(carrera);
});

btnReDescargar.addEventListener("click", async () => {
  if (!ultimoDocumento) return;

  try {
    estado.textContent = "Re-descargando PDF...";
    await generarDocumento(ultimoDocumento);
    estado.textContent = "Documento descargado correctamente";
  } catch (error) {
    console.error("Error en re-descarga:", error);
    estado.textContent = error.message || "Ocurrió un error al volver a descargar el documento";
  }
});

// ─────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  estado.textContent = "Generando plan individual...";
  btnReDescargar.classList.add("oculto");
  ultimoDocumento = null;

  const nombres = document.getElementById("nombres").value.trim();
  const carrera = document.getElementById("carrera").value.trim();
  const cedula = document.getElementById("cedula").value.trim();

  const respuesta1 = document.getElementById("respuesta1").value.trim();
  const respuesta2 = document.getElementById("respuesta2").value.trim();
  const respuesta3 = document.getElementById("respuesta3").value.trim();
  const respuesta4 = document.getElementById("respuesta4").value.trim();
  const respuesta5 = document.getElementById("respuesta5").value.trim();
  const respuesta6 = document.getElementById("respuesta6").value.trim();
  const respuesta7 = document.getElementById("respuesta7").value.trim();
  const respuesta8 = document.getElementById("respuesta8").value.trim();

  const nombreFormacionEspecifica = document.getElementById("nombreFormacionEspecifica").value.trim();
  const nivelFormacionEspecifica = document.getElementById("nivelFormacionEspecifica").value.trim();
  const fechaInicioE = document.getElementById("fechaInicioE").value.trim();
  const fechaFinE = document.getElementById("fechaFinE").value.trim();

  const nombreFormacionGenerica = document.getElementById("nombreFormacionGenerica").value.trim();
  const nivelFormacionGenerica = document.getElementById("nivelFormacionGenerica").value.trim();
  const fechaInicioG = document.getElementById("fechaInicioG").value.trim();
  const fechaFinG = document.getElementById("fechaFinG").value.trim();

  if (!nombres || !carrera || !cedula) {
    estado.textContent = "Complete los datos del docente";
    return;
  }

  if (!carreraActual) {
    estado.textContent = "Seleccione una carrera válida";
    return;
  }

  if (fechaFinE && fechaInicioE && fechaFinE < fechaInicioE) {
    estado.textContent = "La fecha fin específica no puede ser menor a la fecha inicio";
    return;
  }

  if (fechaFinG && fechaInicioG && fechaFinG < fechaInicioG) {
    estado.textContent = "La fecha fin genérica no puede ser menor a la fecha inicio";
    return;
  }

  try {
    const planExistente = await obtenerPlanExistente(cedula);

    const listaCapacitaciones = construirListaCapacitaciones(carreraActual);
    const actividades = obtenerActividadesDesdeCapacitaciones(carreraActual);

    if (planExistente) {
      estado.textContent = "Usted ya generó el plan individual. Puede volver a descargarlo.";
      ultimoDocumento = {
        Codigo: planExistente.codigo,
        NombresC: planExistente.docente,
        Nombresc: planExistente.docente,
        CarreraDocente: planExistente.carrera,
        Carreradocente: planExistente.carrera,

        Respuesta1: planExistente.respuesta1 || "",
        Respuesta2: planExistente.respuesta2 || "",
        Respuesta3: planExistente.respuesta3 || "",
        Respuesta4: planExistente.respuesta4 || "",
        Respuesta5: planExistente.respuesta5 || "",
        Respuesta6: planExistente.respuesta6 || "",
        Respuesta7: planExistente.respuesta7 || "",
        Respuesta8: planExistente.respuesta8 || "",

        capacitaciones: listaCapacitaciones.map((item, index) => ({
          contador: index + 1,
          nombre: item.nombre,
          horas: item.horas,
          fechaInicio: formatoFecha(item.fechaInicio),
          fechaFin: formatoFecha(item.fechaFin),
          fecha: construirRangoFechaTexto(item.fechaInicio, item.fechaFin),
          tipo: item.tipo,
          estado: item.estado
        })),

        Teoria: actividades.teoria,
        Practica: actividades.practica,

        NombreFormacionEspecifica: planExistente.nombreFormacionEspecifica || "",
        NivelFormacionEspecifica: planExistente.nivelFormacionEspecifica || "",
        FechaInicioE: formatoFecha(planExistente.fechaInicioE || ""),
        FechaFinE: formatoFecha(planExistente.fechaFinE || ""),

        NombreFormacionGenerica: planExistente.nombreFormacionGenerica || "",
        NivelFormacionGenerica: planExistente.nivelFormacionGenerica || "",
        FechaInicioG: formatoFecha(planExistente.fechaInicioG || ""),
        FechaFinG: formatoFecha(planExistente.fechaFinG || ""),

        "NombreFormaciónEspecifica": planExistente.nombreFormacionEspecifica || "",
        "NivelFormaciónEspecifica": planExistente.nivelFormacionEspecifica || "",
        "NombreFormaciónGenerica": planExistente.nombreFormacionGenerica || "",
        "NivelFormaciónGenerica": planExistente.nivelFormacionGenerica || ""
      };

      btnReDescargar.classList.remove("oculto");
      return;
    }

    const codigo = await generarCodigoSecuencialPlan();

    const dataDoc = {
      Codigo: codigo,
      NombresC: nombres,
      Nombresc: nombres,
      CarreraDocente: carrera,
      Carreradocente: carrera,

      Respuesta1: respuesta1,
      Respuesta2: respuesta2,
      Respuesta3: respuesta3,
      Respuesta4: respuesta4,
      Respuesta5: respuesta5,
      Respuesta6: respuesta6,
      Respuesta7: respuesta7,
      Respuesta8: respuesta8,

      capacitaciones: listaCapacitaciones.map((item, index) => ({
        contador: index + 1,
        nombre: item.nombre,
        horas: item.horas,
        fechaInicio: formatoFecha(item.fechaInicio),
        fechaFin: formatoFecha(item.fechaFin),
        fecha: construirRangoFechaTexto(item.fechaInicio, item.fechaFin),
        tipo: item.tipo,
        estado: item.estado
      })),

      Teoria: actividades.teoria,
      Practica: actividades.practica,

      NombreFormacionEspecifica: nombreFormacionEspecifica,
      NivelFormacionEspecifica: nivelFormacionEspecifica,
      FechaInicioE: formatoFecha(fechaInicioE),
      FechaFinE: formatoFecha(fechaFinE),

      NombreFormacionGenerica: nombreFormacionGenerica,
      NivelFormacionGenerica: nivelFormacionGenerica,
      FechaInicioG: formatoFecha(fechaInicioG),
      FechaFinG: formatoFecha(fechaFinG),

      "NombreFormaciónEspecifica": nombreFormacionEspecifica,
      "NivelFormaciónEspecifica": nivelFormacionEspecifica,
      "NombreFormaciónGenerica": nombreFormacionGenerica,
      "NivelFormaciónGenerica": nivelFormacionGenerica
    };

    await guardarPlanGenerado({
      docente: nombres,
      cedula,
      carrera,
      codigo,
      respuesta1,
      respuesta2,
      respuesta3,
      respuesta4,
      respuesta5,
      respuesta6,
      respuesta7,
      respuesta8,
      nombreFormacionEspecifica,
      nivelFormacionEspecifica,
      fechaInicioE,
      fechaFinE,
      nombreFormacionGenerica,
      nivelFormacionGenerica,
      fechaInicioG,
      fechaFinG
    });

    ultimoDocumento = dataDoc;
    await generarDocumento(dataDoc);

    estado.textContent = "Plan individual generado correctamente ✔";
    btnReDescargar.classList.remove("oculto");
  } catch (error) {
    console.error("Error:", error);
    estado.textContent = error.message || "Ocurrió un error al generar el plan individual";
  }
});

cargarCarreras();