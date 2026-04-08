/**
 * Centinela — Base de datos de Marcas Oficiales
 * Usada para detectar suplantaciones de identidad (Phishing)
 */

export const OFFICIAL_BRANDS = [
    { name: 'Amazon', domains: ['amazon.com', 'amazon.es', 'amazon.de', 'amazon.it'] },
    { name: 'CaixaBank', domains: ['caixabank.es', 'caixabank.com'] },
    { name: 'BBVA', domains: ['bbva.es', 'bbva.com', 'bbvacontinental.com'] },
    { name: 'Santander', domains: ['bancosantander.es', 'santander.com', 'santanderbank.com'] },
    { name: 'PayPal', domains: ['paypal.com', 'paypal.es'] },
    { name: 'Netflix', domains: ['netflix.com'] },
    { name: 'Microsoft', domains: ['microsoft.com', 'live.com', 'outlook.com', 'microsoftonline.com'] },
    { name: 'Google', domains: ['google.com', 'gmail.com', 'google.es'] },
    { name: 'Apple', domains: ['apple.com', 'icloud.com'] },
    { name: 'Correos', domains: ['correos.es', 'correos.com'] },
    { name: 'Agencia Tributaria', domains: ['agenciatributaria.es', 'aeat.es'] },
    { name: 'Seguridad Social', domains: ['seg-social.es', 'seg-social.gob.es'] },
    { name: 'Endesa', domains: ['endesa.com', 'endesa.es'] },
    { name: 'Iberdrola', domains: ['iberdrola.es', 'iberdrola.com'] },
    { name: 'Disney+', domains: ['disneyplus.com'] },
    { name: 'Facebook / Meta', domains: ['facebook.com', 'fb.com', 'instagram.com', 'whatsapp.com'] },
    { name: 'DHL', domains: ['dhl.com', 'dhl.es'] },
    { name: 'FedEx', domains: ['fedex.com'] }
];

/**
 * Comprueba si un dominio es una suplantación de una marca conocida
 * @param {string} domain 
 * @returns {object|null} { brandName, isOfficial, suspicious }
 */
export function checkBrandIdentity(domain) {
    if (!domain) return null;
    
    domain = domain.toLowerCase();

    for (const brand of OFFICIAL_BRANDS) {
        // 1. ¿Es el dominio oficial?
        const isOfficial = brand.domains.some(d => domain === d || domain.endsWith('.' + d));
        if (isOfficial) {
            return { brandName: brand.name, isOfficial: true };
        }

        // 2. ¿Es una suplantación?
        // Buscamos si el nombre de la marca está contenido en el dominio
        const brandKey = brand.name.toLowerCase().replace(/\s/g, '').replace(/[+]/g, '');
        
        // Si el dominio contiene el nombre de la marca pero no es oficial -> Sospechoso
        // Ejemplo: "caixabank-login.tk" o "verificar-amazon.xyz"
        if (domain.includes(brandKey)) {
            return { brandName: brand.name, isOfficial: false, suspicious: true };
        }

        // 3. Detección de variaciones comunes (Typosquatting sencillo)
        // Por ejemplo, si el dominio se parece mucho a la marca pero tiene una letra distinta
        if (isSimilar(domain, brandKey)) {
            return { brandName: brand.name, isOfficial: false, suspicious: true };
        }
    }

    return null;
}

/**
 * Compara si dos cadenas son muy similares (útil para detectar amaz0n, caixabanc, etc)
 */
function isSimilar(domain, brand) {
    // Si es demasiado corto no comparamos
    if (brand.length < 4) return false;

    // Si el nombre de la marca está "casi" ahí (ej: caixabanc -> caixabank)
    // Usamos una lógica de inclusión parcial o distancia mínima
    const domainBody = domain.split('.')[0];
    
    if (domainBody.length < 3) return false;

    // Caso 1: Una letra de diferencia (simplificado)
    if (levenshteinDistance(domainBody, brand) === 1) return true;

    return false;
}

/**
 * Cálculo de distancia Levenshtein para medir similitud de texto
 */
function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }

    return matrix[b.length][a.length];
}
