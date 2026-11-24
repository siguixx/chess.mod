import { SuperChessAI } from '/shared/ai/superChessAI.js';

const engineAI = new SuperChessAI();

self.onmessage = (event) => {
  const { id, state, options } = event.data || {};
  try {
    const result = engineAI.chooseBestMove(state, options || {});
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || 'Error en Súper IA Worker' });
  }
};
