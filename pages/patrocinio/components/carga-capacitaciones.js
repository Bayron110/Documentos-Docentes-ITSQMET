
// ─────────────────────────────────────────────
// CARRERAS Y CAPACITACIONES (MODIFICADA: filtra las ya completadas por la cédula)
// ─────────────────────────────────────────────

export async function cargarTodasLasCapacitaciones(carreraFiltro = null) {
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