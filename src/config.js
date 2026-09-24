// Config central del frontend. Todo lo que necesite hablar con el backend
// (fetch normal o socket.io) importa esto en vez de hardcodear localhost.
// Así, para probar desde el celular (u otra red) alcanza con cambiar el
// valor en .env y reiniciar `npm start` — no hay que tocar archivo por archivo.

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';