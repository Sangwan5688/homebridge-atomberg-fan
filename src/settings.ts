export const PLATFORM_NAME = 'Atomberg Fan';

export const PLUGIN_NAME = 'homebridge-atomberg-fan';

export const LOGIN_RETRY_DELAY = 360 * 1000;

export const LOGIN_TOKEN_REFRESH_INTERVAL = 60 * 60 * 23 * 1000;

export const ATOMBERG_API_HOST = 'https://api.developer.atomberg-iot.com';

export const ATOMBERG_API_ENDPOINTS = {
  GET_ACCESS_TOKEN: '/v1/get_access_token',
  GET_DEVICES: '/v1/get_list_of_devices',
  SEND_COMMAND: '/v1/send_command',
  GET_DEVICE_STATE: '/v1/get_device_state',
}

export const ATOMBERG_ERROR_CODES = {
  401: 'Access token expired',
  403: 'Forbidden, please make sure Developer mode is enabled and correct token is provided',
  404: 'Device not found',
  429: 'API limit Reached'
};