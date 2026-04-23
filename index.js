import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyANtWmjXdlHkf-LO4t2gtpyymmjeEr2emI",
  authDomain: "repaso-fire-d8ceb.firebaseapp.com",
  databaseURL: "https://repaso-fire-d8ceb-default-rtdb.firebaseio.com",
  projectId: "repaso-fire-d8ceb",
  storageBucket: "repaso-fire-d8ceb.firebasestorage.app",
  messagingSenderId: "1080713449199",
  appId: "1:1080713449199:web:a94fd6c6e26766b4e2551a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app, firebaseConfig.databaseURL);

const estadoCarga = document.getElementById("estadoCarga");
const cardPatrocinio = document.getElementById("cardPatrocinio");
const cardPlan = document.getElementById("cardPlan");
const cardSeguimiento = document.getElementById("cardSeguimiento");
const overlayPatrocinio = document.getElementById("overlayPatrocinio");
const overlayPlan = document.getElementById("overlayPlan");
const overlaySeguimiento = document.getElementById("overlaySeguimiento");
const btnPatrocinio = document.getElementById("btnPatrocinio");
const btnPlan = document.getElementById("btnPlan");
const btnSeguimiento = document.getElementById("btnSeguimiento");

function aplicarBloqueo(card, overlay, boton, habilitado) {
  if (habilitado) {
    card.classList.remove("bloqueada");
    overlay.classList.add("oculto");
    boton.disabled = false;
  } else {
    card.classList.add("bloqueada");
    overlay.classList.remove("oculto");
    boton.disabled = true;
  }
}

async function cargarPermisos() {
  try {
    const snap = await get(ref(db, "config/formularios"));

    if (!snap.exists()) {
      estadoCarga.textContent = "No se encontró configuración. Contacte al administrador.";
      return;
    }

    const formularios = snap.val();

    aplicarBloqueo(cardPatrocinio, overlayPatrocinio, btnPatrocinio, !!formularios.patrocinio);
    aplicarBloqueo(cardPlan, overlayPlan, btnPlan, !!formularios.planIndividual);
    aplicarBloqueo(cardSeguimiento, overlaySeguimiento, btnSeguimiento, !!formularios.seguimientoDocente);

    estadoCarga.textContent = "";
  } catch (error) {
    console.error("Error al cargar permisos:", error);
    estadoCarga.textContent = "No se pudo cargar la configuración.";
  }
}

btnPatrocinio.addEventListener("click", () => {
  if (!btnPatrocinio.disabled) window.location.href = "pages/patrocinio/patrocinio.html";
});
btnPlan.addEventListener("click", () => {
  if (!btnPlan.disabled) window.location.href = "pages/PIndividual/pIndividual.html";
});
btnSeguimiento.addEventListener("click", () => {
  if (!btnSeguimiento.disabled) window.location.href = "pages/seguimientoD/seguimiento.html";
});

cargarPermisos();