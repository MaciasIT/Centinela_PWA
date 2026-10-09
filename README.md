# 🛡️ Centinela — Tu guardián digital contra enlaces sospechosos

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](package.json)
[![PWA](https://img.shields.io/badge/PWA-offline--first-success.svg)](manifest.json)
[![Accessibility](https://img.shields.io/badge/WCAG-2.1%20AA-brightgreen.svg)](docs/CUMPLIMIENTO.md)
[![Privacy](https://img.shields.io/badge/Privacy-0%20Tracking-orange.svg)](docs/PRIVACIDAD.md)
[![Tests](https://img.shields.io/badge/tests-254%20passed-brightgreen.svg)](tests/)

**Centinela** es una Progressive Web App (PWA) móvil y desktop de seguridad preventiva diseñada para proteger a usuarios frente a ataques de **phishing, smishing, QRishing y enlaces maliciosos**.

Analiza URLs sospechosas en tiempo real directamente en el dispositivo (100% offline-first y con total privacidad), explicando el veredicto en lenguaje claro y accesible para cualquier persona.

🌐 **Despliegue en producción:** [https://centinela-pwa.pages.dev](https://centinela-pwa.pages.dev)

---

## ✨ Características principales

- **🔍 Análisis heurístico multinivel en cliente:**
  - Detección de caracteres homoglíficos y ataques IDN / punycode.
  - Identificación de typosquatting y suplantación de marcas conocidas.
  - Detección de acortadores de URL y redirecciones opacas.
  - Análisis de parámetros sospechosos (tokens expuestos, payloads ofuscados, subdominios fraudulentos).
  - Evaluación de TLDs de alto riesgo.

- **📷 Escáner de códigos QR integrado:**
  - Escaneo directo mediante cámara en el dispositivo con `html5-qrcode` optimizado.
  - Manejo resiliente de permisos, dispositivos ocupados y selección de cámara trasera/frontal.

- **🎨 Identidad visual accesible ("Dirección C — Amable"):**
  - Tipografía local optimizada: **Atkinson Hyperlegible** (cuerpo) y **Nunito** (titulares) en formato WOFF2 local, sin ninguna dependencia externa de Google Fonts.
  - Temas Claro y Oscuro con contraste verificado WCAG 2.1 AA.
  - Veredictos con doble codificación sensorial: color + iconos con formas geométricas distintivas (círculo, triángulo, octógono).

- **♿ Accesibilidad universal (WCAG 2.1 AA):**
  - Anuncios dinámicos accesibles con regiones `aria-live` para lectores de pantalla.
  - Navegación completa por teclado con indicadores de foco visibles.
  - Feedback háptico (vibración) y sonoro (Web Audio API) opcionales y configurables.

- **📱 Soporte PWA e integración con el sistema:**
  - Instalable en Android, iOS, Windows, macOS y Linux.
  - Soporte de **Web Share Target API** (comparte enlaces sospechosos desde WhatsApp, SMS o correo directamente a Centinela).
  - Funcionamiento 100% offline mediante Service Worker y Workbox precaching.

- **🔒 Privacidad y seguridad estrictas:**
  - Zero trackers, zero analíticas invasivas y zero cookies.
  - Política de seguridad de contenidos (CSP) defensiva estricta (`script-src 'self'`).
  - Consulta de reputación externa opcional con preservación de privacidad mediante *k-anonymity* de prefijos de hash SHA-256.

---

## 🏛️ Arquitectura del sistema

```
┌────────────────────────────────────────────────────────┐
│                     Centinela PWA                      │
│               (Cloudflare Pages / Vite)                │
├────────────────────────────────────────────────────────┤
│  UI Modular       │  Core de Análisis │  Almacenamiento│
│  - Home / Input   │  - Parser URL     │  - Historial   │
│  - Scanner QR     │  - Heurísticas    │    (IndexedDB) │
│  - Resultado      │  - Homoglifos     │  - Ajustes     │
│  - Historial      │  - Reputación     │    (LocalStrg) │
│  - Configuración  │  - Feedback Audio │  - ServiceWrkr │
└───────────────────────────┬────────────────────────────┘
                            │ (Opcional con k-anonymity)
                            ▼
┌────────────────────────────────────────────────────────┐
│                Worker de Reputación                    │
│                (Cloudflare Workers)                    │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Inicio rápido

### Requisitos
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Instalación y ejecución local

```bash
# Clonar el repositorio
git clone https://github.com/MaciasIT/Centinela_PWA.git
cd Centinela_PWA

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

### Ejecutar suite de pruebas

```bash
# Ejecutar los 254 tests unitarios y de integración con Vitest
npm test

# Ejecutar tests con interfaz visual
npm run test:ui
```

### Compilación para producción

```bash
# Generar bundle optimizado en dist/
npm run build

# Previsualizar el build de producción
npm run preview
```

---

## 📚 Documentación técnica

Para profundizar en los detalles técnicos y operativos del proyecto:

- [📖 Manual de Usuario](docs/MANUAL_USUARIO.md) — Guía detallada para el usuario final.
- [🏗️ Arquitectura del Sistema](docs/ARQUITECTURA.md) — Componentes, flujo de datos y decisiones técnicas.
- [🛡️ Política de Privacidad](docs/PRIVACIDAD.md) — Modelo de amenazas y garantías de privacidad.
- [📋 Matriz de Cumplimiento](docs/CUMPLIMIENTO.md) — Estándares WCAG 2.1 AA, OWASP y PWA.
- [🧪 Guía de Auditoría y Testing](docs/GUIA_AUDITORIA.md) — Protocolos de pruebas y verificación.

---

## 📄 Licencia

Distribuido bajo la licencia [MIT](LICENSE).
