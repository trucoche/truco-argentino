import { io } from 'socket.io-client';
import { API_URL } from '../config';

// Instancia única compartida — evita abrir conexiones duplicadas
// cada vez que se monta un componente.
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: false
    });
  }
  return socket;
}