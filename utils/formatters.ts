export const formatCNPJ = (cnpj: string): string => {
    if (!cnpj) return "";

    // Remove invalid chars
    const clean = cnpj.replace(/\D/g, "");

    // Return standard format: XX.XXX.XXX/YYYY-ZZ
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};
