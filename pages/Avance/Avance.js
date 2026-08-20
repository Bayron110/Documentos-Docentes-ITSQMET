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
// RENDER DE UN REGISTRO (patrocinio o plan)
// ─────────────────────────────────────────────
function renderRegistro({ nombreDoc, detalle, entregado }) {
  const entregadoBool = entregado === true || entregado === "true";

  const div = document.createElement("div");
  div.className = "pregistro";
  div.innerHTML = `
    <div class="pregistro-info">
      <span class="pregistro-nombre">${nombreDoc}</span>
      <span class="pregistro-detalle">${detalle}</span>
    </div>
    <span class="pbadge-estado ${entregadoBool ? "entregado" : "pendiente"}">
      ${entregadoBool ? "Entregado" : "Pendiente"}
    </span>
  `;
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

    // ── Acuerdo de Patrocinio ──
    if (patrocinios.length === 0) {
      renderSinRegistro(listaPatrocinio, "Sin registros de Acuerdo de Patrocinio para esta cédula.");
    } else {
      patrocinios.forEach(p => {
        listaPatrocinio.appendChild(renderRegistro({
          nombreDoc: p.capacitacion || "Capacitación sin nombre",
          detalle:   `Carrera: ${p.carrera || "—"} · Código: ${p.codigo || "—"}`,
          entregado: p.entregado
        }));
      });
    }

    // ── Plan Individual ──
    if (planes.length === 0) {
      renderSinRegistro(listaPlan, "Sin registros de Plan Individual para esta cédula.");
    } else {
      planes.forEach(p => {
        listaPlan.appendChild(renderRegistro({
          nombreDoc: p.codigo || "Plan sin código",
          detalle:   `Carrera: ${p.carrera || "—"}`,
          entregado: p.entregado
        }));
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