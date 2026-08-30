# 🛡️ Centinela — Tu Guardián Digital

![Centinela Hero](assets/banner.png)

Centinela es una PWA (Aplicación Web Progresiva) de ciberseguridad diseñada para personas no técnicas. Permite verificar enlaces y códigos QR en segundos, previniendo phishing y malware con una interfaz simple tipo semáforo.

🌍 **Enlace en vivo:** [https://centinela-pwa.pages.dev](https://centinela-pwa.pages.dev)

---

## 🎯 Filosofía

Ciberseguridad sin jerga. Sin informes técnicos. Solo un veredicto claro:
- 🟢 Seguro
- 🟡 Sospechoso
- 🔴 Peligroso

---

## ✨ Características actuales

| Feature | Estado |
|---------|--------|
| Escaneo rápido de URL/QR | ✅ |
| Semáforo 🟢🟡🔴 con explicación sencilla | ✅ |
| Vista previa aislada (mshots) | ✅ |
| Detección de identidad sospechosa | ✅ |
| Indicador de dominio reciente | ✅ |
| Compartir resultado | ✅ |
| Historial local con filtros | ✅ |
| Estadísticas locales | ✅ |
| Modo Ángel de la Guarda (SOS WhatsApp) | ✅ |
| PWA instalable + share target | ✅ |
| Accesibilidad básica (`aria-live`, Escape, foco) | ✅ |

## 🛠️ Stack

- **Frontend:** HTML5 + CSS + JS ESM (Vite)
- **Backend:** Cloudflare Worker (`worker/`)
- **Motores:** VirusTotal v3, Google Safe Browsing, URLScan.io
- **Preview:** WordPress mshots
- **Despliegue:** Cloudflare Pages + GitHub Actions

---

## 📱 Uso

1. Pega o comparte un enlace
2. Pulsa **Comprobar**
3. Lee el semáforo y decide

---

## 📖 Documentación

- `PLAN_MEJORAS_2026-07-20.md` — roadmap y fases
- `docs/validacion-centinela-main-2026-07-30.md` — última validación
- `manual.html` — guía de usuario

---

## 🤝 Proyecto

Mantenido por [Michel Macias](https://github.com/MaciasIT) · Repo: `MaciasIT/Centinela_PWA`
