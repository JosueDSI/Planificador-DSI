// Previsualización de contenedores (skeleton shimmer) mientras llegan los datos.
const Bloque = ({ ancho = "100%", alto = 12, radio = 6, className = "" }) => (
  <div className={`fb-skeleton-shimmer ${className}`} style={{ width: ancho, height: alto, borderRadius: radio }} />
);

export default function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Cargando el planificador…</span>
      <div className="app-header">
        <div className="app-contenedor d-flex justify-content-between align-items-center gap-3 py-2">
          <div className="d-flex align-items-center gap-3">
            <Bloque ancho={120} alto={32} />
            <div className="d-none d-sm-block">
              <Bloque ancho={150} alto={18} radio={4} className="mb-1" />
              <Bloque ancho={110} alto={11} radio={4} />
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Bloque ancho={34} alto={34} radio={999} />
            <Bloque ancho={72} alto={30} />
          </div>
        </div>
      </div>

      <main className="app-contenedor py-3 py-md-4" aria-hidden="true">
        <div className="surface p-3 mb-3">
          <div className="row g-2">
            <div className="col-12 col-lg">
              <Bloque alto={38} />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div className="col-6 col-md-3 col-lg-2" key={i}>
                <Bloque alto={38} />
              </div>
            ))}
          </div>
        </div>

        <div className="d-flex gap-2 mb-3">
          {[1, 2, 3].map((i) => (
            <Bloque key={i} ancho={100} alto={36} radio={8} />
          ))}
        </div>

        <div className="row g-2 g-xl-3 mb-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div className="col-6 col-md-4 col-xl-2" key={i}>
              <div className="surface p-3" style={{ minHeight: 112 }}>
                <Bloque ancho={60} alto={11} radio={4} className="mb-3" />
                <Bloque ancho={56} alto={30} className="mb-2" />
                <Bloque ancho={90} alto={10} radio={4} />
              </div>
            </div>
          ))}
        </div>

        <div className="row g-3">
          <div className="col-lg-6">
            <div className="surface p-4 d-flex align-items-center gap-4">
              <Bloque ancho={150} alto={150} radio={999} />
              <div className="flex-grow-1 d-flex flex-column gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Bloque key={i} alto={34} radio={8} />
                ))}
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="surface p-4 d-flex flex-column gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <Bloque ancho="40%" alto={12} radio={4} className="mb-2" />
                  <Bloque alto={8} radio={999} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
