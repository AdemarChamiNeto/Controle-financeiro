const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata um valor em reais no padrão brasileiro: 1234.5 → "R$ 1.234,50". */
export const brl = (value: number) => brlFormatter.format(Number.isFinite(value) ? value : 0);
