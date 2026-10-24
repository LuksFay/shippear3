// Documento según el tipo de usuario elegido en el login.
//   ciudadano → DNI (7 u 8 números)
//   entidad   → CUIT/CUIL (11 números con dígito verificador)

export const soloNumeros = (v) => String(v ?? "").replace(/\D/g, "");

export function cuitValido(c) {
  if (!/^\d{11}$/.test(c)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((acc, k, i) => acc + k * Number(c[i]), 0);
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) return false;
  return dv === Number(c[10]);
}

// Documento enmascarado para mostrar en pantalla (cabecera): DNI ***.***.222 · CUIT 30-****-2.
export function maskDoc(doc, role) {
  const d = soloNumeros(doc);
  if (!d) return "";
  if (role === "entidad" && d.length === 11) return `CUIT ${d.slice(0, 2)}-****-${d.slice(10)}`;
  return `DNI ***.***.${d.slice(-3)}`;
}

export function formatDoc(doc, role) {
  const d = soloNumeros(doc);
  if (role === "entidad" && d.length === 11) return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
