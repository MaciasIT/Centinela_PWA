import { parseHTML } from 'linkedom';
import { buildPreviewUrl, closePreviewDialog, openPreview } from '../../js/screens/preview.js';

function ok(name, fn) {
  try {
    fn();
    return { name, pass: true };
  } catch (err) {
    return { name, pass: false, error: err.message };
  }
}

export async function run() {
  const tests = [];

  tests.push(ok('buildPreviewUrl genera URL de Microlink por defecto', () => {
    const url = buildPreviewUrl('https://example.com');
    if (!url.startsWith('https://api.microlink.io/?url=https%3A%2F%2Fexample.com')) {
      throw new Error(`URL inesperada: ${url}`);
    }
    if (!url.includes('screenshot=true') || !url.includes('embed=screenshot.url')) {
      throw new Error(`Parámetros incompletos en: ${url}`);
    }
  }));

  tests.push(ok('buildPreviewUrl genera URL de mshots como fallback', () => {
    const url = buildPreviewUrl('https://example.com', 'mshots');
    if (!url.startsWith('https://s.wordpress.com/mshots/v1/https%3A%2F%2Fexample.com')) {
      throw new Error(`URL inesperada: ${url}`);
    }
  }));

  tests.push(ok('closePreviewDialog restaura foco y aria-busy en frame', () => {
    const { document } = parseHTML(`
      <div id="preview-frame" aria-busy="true"></div>
      <div id="preview-dialog"></div>
      <img id="preview-img" src="https://test.jpg">
      <button id="btn-preview" disabled></button>
    `);
    let focused = false;
    const btnPreview = document.getElementById('btn-preview');
    btnPreview.focus = () => { focused = true; };

    closePreviewDialog({
      previewDialog: document.getElementById('preview-dialog'),
      previewImg: document.getElementById('preview-img'),
      previewFrame: document.getElementById('preview-frame'),
      btnPreview,
    });

    if (!document.getElementById('preview-dialog').classList.contains('hidden')) {
      throw new Error('El diálogo no se ocultó');
    }
    if (document.getElementById('preview-frame').getAttribute('aria-busy') !== 'false') {
      throw new Error('aria-busy no se puso en false');
    }
    if (btnPreview.disabled) {
      throw new Error('btn-preview sigue deshabilitado');
    }
    if (!focused) {
      throw new Error('No se devolvió el foco a btn-preview');
    }
  }));

  const failed = tests.filter((t) => !t.pass);
  return {
    ok: failed.length === 0,
    tests: tests.length,
    failed: failed.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}
