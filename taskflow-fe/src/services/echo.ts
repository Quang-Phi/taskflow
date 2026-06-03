import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

(window as any).Pusher = Pusher;

let echoInstance: any = null;

export const getEcho = (): any => {
  if (echoInstance) {
    return echoInstance;
  }

  const token = localStorage.getItem('taskflow_token');
  let rawApiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
  rawApiBase = rawApiBase.replace(/\/+$/, '');
  if (!rawApiBase.endsWith('/api')) {
    rawApiBase = `${rawApiBase}/api`;
  }
  const apiBase = rawApiBase;
  const broadcaster = process.env.REACT_APP_BROADCASTER || 'reverb';

  const config: any = {
    broadcaster: broadcaster,
    authEndpoint: `${apiBase}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
      },
    },
  };

  if (broadcaster === 'reverb') {
    config.key = process.env.REACT_APP_REVERB_APP_KEY || '7zzjbtnueepi2trmspps';
    config.wsHost = process.env.REACT_APP_REVERB_HOST || window.location.hostname;
    config.wsPort = parseInt(process.env.REACT_APP_REVERB_PORT || '8080');
    config.wssPort = parseInt(process.env.REACT_APP_REVERB_PORT || '8080');
    config.forceTLS = process.env.REACT_APP_REVERB_SCHEME === 'https';
    config.enabledTransports = ['ws', 'wss'];
  } else if (broadcaster === 'pusher') {
    config.key = process.env.REACT_APP_PUSHER_APP_KEY;
    config.cluster = process.env.REACT_APP_PUSHER_APP_CLUSTER || 'mt1';
    config.forceTLS = true;
  }

  echoInstance = new Echo(config);
  return echoInstance;
};

export const resetEcho = () => {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
};
