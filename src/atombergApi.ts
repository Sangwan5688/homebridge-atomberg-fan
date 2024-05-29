import axios, {AxiosError} from 'axios';
import {LOGIN_RETRY_DELAY, LOGIN_TOKEN_REFRESH_INTERVAL, ATOMBERG_ERROR_CODES, ATOMBERG_API_HOST, ATOMBERG_API_ENDPOINTS} from './settings';
import {AtombergFanPlatformConfig, AtombergFanDevice, AtombergFanDeviceState, AtombergFanCommandData} from './model';
import { Logger } from 'homebridge';


/**
 * This class exposes login, device status fetching, and device status update functions.
 */
export default class AtombergApi {
  private accessToken: string;
  private _loginRefreshInterval: NodeJS.Timeout | undefined;
  private _loginRetryTimeouts: NodeJS.Timeout[] = [];

  constructor(
    private readonly logger: Logger,
    private readonly config: AtombergFanPlatformConfig,
  ) {
    this.accessToken = '';
  }

  public getAccessToken(): string {
    return this.accessToken;
  }

  /**
     * Logs in the user with AtombergFan platform and
     * saves the retrieved token on the instance.
     */
  public async login(): Promise<void> {
    /**
         * A repeat-login might have been requested by several accessories
         * at a similar time. The first timeout to be executed can clear
         * all remaining ones, since it doesn't make sense to log in multiple
         * times within a short amount of time.
         */
    for (const timeoutId of this._loginRetryTimeouts) {
      clearTimeout(timeoutId);
    }
    clearInterval(<NodeJS.Timeout>this._loginRefreshInterval);
    const headers = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'Authorization': `Bearer ${this.config.refreshToken}`,
    };

