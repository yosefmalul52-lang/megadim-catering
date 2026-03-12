export const environment = {
  production: true,
  apiUrl: 'https://magadim-backend.onrender.com/api',
  /** Set via build/env if backend requires key; otherwise use cookie auth. */
  adminSummariesKey: '' as string,
  assistant: {
    chatKitEnabled: true,
    systemPrompt: 'אתה העוזר החכם של קייטרינג מגדים. עזור ללקוחות עם התפריט, הזמנות ושאלות נפוצות.'
  }
};
