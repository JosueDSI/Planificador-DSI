import { duracion, minutos } from "./utils";

// Genera el reporte diario en Excel. La librería xlsx (~400 KB) se carga bajo
// demanda para no inflar el bundle inicial de la aplicación.
export async function exportarAgendaDia(actividadesDia, { dia, areaNombre, usuarioNombre }) {
  const XLSX = await import("xlsx");

  const cerradas = actividadesDia.filter((a) => a.estado?.es_cierre).length;
  const enProgreso = actividadesDia.filter((a) => a.estado?.columna === "en_progreso").length;
  const pendientes = actividadesDia.length - cerradas - enProgreso;
  const totalMin = actividadesDia.reduce((acc, act) => acc + Math.max(0, minutos(act.hora_fin) - minutos(act.hora_inicio)), 0);

  const filas = [
    ["AMPHOS 21 - PLANIFICADOR DSI - REPORTE DIARIO DE ACTIVIDADES"],
    [`Área: ${areaNombre || "Departamento de Sistemas e Informática (DSI)"} | Fecha: ${dia} | Generado por: ${usuarioNombre || "Usuario"}`],
    [],
    [
      "RESUMEN EJECUTIVO",
      `Total tareas: ${actividadesDia.length}`,
      `Completadas: ${cerradas}`,
      `En curso: ${enProgreso}`,
      `Pendientes: ${pendientes}`,
      `Tiempo agendado: ${Math.floor(totalMin / 60)}h ${totalMin % 60}m`,
    ],
    [],
    [
      "Clave",
      "Título de la Actividad",
      "Categoría",
      "Prioridad",
      "Estado",
      "Horario",
      "Duración",
      "Responsable Asignado",
      "Puesto / Cargo",
      "Solicitado Por",
      "Subtareas",
      "Observaciones",
    ],
  ];

  actividadesDia.forEach((act) => {
    const dur = duracion(act);
    const hechas = act.checklist?.filter((c) => c.hecho).length || 0;
    const totalCheck = act.checklist?.length || 0;
    filas.push([
      act.clave,
      act.titulo || "",
      act.categoria?.nombre || "",
      act.prioridad?.nombre || "",
      act.estado?.nombre || "",
      `${act.hora_inicio} - ${act.hora_fin}`,
      `${Math.floor(dur / 60)}h ${dur % 60}m`,
      act.asignado_a?.nombre || "Sin asignar",
      act.asignado_a?.puesto_nombre || act.asignado_a?.etiqueta_rol || "-",
      act.reportado_por?.nombre || "",
      totalCheck ? `${hechas}/${totalCheck}` : "-",
      act.observaciones || "",
    ]);
  });

  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  hoja["!cols"] = [12, 40, 18, 14, 16, 16, 12, 24, 28, 22, 12, 38].map((wch) => ({ wch }));
  hoja["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
  ];
  XLSX.utils.book_append_sheet(libro, hoja, `Agenda_${dia}`);
  XLSX.writeFile(libro, `Planificador_DSI_${dia}.xlsx`);
}
