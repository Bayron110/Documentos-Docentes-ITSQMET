import { db } from "../../firebase/firebase.js";

import {
  ref,
  get,
  set,
  push
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const form = document.getElementById("formPlanIndividual");
const estado = document.getElementById("estado");

const listaCapacitaciones = document.getElementById("listaCapacitaciones");
const listaTeoria = document.getElementById("listaTeoria");
const listaPractica = document.getElementById("listaPractica");

const btnAgregarCapacitacion = document.getElementById("btnAgregarCapacitacion");
const btnAgregarTeoria = document.getElementById("btnAgregarTeoria");
const btnAgregarPractica = document.getElementById("btnAgregarPractica");

let capacitacionesCatalogo = [];
let planExistenteDatos = null;

window.volver = () => window.location.href = "../../index.html";

function limpiarNombreArchivo(texto) {
  return String(texto || "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatearFecha(fecha) {
  if (!fecha) return "";
  const partes = fecha.split("-");
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function textoSeguro(valor) {
  return String(valor || "").trim();
}

function validarLibreriasDocumento() {
  if (typeof window.PizZip === "undefined") {
    throw new Error("La librería PizZip no está cargada. Revisa el HTML.");
  }

  if (typeof window.docxtemplater === "undefined") {
    throw new Error("La librería docxtemplater no está cargada. Revisa el HTML.");
  }

  if (typeof window.saveAs === "undefined") {
    throw new Error("La librería FileSaver no está cargada. Revisa el HTML.");
  }
}

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

async function cargarCatalogoCap() {
  try {
    const snap = await get(ref(db, "capacitaciones"));
    capacitacionesCatalogo = [];

    if (snap.exists()) {
      snap.forEach((child) => {
        const data = child.val();
        if (!data?.nombre) return;

        const teoricasRaw = data.actividadesTeoricasArr;
        const practicasRaw = data.actividadesPracticasArr;

        const actividadesTeoricasArr = teoricasRaw
          ? (Array.isArray(teoricasRaw) ? teoricasRaw : Object.values(teoricasRaw))
          : [];

        const actividadesPracticasArr = practicasRaw
          ? (Array.isArray(practicasRaw) ? practicasRaw : Object.values(practicasRaw))
          : [];

        capacitacionesCatalogo.push({
          id: child.key,
          nombre: data.nombre,
          actividadesTeoricasArr,
          actividadesPracticasArr
        });
      });
    }
  } catch (error) {
    console.error("Error al cargar capacitaciones:", error);
  }
}

async function validarFormulario() {
  const snap = await get(ref(db, "config/formularios"));

  if (!snap.exists()) {
    throw new Error("No existe la configuración de formularios");
  }

  const forms = snap.val();

  if (!forms.planIndividual) {
    throw new Error("Formulario de plan individual deshabilitado");
  }
}

async function buscarPlanExistente(cedula) {
  const snap = await get(ref(db, "registrosPlanIndividual"));

  if (!snap.exists()) return null;

  const cedulaBuscada = textoSeguro(cedula);
  let encontrado = null;

  snap.forEach((child) => {
    const data = child.val();
    const cedulaGuardada = textoSeguro(data?.cedula);

    if (cedulaGuardada === cedulaBuscada) {
      encontrado = { id: child.key, ...data };
    }
  });

  return encontrado;
}

async function obtenerConfigGeneral() {
  const snap = await get(ref(db, "config/general"));

  if (!snap.exists()) {
    return {
      anio: String(new Date().getFullYear()),
      mes: String(new Date().getMonth() + 1).padStart(2, "0"),
      fecha1Texto: ""
    };
  }

  const data = snap.val();

  return {
    anio: textoSeguro(data.anio || new Date().getFullYear()),
    mes: textoSeguro(data.mes || String(new Date().getMonth() + 1).padStart(2, "0")).padStart(2, "0"),
    fecha1Texto: textoSeguro(data.fecha1Texto || "")
  };
}

async function obtenerConfigCodigoPlan() {
  const snap = await get(ref(db, "config/codigos/planIndividual"));

  if (!snap.exists()) {
    return {
      prefijo: "UGPA",
      bloque: "RGI2",
      proceso: "PRO",
      consecutivoFijo: "251"
    };
  }

  const data = snap.val();

  return {
    prefijo: textoSeguro(data.prefijo || "UGPA"),
    bloque: textoSeguro(data.bloque || "RGI2"),
    proceso: textoSeguro(data.proceso || "PRO"),
    consecutivoFijo: textoSeguro(data.consecutivoFijo || "251")
  };
}

async function generarCodigoSecuencial() {
  try {
    const configGeneral = await obtenerConfigGeneral();
    const configCodigo = await obtenerConfigCodigoPlan();

    const { anio, mes } = configGeneral;
    const { prefijo, bloque, proceso, consecutivoFijo } = configCodigo;

    const snap = await get(ref(db, "registrosPlanIndividual"));
    let maxSecuencia = 0;

    if (snap.exists()) {
      snap.forEach((child) => {
        const data = child.val();
        const codigo = textoSeguro(data?.codigo);

        if (!codigo) return;

        const partes = codigo.split("-");
        if (partes.length < 7) return;

        const secuencia = parseInt(partes[2], 10);
        const codigoAnio = textoSeguro(partes[5]);
        const codigoMes = textoSeguro(partes[6]).padStart(2, "0");

        if (codigoAnio === anio && codigoMes === mes) {
          if (!isNaN(secuencia) && secuencia > maxSecuencia) {
            maxSecuencia = secuencia;
          }
        }
      });
    }

    const siguienteSecuencia = maxSecuencia + 1;
    const sec = String(siguienteSecuencia).padStart(2, "0");

    return `${prefijo}-${bloque}-${sec}-${proceso}-${consecutivoFijo}-${anio}-${mes}`;
  } catch (error) {
    console.error("Error generando código:", error);
    throw new Error("No se pudo generar el código del plan individual");
  }
}

function obtenerCapacitaciones() {
  const items = [...document.querySelectorAll(".capacitacion-item")];

  return items.map((item, index) => {
    const nombre = textoSeguro(item.querySelector(".cap-nombre")?.value);
    const horas = textoSeguro(item.querySelector(".cap-horas")?.value);
    const fecha = formatearFecha(item.querySelector(".cap-fecha")?.value);
    const tipo = textoSeguro(item.querySelector(".cap-tipo")?.value);

    return {
      contador: index + 1,
      nombre,
      horas,
      fecha,
      tipo
    };
  }).filter(item => item.nombre && item.horas && item.fecha && item.tipo);
}

function distribuirActividades(nombresCap) {
  const capConDatos = nombresCap.map(nombre => {
    const cat = capacitacionesCatalogo.find(c => c.nombre === nombre);
    return cat || { nombre, actividadesTeoricasArr: [], actividadesPracticasArr: [] };
  });

  const capConActividades = capConDatos.filter(
    c => c.actividadesTeoricasArr.length > 0 || c.actividadesPracticasArr.length > 0
  ).slice(0, 3);

  const totalCap = capConActividades.length;

  let teoricasFinal = [];
  let practicasFinal = [];

  if (totalCap === 0) {
    return null;
  } else if (totalCap === 1) {
    teoricasFinal = capConActividades[0].actividadesTeoricasArr.slice(0, 3);
    practicasFinal = capConActividades[0].actividadesPracticasArr.slice(0, 3);
  } else if (totalCap === 2) {
    teoricasFinal = [
      capConActividades[0].actividadesTeoricasArr[0],
      capConActividades[0].actividadesTeoricasArr[1],
      capConActividades[1].actividadesTeoricasArr[0]
    ].filter(Boolean);

    practicasFinal = [
      capConActividades[0].actividadesPracticasArr[0],
      capConActividades[0].actividadesPracticasArr[1],
      capConActividades[1].actividadesPracticasArr[0]
    ].filter(Boolean);
  } else {
    for (let i = 0; i < 3; i++) {
      const cap = capConActividades[i];
      if (cap) {
        if (cap.actividadesTeoricasArr[0]) teoricasFinal.push(cap.actividadesTeoricasArr[0]);
        if (cap.actividadesPracticasArr[0]) practicasFinal.push(cap.actividadesPracticasArr[0]);
      }
    }
  }

  return { teoria: teoricasFinal, practica: practicasFinal };
}

function obtenerListaSimple(selector) {
  return [...document.querySelectorAll(selector)]
    .map((input) => textoSeguro(input.value))
    .filter((texto) => texto.length > 0);
}

function validarListasDinamicas() {
  const capacitaciones = obtenerCapacitaciones();

  if (capacitaciones.length === 0) {
    throw new Error("Debe ingresar al menos una capacitación propuesta");
  }

  const nombresCap = capacitaciones.map(c => c.nombre);
  const distribuidas = distribuirActividades(nombresCap);

  let teoria;
  let practica;

  if (distribuidas) {
    teoria = distribuidas.teoria;
    practica = distribuidas.practica;
  } else {
    teoria = obtenerListaSimple(".teoria-input");
    practica = obtenerListaSimple(".practica-input");
  }

  if (teoria.length === 0) {
    throw new Error("No se encontraron actividades teóricas para las capacitaciones seleccionadas");
  }

  if (practica.length === 0) {
    throw new Error("No se encontraron actividades prácticas para las capacitaciones seleccionadas");
  }

  return { capacitaciones, teoria, practica };
}

async function guardarRegistro(nombre, cedula, carrera, codigo, datoCompleto) {
  await set(push(ref(db, "registrosPlanIndividual")), {
    docente: nombre,
    cedula,
    carrera,
    codigo,
    fechaCreacion: new Date().toLocaleDateString("es-EC"),
    horaCreacion: new Date().toLocaleTimeString("es-EC"),
    timestamp: Date.now(),
    tipo: "planIndividual",
    datosDocumento: datoCompleto
  });
}

function crearItemCapacitacion() {
  const div = document.createElement("div");
  div.className = "item-repetible capacitacion-item";

  let opcionesCatalogo = '<option value="">-- Seleccione una capacitación --</option>';
  if (capacitacionesCatalogo.length > 0) {
    capacitacionesCatalogo.forEach(c => {
      opcionesCatalogo += `<option value="${c.nombre}">${c.nombre}</option>`;
    });
  }

  const tienesCatalogo = capacitacionesCatalogo.length > 0;

  div.innerHTML = `
    <div class="grid-2">
      <div class="campo">
        <label>Nombre de capacitación propuesta</label>
        ${tienesCatalogo
          ? `<select class="cap-nombre" required>${opcionesCatalogo}</select>`
          : `<input type="text" class="cap-nombre" placeholder="Ej. Innovación educativa con TIC" required />`
        }
      </div>

      <div class="campo">
        <label>Horas de capacitación propuesta</label>
        <input type="number" class="cap-horas" min="1" placeholder="Ej. 40" required />
      </div>
    </div>

    <div class="grid-2">
      <div class="campo">
        <label>Fecha propuesta de ejecución</label>
        <input type="date" class="cap-fecha" required />
      </div>

      <div class="campo">
        <label>Tipo de capacitación propuesta</label>
        <select class="cap-tipo" required>
          <option value="">-- Seleccione una opción --</option>
          <option value="Interna">Interna</option>
          <option value="Externa">Externa</option>
          <option value="Virtual">Virtual</option>
          <option value="Presencial">Presencial</option>
          <option value="Híbrida">Híbrida</option>
        </select>
      </div>
    </div>

    <div class="acciones-item">
      <button type="button" class="btn-eliminar">Eliminar</button>
    </div>
  `;
  return div;
}

function crearItemSimple(tipo) {
  const div = document.createElement("div");
  div.className = `item-simple ${tipo}-item`;
  div.innerHTML = `
    <input type="text" class="${tipo}-input" placeholder="Ingrese una actividad ${tipo === 'teoria' ? 'teórica' : 'práctica'}" required />
    <button type="button" class="btn-eliminar">Eliminar</button>
  `;
  return div;
}

function actualizarPreviewActividades() {
  const items = [...document.querySelectorAll(".capacitacion-item")];
  const nombres = items
    .map(item => textoSeguro(item.querySelector(".cap-nombre")?.value))
    .filter(n => n.length > 0);

  if (nombres.length === 0 || capacitacionesCatalogo.length === 0) {
    mostrarActividadesPreview([], []);
    return;
  }

  const distribuidas = distribuirActividades(nombres);
  if (distribuidas) {
    mostrarActividadesPreview(distribuidas.teoria, distribuidas.practica);
  }
}

function mostrarActividadesPreview(teoricas, practicas) {
  const contenedor = document.getElementById("actividadesPreview");
  if (!contenedor) return;

  if (teoricas.length === 0 && practicas.length === 0) {
    contenedor.innerHTML = "";
    contenedor.style.display = "none";
    return;
  }

  contenedor.style.display = "block";
  contenedor.innerHTML = `
    <div class="preview-actividades-titulo">📋 Actividades que se incluirán en el documento</div>
    <div class="preview-actividades-grid">
      <div class="preview-col">
        <div class="preview-col-titulo">📖 Teóricas (${teoricas.length})</div>
        ${teoricas.map((a, i) => `<div class="preview-act">${i + 1}. ${a}</div>`).join("")}
      </div>
      <div class="preview-col">
        <div class="preview-col-titulo">🔧 Prácticas (${practicas.length})</div>
        ${practicas.map((a, i) => `<div class="preview-act practica">${i + 1}. ${a}</div>`).join("")}
      </div>
    </div>
  `;
}

function mostrarModalReDescarga(planExistente) {
  planExistenteDatos = planExistente;

  const modal = document.getElementById("modalReDescarga");
  const infoCodigo = document.getElementById("reDescargaCodigo");
  const infoFecha = document.getElementById("reDescargaFecha");

  if (infoCodigo) infoCodigo.textContent = planExistente.codigo || "—";
  if (infoFecha) infoFecha.textContent = planExistente.fechaCreacion || "—";

  if (modal) {
    modal.style.display = "flex";
  }
}

function cerrarModal() {
  const modal = document.getElementById("modalReDescarga");
  if (modal) modal.style.display = "none";
}

async function reDescargarPlan() {
  if (!planExistenteDatos?.datosDocumento) {
    estado.textContent = "No se encontraron los datos para regenerar el documento";
    cerrarModal();
    return;
  }

  try {
    estado.textContent = "Re-generando documento...";
    const datosDocumento = planExistenteDatos.datosDocumento;
    cerrarModal();
    await generarDocumento(datosDocumento);
    estado.textContent = "Documento re-descargado correctamente ✔";
    planExistenteDatos = null;
  } catch (error) {
    console.error("Error en re-descarga:", error);
    estado.textContent = error.message || "Error al re-descargar el documento";
  }
}

async function generarDocumento(data) {
  validarLibreriasDocumento();

  const response = await fetch("../../doc/individual.docx");

  if (!response.ok) {
    throw new Error("No se pudo cargar la plantilla del plan individual");
  }

  const content = await response.arrayBuffer();

  const zip = new window.PizZip(content);
  const doc = new window.docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });

  doc.render(data);

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  window.saveAs(blob, limpiarNombreArchivo(`${data.Codigo} ${data.NombresC}.docx`));
}

btnAgregarCapacitacion.addEventListener("click", () => {
  const nuevo = crearItemCapacitacion();
  listaCapacitaciones.appendChild(nuevo);

  const capNombre = nuevo.querySelector(".cap-nombre");
  if (capNombre) {
    capNombre.addEventListener("change", actualizarPreviewActividades);
  }
});

btnAgregarTeoria.addEventListener("click", () => {
  listaTeoria.appendChild(crearItemSimple("teoria"));
});

btnAgregarPractica.addEventListener("click", () => {
  listaPractica.appendChild(crearItemSimple("practica"));
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-eliminar");
  if (!btn) return;

  const item = btn.closest(".item-repetible, .item-simple");
  const contenedor = item?.parentElement;

  if (!item || !contenor) return;

  if (contenedor.children.length === 1) {
    estado.textContent = "Debe existir al menos un registro en esta sección";
    return;
  }

  item.remove();
  actualizarPreviewActividades();
});

document.addEventListener("change", (e) => {
  if (e.target.classList.contains("cap-nombre")) {
    actualizarPreviewActividades();
  }
});

document.getElementById("btnReDescargar")?.addEventListener("click", reDescargarPlan);
document.getElementById("btnCerrarModal")?.addEventListener("click", cerrarModal);
document.getElementById("btnCancelarModal")?.addEventListener("click", cerrarModal);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  estado.textContent = "Procesando...";

  const nombres = textoSeguro(document.getElementById("nombres")?.value);
  const carrera = textoSeguro(document.getElementById("carrera")?.value);
  const cedula = textoSeguro(document.getElementById("cedula")?.value);

  const respuesta1 = textoSeguro(document.getElementById("respuesta1")?.value);
  const respuesta2 = textoSeguro(document.getElementById("respuesta2")?.value);
  const respuesta3 = textoSeguro(document.getElementById("respuesta3")?.value);
  const respuesta4 = textoSeguro(document.getElementById("respuesta4")?.value);
  const respuesta5 = textoSeguro(document.getElementById("respuesta5")?.value);
  const respuesta6 = textoSeguro(document.getElementById("respuesta6")?.value);
  const respuesta7 = textoSeguro(document.getElementById("respuesta7")?.value);
  const respuesta8 = textoSeguro(document.getElementById("respuesta8")?.value);

  const nombreFormacionEspecifica = textoSeguro(document.getElementById("nombreFormacionEspecifica")?.value);
  const nivelFormacionEspecifica = textoSeguro(document.getElementById("nivelFormacionEspecifica")?.value);
  const fechaInicioE = formatearFecha(document.getElementById("fechaInicioE")?.value);
  const fechaFinE = formatearFecha(document.getElementById("fechaFinE")?.value);

  const nombreFormacionGenerica = textoSeguro(document.getElementById("nombreFormacionGenerica")?.value);
  const nivelFormacionGenerica = textoSeguro(document.getElementById("nivelFormacionGenerica")?.value);
  const fechaInicioG = formatearFecha(document.getElementById("fechaInicioG")?.value);
  const fechaFinG = formatearFecha(document.getElementById("fechaFinG")?.value);

  if (
    !nombres || !carrera || !cedula ||
    !respuesta1 || !respuesta2 || !respuesta3 || !respuesta4 ||
    !respuesta5 || !respuesta6 || !respuesta7 || !respuesta8 ||
    !nombreFormacionEspecifica || !nivelFormacionEspecifica || !fechaInicioE || !fechaFinE ||
    !nombreFormacionGenerica || !nivelFormacionGenerica || !fechaInicioG || !fechaFinG
  ) {
    estado.textContent = "Completa todos los campos obligatorios";
    return;
  }

  try {
    await validarFormulario();

    const planExistente = await buscarPlanExistente(cedula);
    if (planExistente) {
      mostrarModalReDescarga(planExistente);
      estado.textContent = "";
      return;
    }

    const { capacitaciones, teoria, practica } = validarListasDinamicas();
    const codigo = await generarCodigoSecuencial();

    const datosDocumento = {
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
      capacitaciones: capacitaciones,
      Teoria: teoria,
      Practica: practica,
      NombreFormaciónEspecifica: nombreFormacionEspecifica,
      NivelFormaciónEspecifica: nivelFormacionEspecifica,
      FechaInicioE: fechaInicioE,
      FechaFinE: fechaFinE,
      NombreFormaciónGenerica: nombreFormacionGenerica,
      NivelFormaciónGenerica: nivelFormacionGenerica,
      FechaInicioG: fechaInicioG,
      FechaFinG: fechaFinG
    };

    await generarDocumento(datosDocumento);
    await guardarRegistro(nombres, cedula, carrera, codigo, datosDocumento);

    estado.textContent = "Plan individual generado correctamente ✔";

    form.reset();
    await cargarCarreras();

    listaCapacitaciones.innerHTML = "";
    listaTeoria.innerHTML = "";
    listaPractica.innerHTML = "";

    const nuevoItemCap = crearItemCapacitacion();
    listaCapacitaciones.appendChild(nuevoItemCap);

    const nuevoSelect = nuevoItemCap.querySelector(".cap-nombre");
    if (nuevoSelect) {
      nuevoSelect.addEventListener("change", actualizarPreviewActividades);
    }

    listaTeoria.appendChild(crearItemSimple("teoria"));
    listaPractica.appendChild(crearItemSimple("practica"));

    mostrarActividadesPreview([], []);
  } catch (error) {
    console.error("Error:", error);
    estado.textContent = error.message || "Ocurrió un error al generar el plan individual";
  }
});

async function init() {
  await cargarCatalogoCap();
  await cargarCarreras();

  listaCapacitaciones.innerHTML = "";
  const primerItem = crearItemCapacitacion();
  listaCapacitaciones.appendChild(primerItem);

  const primerSelect = primerItem.querySelector(".cap-nombre");
  if (primerSelect) {
    primerSelect.addEventListener("change", actualizarPreviewActividades);
  }

  if (capacitacionesCatalogo.length > 0) {
    const seccionActividades = document.getElementById("seccionActividadesManuales");
    if (seccionActividades) {
      seccionActividades.style.display = "none";
    }
  }
}

init();