
import dgram from 'dgram';
import { AtombergFanPlatform } from './platform';
import { AtombergFanDeviceState } from './model';


export default class BroadcastListener {
  private readonly socket = dgram.createSocket('udp4');
  private readonly bindPort = 5625;

  constructor(private readonly platform: AtombergFanPlatform) {
    this.socket.bind(this.bindPort);
    this.socket.on('listening', this.onListen);
    this.socket.on('message', this.onMessage);
  }

  private onListen() {
    const address = this.socket.address();
    this.platform.log.debug('UDP socket listening on ' + address.address + ':' + address.port);
  }

  private onMessage(message: Buffer, remote: dgram.RemoteInfo) {
    if (remote.port === 50702 && remote.size > 100) {
      const res = this.parseMessage(message) as AtombergFanDeviceState;
      this.platform.log.debug('Received message from ' + remote.address + ':' + remote.port + ' - ' + JSON.stringify(res));
    }
  }

  private parseMessage (message: Buffer): AtombergFanDeviceState | null{
    try {
      const hexString = message.toString();
      const stringMessage = Buffer.from(hexString, 'hex').toString('utf8');
      const jsonMessage = JSON.parse(stringMessage);
      const stateCode = jsonMessage['state_string'].split(',')[0];

      const power = ((0x10) & stateCode) > 0 ? true : false;
      const led = ((0x20) & stateCode) > 0 ? true : false;
      const sleep = ((0x80) & stateCode) > 0 ? true : false;
      const speed = (0x07) & stateCode;
      const fanTimer = ((0x0F0000 & stateCode) / 65536);
      const fanTimerElapsedMins = ((0xFF000000 & stateCode) * 4 / 16777216);
      //Aris Starlight Specific
      const Brightness = (((0x7F00) & stateCode) / 256);
      const Cool = ((0x08) & stateCode) > 0 ? true : false;
      const Warm = ((0x8000) & stateCode) > 0 ? true : false;

      return {
        'device_id': jsonMessage['device_id'],
        'is_online': true,
        'power': power,
        'led': led,
        'sleep_mode': sleep,
        'last_recorded_speed': speed,
        'timer_hours': fanTimer,
        'timer_time_elapsed_mins': fanTimerElapsedMins,
        'last_recorded_brightness': Brightness,  // aris starlight only
        'last_recorded_color': Cool ? (Warm ? 'Daylight' : 'Cool') : 'Warm',  // aris starlight only
      } as AtombergFanDeviceState;
    } catch (error) {
      this.platform.log.error('Error parsing broadcast message: ', error);
      return null;
    }
  }

  public close() {
    this.socket.close();
  }
}