    return axios.request({
      method: 'get',
      url: ATOMBERG_API_HOST + ATOMBERG_API_ENDPOINTS.GET_ACCESS_TOKEN,
      headers: headers,
    })
      .then((response) => {
        if (response.data.status !== 'Success') {
          this.accessToken = '';
          this.retryLogin(JSON.stringify(response.data.message));
        } else {
          this.accessToken = response.data.message.access_token;
          // Set an interval to refresh the login token periodically.
          this._loginRefreshInterval = setInterval(this.login.bind(this),
            LOGIN_TOKEN_REFRESH_INTERVAL);
        }
      })
      .catch((error: AxiosError) => {
        this.retryLogin(JSON.stringify(error));
      });
  }

  public async retryLogin(error: string) {
    this.logger.debug('AtombergFanApi: AtombergFan platform login failed');
    this.logger.debug(error);
    this.logger.error(
      `Login failed. Homebridge will try to log in again in ${LOGIN_RETRY_DELAY / 1000} seconds. ` +
      'If the issue persists, make sure you configured the correct userId and password ' +
      'and run the latest version of the plugin. ' +
      'Restart Homebridge when you change your config, ' +
      'as it will probably not have an effect on its own. ' +
      'If the error still persists, please report to ' +
      'https://github.com/Sangwan5688/homebridge-atomberg-fan/issues.',
    );
    // Try to login again after some time. Might just be a transient server issue.
    this._loginRetryTimeouts.push(setTimeout(this.login.bind(this), LOGIN_RETRY_DELAY));
  }

  /**
     * Fetches the home details registered with the user's AtombergFan platform account
     *
     * @returns A promise of all the user's AtombergFan platform home details.
     */
  public async getAllDevices(): Promise<AtombergFanDevice[]> {
    this.logger.debug('AtombergFanApi: Fetching Device Details from AtombergFanApi platform');

    if (!this.accessToken) {
      return Promise.reject('No auth token available (login probably failed). ' +
                'Check your credentials and restart HomeBridge.');
    }

    return axios.request({
      method: 'get',
      url: ATOMBERG_API_HOST + ATOMBERG_API_ENDPOINTS.GET_DEVICES,
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'Authorization': `Bearer ${this.accessToken}`,
      },
    })
      .then((response) => {
        this.logger.debug(JSON.stringify(response.data));
        if (response.data.status !== 'Success') {
          return Promise.reject(response.data?.message ?? response.data);
        }
        this.logger.debug('AtombergFanApi: AtombergFan platform getAllDevices successful');
        return response.data.message.devices_list as AtombergFanDevice[];
      })
      .catch((error: AxiosError) => {
        this.logger.debug('AtombergFanApi: AtombergFan platform getAllDevices failed');
        this.handleNetworkRequestError(error);
        return Promise.reject();
      });
  }

  // NOT RECOMMENDED TO USE, WE WILL USE UDP INSTEAD
  public async getDeviceState(): Promise<AtombergFanDeviceState[]> {
    this.logger.debug('AtombergFanApi: Fetching Device State from AtombergFanApi platform');

    if (!this.accessToken) {
      return Promise.reject('No auth token available (login probably failed). ' +
                'Check your credentials and restart HomeBridge.');
    }

    return axios.request({
      method: 'get',
      url: ATOMBERG_API_HOST + ATOMBERG_API_ENDPOINTS.GET_DEVICE_STATE,
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'Authorization': `Bearer ${this.accessToken}`,
      },
      params: {
        'device_id': 'all',
      },
    })
      .then((response) => {
        this.logger.debug(JSON.stringify(response.data));
        if (response.data.status !== 'Success') {
          return Promise.reject(response.data?.message ?? response.data);
        }
        this.logger.debug('AtombergFanApi: AtombergFan platform getDeviceState successful');
        return response.data.message.device_state as AtombergFanDeviceState[];
      })
      .catch((error: AxiosError) => {
        this.logger.debug('AtombergFanApi: AtombergFan platform getDeviceState failed');
        this.handleNetworkRequestError(error);
        return Promise.reject();
      });
  }

  public async sendCommand(data: AtombergFanCommandData): Promise<boolean> {
    this.logger.debug('AtombergFanApi: Sending command to AtombergFanApi platform');

    if (!this.accessToken) {
      return Promise.reject('No auth token available (login probably failed). ' +
                'Check your credentials and restart HomeBridge.');
    }

    return axios.request({
      method: 'post',
      url: ATOMBERG_API_HOST + ATOMBERG_API_ENDPOINTS.SEND_COMMAND,
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'Authorization': `Bearer ${this.accessToken}`,
      },
      data: data,
    })
      .then((response) => {
        this.logger.debug(JSON.stringify(response.data));
        if (response.data.status !== 'Success') {
          return Promise.reject(response.data?.message ?? response.data);
        }
        return true;
      })
      .catch((error: AxiosError) => {
        this.logger.debug('AtombergFanApi: AtombergFan platform sendCommand failed');
        this.handleNetworkRequestError(error);
        return Promise.reject();
      });
  }

  /**
     * Generic Axios error handler that checks which type of
     * error occurred and prints the respective information.
     *
     * @see https://axios-http.com/docs/handling_errors
     * @param error The error that is passes into the Axios error handler
     */
  private handleNetworkRequestError(error: AxiosError) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx.
      this.logger.debug(JSON.stringify(error.response));
      if (error.response.status === 401) {
        // Unauthorised, try to log in again
        this._loginRetryTimeouts.push(setTimeout(this.login.bind(this), LOGIN_RETRY_DELAY));
      } else if (ATOMBERG_ERROR_CODES[error.response.status]) {
        // Developer mode is disabled
        this.logger.error(ATOMBERG_ERROR_CODES[error.response.status]);
      } else {
        this.logger.debug(error?.response?.data ?? 'Some error occurred');
      }
    } else if (error.request) {
      // The request was made but no response was received.
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      this.logger.debug(error.request);
    } else {
      // Something happened in setting up the request that triggered an error.
      this.logger.debug(error.message);
    }
  }
}