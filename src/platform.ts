import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { AtombergFanPlatformConfig, AtombergFanDevice, AtombergFanDeviceState } from './model';
import { AtombergFanPlatformAccessory } from './platformAccessory';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import BroadcastListener from './broadcastListener';
import AtombergApi from './atombergApi';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where we
 * parse the user config and discover/register accessories with Homebridge.
 */
export class AtombergFanPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly atombergApi: AtombergApi;
  public readonly broadcastListener: BroadcastListener;
  public readonly platformConfig: AtombergFanPlatformConfig;
  private readonly accessoryInstances: Map<string, AtombergFanPlatformAccessory> = new Map();

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.platformConfig = config as AtombergFanPlatformConfig;
    this.atombergApi = new AtombergApi(
      this.log,
      this.platformConfig,
    );
    this.broadcastListener = BroadcastListener.getInstance(this.log);

    // Homebridge 1.8.0 introduced a `log.success` method that can be used to log success messages
    // For users that are on a version prior to 1.8.0, we need a 'polyfill' for this method
    if (!log.success) {
      log.success = log.info;
    }

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      if (!this.platformConfig.apiKey) {
        this.log.error('apiKey is not configured - aborting plugin start. ' +
            'Please set the field `API Key` in your config and restart Homebridge.');
        return;
      }

      if (!this.platformConfig.refreshToken) {
        this.log.error('refreshToken is not configured - aborting plugin start. ' +
            'Please set the field `Refresh Token` in your config and restart Homebridge.');
        return;
      }


      this.log.info('Attempting to log into Atomberg platform.');
      this.atombergApi.login()
        .then((res) => {
          if (!res) {
            this.log.error('Login failed. Skipping device discovery.');
            return;
          }
          this.log.info('Successfully logged in.');
          // run the method to discover / register your devices as accessories
          this.discoverDevices();
        })
        .catch((error) => {
          this.log.error('Login failed. Skipping device discovery.');
          this.log.debug(error);
        });

      this.log.debug(`Finished initialising platform: ${this.platformConfig.name}`);
    });

    this.broadcastListener.listen();
    this.broadcastListener.on('stateChange', (state: AtombergFanDeviceState) => {
      this.handleStateChange(state);
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Here we discover and register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    this.log.info('Discovering devices on Atomberg platform.');
    try {
      // Get all devices from the Atomberg platform
      const devices: AtombergFanDevice[] = await this.atombergApi.getAllDevices();
      if (!devices) {
        this.log.info('No devices found on Atomberg platform.');
      } else {
        const deviceStates: AtombergFanDeviceState[] = await this.atombergApi.getDeviceState();
        // loop over the discovered devices and register each one if it has not already been registered
        for (const device of devices) {

          // generate a unique id for the accessory
          const uuid = this.api.hap.uuid.generate(device.device_id);

          // see if an accessory with the same uuid has already been registered and restored from
          // the cached devices we stored in the `configureAccessory` method above
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
          const deviceState = deviceStates.find(dvc => dvc.device_id === device.device_id) as AtombergFanDeviceState;

          if (existingAccessory) {
            // the accessory already exists
            this.log.info(`Restoring existing accessory of displayName [${existingAccessory.displayName}] `
                                    + ` and deviceId [${device.device_id}] from cache.`);

            // update the accessory.context
            existingAccessory.context.device = device;
            existingAccessory.context.deviceDisplayName = `${device.name}`;
            this.api.updatePlatformAccessories([existingAccessory]);

            // create the accessory handler for the restored accessory
            // this is imported from `platformAccessory.ts`
            const atombergAccessory = new AtombergFanPlatformAccessory(this, this.atombergApi, existingAccessory, deviceState);
            this.accessoryInstances.set(device.device_id, atombergAccessory);

          } else {
            // the accessory does not yet exist, so we need to create it
            this.log.info('Adding new accessory:', device.name);

            // create a new accessory
            const accessory = new this.api.platformAccessory(device.name, uuid);

            // store a copy of the device object in the `accessory.context`
            // the `context` property can be used to store any data about the accessory you may need
            accessory.context.device = device;

            // create the accessory handler for the newly create accessory
            // this is imported from `platformAccessory.ts`
            const atombergAccessory = new AtombergFanPlatformAccessory(this, this.atombergApi, accessory, deviceState);
            this.accessoryInstances.set(device.device_id, atombergAccessory);

            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }
      }

      // At this point, we set up all devices from the Platform, but we did not unregister
      // cached devices that are no longer on Atomberg account.
      for (const cachedAccessory of this.accessories) {
        const deviceId = cachedAccessory.context.device.device_id;
        const removedPlatformDevice = devices.find(device => device.device_id === deviceId);

        if (!removedPlatformDevice) {
          // This cached devices does not exist on Atomberg account anymore.
          this.log.info(`Removing accessory '${cachedAccessory.displayName}' (${deviceId}) ` +
                'because it does not exist on the account anymore.');

          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cachedAccessory]);
        }
      }
    } catch (error) {
      this.log.error('An error occurred during device discovery. ' +
          'Turn on debug mode for more information.');
      this.log.debug(JSON.stringify(error));
    }
  }

  handleStateChange(state: AtombergFanDeviceState) {
    // Find the corresponding accessory and update its state
    const accessoryInstance = this.accessoryInstances.get(state.device_id);
    if (accessoryInstance) {
      this.log.debug('Updating state for accessory:', state.device_id);
      accessoryInstance.refreshDeviceStatus(state);
    }
  }
}
