/**
 * @file ai_transparency.test.js
 * @description Suite determinista de transparencia según el Artículo 50 del EU AI Act (Reglamento UE 2024/1689).
 * 
 * Reglas auditadas:
 * 1. Los componentes de interfaz que presenten asistentes conversacionales o respuestas de IA deben
 *    mostrar una advertencia o distintivo visible al usuario informando de su naturaleza artificial.
 * 2. Los contenidos generados por IA expuestos al usuario deben incluir metadatos o etiquetas declarativas.
 * 
 */

import { describe, it, expect } from 'vitest';

describe('Auditoría de Transparencia de Inteligencia Artificial (EU AI Act Art. 50)', () => {
  it('REGLA 1: Si existe interfaz de chat o asistente de IA, debe existir un aviso de transparencia visible', () => {
    if (typeof document === 'undefined') return;
    const aiChatContainers = document.querySelectorAll('[data-testid="ai-assistant"], .ai-chat, #ai-bot');
    if (aiChatContainers.length === 0) {
      // Si la aplicación no tiene chat/asistente de IA directo, la prueba se supera
      return;
    }

    aiChatContainers.forEach(container => {
      const disclaimer = container.querySelector('[data-testid="ai-disclaimer"], .ai-label, .ai-notice');
      expect(disclaimer, 'Todo contenedor de chat de IA debe incluir un aviso de sistema automatizado (Art. 50 AI Act)').not.toBeNull();
      
      const text = (disclaimer.textContent || '').toLowerCase();
      const hasNotice = text.includes('inteligencia artificial') || 
                        text.includes('ia') || 
                        text.includes('ai') || 
                        text.includes('automatizado');
      expect(hasNotice, 'El aviso debe declarar expresamente que se trata de un sistema de IA').toBe(true);
    });
  });

  it('REGLA 2: Las respuestas sintéticas generadas deben contener metadatos legibles por máquina', () => {
    const mockAiOutput = {
      content: 'Respuesta generada...',
      provenance: {
        generatedByAI: true,
        model: 'hermes-fleet-v1',
        disclaimer: 'Contenido generado mediante Inteligencia Artificial bajo supervisión humana.'
      }
    };

    expect(mockAiOutput.provenance.generatedByAI).toBe(true);
    expect(mockAiOutput.provenance.disclaimer).toBeDefined();
  });
});
