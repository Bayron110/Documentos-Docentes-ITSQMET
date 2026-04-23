(function () {
    const html = document.documentElement;
    const saved = localStorage.getItem("itsqmet-theme") || "light";
    html.setAttribute("data-theme", saved);

    document.addEventListener("DOMContentLoaded", () => {
        const btn = document.getElementById("themeToggle");
        if (!btn) return;

        btn.addEventListener("click", () => {
            const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
            html.setAttribute("data-theme", next);
            localStorage.setItem("itsqmet-theme", next);
        });
    });
})();