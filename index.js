import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const db = getDatabase(app);

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
  if (!card || !overlay || !boton) return;

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

function bloquearTodo(mensaje = "No se encontró configuración. Contacte al administrador.") {
  if (estadoCarga) estadoCarga.textContent = mensaje;

  aplicarBloqueo(cardPatrocinio, overlayPatrocinio, btnPatrocinio, false);
  aplicarBloqueo(cardPlan, overlayPlan, btnPlan, false);
  aplicarBloqueo(cardSeguimiento, overlaySeguimiento, btnSeguimiento, false);
}

function escucharPermisos() {
  const refActivador = ref(db, "Activador");

  onValue(
    refActivador,
    (snap) => {
      if (!snap.exists()) {
        bloquearTodo();
        return;
      }

      const formularios = snap.val() || {};

      aplicarBloqueo(
        cardPatrocinio,
        overlayPatrocinio,
        btnPatrocinio,
        formularios.patrocinio === true
      );

      aplicarBloqueo(
        cardPlan,
        overlayPlan,
        btnPlan,
        formularios.planIndividual === true
      );

      aplicarBloqueo(
        cardSeguimiento,
        overlaySeguimiento,
        btnSeguimiento,
        formularios.seguimientoDocente === true
      );

      if (estadoCarga) estadoCarga.textContent = "";
    },
    (error) => {
      console.error("Error al escuchar permisos:", error);
      bloquearTodo("No se pudo cargar la configuración.");
    }
  );
}

btnPatrocinio?.addEventListener("click", () => {
  if (!btnPatrocinio.disabled) {
    window.location.href = "pages/patrocinio/patrocinio.html";
  }
});

btnPlan?.addEventListener("click", () => {
  if (!btnPlan.disabled) {
    window.location.href = "pages/PIndividual/pIndividual.html";
  }
});

btnSeguimiento?.addEventListener("click", () => {
  if (!btnSeguimiento.disabled) {
    window.location.href = "pages/seguimientoD/seguimiento.html";
  }
});

escucharPermisos();