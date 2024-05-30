import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';

import AtombergApi from './atombergApi';
import { AtombergFanPlatform } from './platform';
import { AtombergFanCommandData, AtombergFanDeviceState } from './model';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class AtombergFanPlatformAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */

  constructor(
    private readonly platform: AtombergFanPlatform,
    private readonly atombergApi: AtombergApi,
    private readonly accessory: PlatformAccessory,
    private fanState: AtombergFanDeviceState,
  ) {

    let modelName = accessory.context.device.model || '';
    if (accessory.context.device.series) {
      if (modelName !== '') {
        modelName += ' ';
      }
      modelName += accessory.context.device.series;
    } else if (modelName === '') {
      modelName = 'Unknown';
    }

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Atomberg')
      .setCharacteristic(this.platform.Characteristic.Model, modelName)
      .setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name || 'Unknown')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Unknown');

    // get the Fan service if it exists, otherwise create a new Fan service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name || 'Unknown Fan');

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the Active Characteristic (required)
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this));                // SET - bind to the `setOn` method below
    // .onGet(this.getActive.bind(this));              // GET - bind to the `getOn` method below


    // register handlers for the Speed Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 20,
      })
      .onSet(this.setRotationSpeed.bind(this));

    this.refreshDeviceStatus(this.fanState);

    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Fan, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same subtype id.)
     */

    /**
     * Updating characteristics values asynchronously.
     *
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     *
     */
    // subscribe to broadcast listener
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setActive(value: CharacteristicValue) {
    this.validateDeviceConnectionStatus();
    // implement your own code to turn your device on/off
    this.fanState.power = value as boolean;

    this.platform.log.debug('Set Characteristic Active ->', value);
    const powerState = value === this.platform.Characteristic.Active.ACTIVE;
    const cmdData = {
      'device_id': this.accessory.context.device.device_id,
      'command': {'power': powerState, 'speed': powerState ? this.fanState.last_recorded_speed : 0},
    } as AtombergFanCommandData;
    this.sendDeviceUpdate(cmdData);
  }

  private validateDeviceConnectionStatus() {
    if (!this.fanState.is_online) {
      this.platform.log.info('Device is offline, unable to update device characteristic value');
      throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private async sendDeviceUpdate(commandData: AtombergFanCommandData) {
    this.validateDeviceConnectionStatus();

    try {
      this.platform.log.debug('Sending command data: ', commandData);
      const res = await this.atombergApi.sendCommand(commandData);
      if (res) {
        this.platform.log.debug(`Successfully sent device update for device ['${this.accessory.displayName}']`);
      }
    } catch (error) {
      this.platform.log.error('An error occurred while sending a device update. ' +
            'Turn on debug mode for more information.');

      // Only log if a Promise rejection reason was provided.
      // Some errors are already logged at source.
      if (error) {
        this.platform.log.debug(JSON.stringify(error));
      }
    }
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possible. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setRotationSpeed(value: CharacteristicValue) {
    this.validateDeviceConnectionStatus();

    // implement your own code to set the brightness
    const newSpeed = (value as number)/20;
    this.fanState.last_recorded_speed = newSpeed;

    this.platform.log.debug('Set Characteristic Speed -> ', newSpeed);
    const cmdData = {
      'device_id': this.accessory.context.device.device_id,
      'command': {'speed': newSpeed},
    } as AtombergFanCommandData;
    this.sendDeviceUpdate(cmdData);
  }

  public refreshDeviceStatus(deviceState: AtombergFanDeviceState): void {
    try {
      // Skipping refresh
      if (!deviceState.is_online) {
        this.platform.log.debug(`Device ['${this.accessory.displayName}'] is offline,` +
                'skipping device status refresh');
        return;
      }

      this.platform.log.debug(`Refreshing device ['${this.accessory.displayName}'] details`);

      // Active
      const active = deviceState.power
        ? this.platform.Characteristic.Active.ACTIVE
        : this.platform.Characteristic.Active.INACTIVE;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, active);

      // Rotation Speed
      let fanSpeed = deviceState.last_recorded_speed;
      if (fanSpeed > 5) {
        fanSpeed = 5;
      }
      this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .updateValue(fanSpeed*20);

    } catch (error) {
      this.platform.log.error('An error occurred while refreshing the device status. ' +
            'Turn on debug mode for more information.');

      // Only log if a Promise rejection reason was provided.
      // Some errors are already logged at source.
      if (error) {
        this.platform.log.debug(JSON.stringify(error));
      }
    }
  }

}
