/**
 * Centinela — Tips de Seguridad
 * Base de datos de consejos educativos para el usuario
 */

const TIPS = [
    "Los bancos NUNCA te pedirán tu contraseña por SMS o email.",
    "Si un enlace tiene faltas de ortografía en el dominio (ej: amaz0n.com), es muy sospechoso.",
    "Desconfía de mensajes que te meten prisa: \"¡Tienes 24 horas para reclamar tu premio!\"",
    "Antes de hacer clic en un enlace, mira bien la dirección web. Los estafadores usan direcciones muy parecidas a las reales.",
    "Si recibes un SMS de tu banco con un enlace, no lo abras. Llama directamente al banco.",
    "Las ofertas demasiado buenas para ser verdad, suelen ser estafas.",
    "Nunca compartas tu PIN, contraseña o código de verificación con nadie, ni por teléfono.",
    "Si una web te pide datos personales nada más entrar, sal de ahí.",
    "Los códigos QR también pueden llevar a sitios peligrosos. Siempre compruébalos.",
    "Correos de Hacienda, Correos o tu banco pidiendo datos urgentes suelen ser phishing.",
    "Si alguien te escribe por WhatsApp diciendo que es un familiar y necesita dinero urgente, llámale por teléfono para confirmarlo.",
    "Activa la verificación en dos pasos en todas tus cuentas importantes.",
    "No te fíes de los anuncios que prometen dinero fácil en redes sociales.",
    "Si un amigo te envía un enlace raro sin contexto, pregúntale antes de abrirlo. Puede que le hayan hackeado.",
    "Las webs seguras empiezan por https:// y tienen un candado 🔒 en la barra del navegador.",
    "Nunca descargues apps fuera de la tienda oficial de tu teléfono (Google Play o App Store).",
    "Si te llaman diciendo que son de Microsoft o Apple y que tu ordenador tiene un virus, es una estafa.",
    "Cambia tus contraseñas de vez en cuando y no uses la misma para todo.",
    "Un enlace acortado (bit.ly, tinyurl) puede esconder una dirección peligrosa. Compruébalo aquí.",
    "Si un email tiene adjuntos que no esperabas, no los abras.",
];

let lastTipIndex = -1;

/**
 * Devuelve un tip aleatorio diferente al último mostrado
 * @returns {string}
 */
export function getRandomTip() {
    let index;
    do {
        index = Math.floor(Math.random() * TIPS.length);
    } while (index === lastTipIndex && TIPS.length > 1);
    lastTipIndex = index;
    return TIPS[index];
}

/**
 * Devuelve todos los tips
 * @returns {string[]}
 */
export function getAllTips() {
    return [...TIPS];
}
