// Export CSV des listes du panel admin pour analyse hors-ligne.
// Format compatible Excel (BOM UTF-8 + séparateur ,) ; les valeurs qui
// contiennent une virgule, un retour ligne ou un guillemet sont
// quotées et les guillemets internes échappés (RFC 4180).

function escape(v) {
  if (v === null || v === undefined) return ""
  if (v instanceof Date) return v.toISOString()
  const s = typeof v === "object" ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function rowsToCsv(rows, columns) {
  if (!rows || rows.length === 0) return ""
  // columns peut être : tableau de clés OU tableau de { key, label, accessor? }.
  const cols = (columns || Object.keys(rows[0])).map(c =>
    typeof c === "string" ? { key: c, label: c } : c
  )
  const header = cols.map(c => escape(c.label)).join(",")
  const lines  = rows.map(r =>
    cols.map(c => escape(c.accessor ? c.accessor(r) : r[c.key])).join(",")
  )
  return [header, ...lines].join("\r\n")
}

export function downloadCsv(rows, filename = "export.csv", columns) {
  if (!rows || rows.length === 0) return
  const csv = rowsToCsv(rows, columns)
  const bom = "﻿" // signal Excel pour décoder en UTF-8
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement("a")
  a.href     = url
  a.download = filename
  a.rel      = "noopener"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

// Bouton réutilisable : affiche « 📥 CSV » et déclenche le download.
// `getRows` est lazy pour ne déclencher la sérialisation qu'au clic.
export function ExportCsvButton({ getRows, filename, columns, disabled, style }) {
  const onClick = () => {
    const rows = typeof getRows === "function" ? getRows() : getRows
    if (!rows || rows.length === 0) return
    const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")
    downloadCsv(rows, filename || `export-${ts}.csv`, columns)
  }
  return (
    <button onClick={onClick} disabled={disabled}
      title="Télécharger en CSV (compatible Excel)"
      style={{
        background: "#FAF7F2", border: "1px solid #E8E2D8", borderRadius: 8,
        padding: "4px 10px", fontSize: 11, color: "#6B6358",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit",
        ...style,
      }}>
      📥 CSV
    </button>
  )
}
