import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

(window as any).Pusher = Pusher;

let echoInstance: any = null;

export const getEcho = (): any => {
  if (echoInstance) {
    return echoInstance;
  }

  const token = localStorage.getItem('taskflow_token');
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: process.env.REACT_APP_REVERB_APP_KEY || '7zzjbtnueepi2trmspps',
    wsHost: process.env.REACT_APP_REVERB_HOST || window.location.hostname,
    wsPort: parseInt(process.env.REACT_APP_REVERB_PORT || '8080'),
    wssPort: parseInt(process.env.REACT_APP_REVERB_PORT || '8080'),
    forceTLS: process.env.REACT_APP_REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${apiBase}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
      },
    },
  });

  return echoInstance;
};

export const resetEcho = () => {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
};
