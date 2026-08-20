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

const cardAvance = document.getElementById("cardAvance");
const overlayAvance = document.getElementById("overlayAvance");
const btnAvance = document.getElementById("btnAvance");

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

btnAvance?.addEventListener("click", () => {
  if (!btnAvance.disabled) {
    window.location.href = "pages/avance/avance.html";
  }
});

escucharPermisos();
// ─────────────────────────────────────────────
// CARRUSEL DE INSTRUCCIONES INICIAL
// ─────────────────────────────────────────────
const introModal = document.getElementById("introModal");
const introClose = document.getElementById("introClose");
const introPrev = document.getElementById("introPrev");
const introNext = document.getElementById("introNext");

const introSlides = document.querySelectorAll(".intro-slide");
const introDots = document.querySelectorAll(".intro-dots .dot");

let introIndex = 0;

function mostrarSlideIntro(index) {
  introSlides.forEach((slide, i) => {
    slide.classList.toggle("activo", i === index);
  });

  introDots.forEach((dot, i) => {
    dot.classList.toggle("activo", i === index);
  });
}

function cerrarIntro() {
  introModal?.classList.add("oculto");
}

introNext?.addEventListener("click", () => {
  introIndex = (introIndex + 1) % introSlides.length;
  mostrarSlideIntro(introIndex);
});

introPrev?.addEventListener("click", () => {
  introIndex = (introIndex - 1 + introSlides.length) % introSlides.length;
  mostrarSlideIntro(introIndex);
});

introClose?.addEventListener("click", cerrarIntro);

introDots.forEach((dot, i) => {
  dot.addEventListener("click", () => {
    introIndex = i;
    mostrarSlideIntro(introIndex);
  });
});

introModal?.addEventListener("click", (e) => {
  if (e.target === introModal) {
    cerrarIntro();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrarIntro();
  }
});

mostrarSlideIntro(introIndex);