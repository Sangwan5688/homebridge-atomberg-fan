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
    // We don't need onGet as we will be updating status via broadcast listener


    // register handlers for the Speed Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 20,
      })
      .onSet(this.setRotationSpeed.bind(this));

    this.refreshDeviceStatus(this.fanState);

  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of fan i.e, turning the fan on/off.
   */
  async setActive(value: CharacteristicValue) {
    this.validateDeviceConnectionStatus();

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

  // Send device update to Atomberg API
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
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the spped of the fan
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

  /**
   * This method is called when the device state is updated by the broadcast listener
   */
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
