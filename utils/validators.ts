export const isValidCPF = (cpf: string): boolean => {
    if (!cpf) return false;

    // Remove non-digits
    const cleanCPF = cpf.replace(/[^\d]/g, '');

    // Check length
    if (cleanCPF.length !== 11) return false;

    // Check for known invalid CPFs (all same digits)
    if (/^(\d)\1+$/.test(cleanCPF)) return false;

    // Validate first digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCPF.charAt(9))) return false;

    // Validate second digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
};

export const isValidCNPJ = (cnpj: string): boolean => {
    if (!cnpj) return false;

    // Remove non-digits
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '');

    // Check length
    if (cleanCNPJ.length !== 14) return false;

    // Check for known invalid CNPJs (all same digits)
    if (/^(\d)\1+$/.test(cleanCNPJ)) return false;

    // Validate first digit
    let length = cleanCNPJ.length - 2;
    let numbers = cleanCNPJ.substring(0, length);
    const digits = cleanCNPJ.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    // Validate second digit
    length = length + 1;
    numbers = cleanCNPJ.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
};
