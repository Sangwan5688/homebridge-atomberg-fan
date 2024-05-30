import dgram from 'dgram';
import { Logger } from 'homebridge';
import { EventEmitter } from 'events';
import { AtombergFanDeviceState } from './model';

class BroadcastListener extends EventEmitter {
  private static instance: BroadcastListener;
  public readonly socket = dgram.createSocket('udp4');
  private readonly bindPort = 5625;
  private readonly log: Logger;

  private constructor(log: Logger) {
    super();
    this.log = log;
  }

  public static getInstance(log: Logger): BroadcastListener {
    if (!BroadcastListener.instance) {
      BroadcastListener.instance = new BroadcastListener(log);
    }
    return BroadcastListener.instance;
  }

  private onListen() {
    const address = this.socket.address();
    this.log.debug('UDP socket listening on ' + address.address + ':' + address.port);
  }

  private onMessage(message: Buffer, remote: dgram.RemoteInfo) {
    if (remote.size > 100) {
      try {
        const res = this.parseMessage(message) as AtombergFanDeviceState;
        this.log.debug('Received message from ' + remote.address + ':' + remote.port + ' - ' + JSON.stringify(res));
        if (res) {
          this.emit('stateChange', res);
        }
      } catch (error) {
        this.log.error('Error parsing broadcast message: ', error);
      }
    }
  }

  private parseMessage(message: Buffer): AtombergFanDeviceState | null {
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
      const brightness = (((0x7F00) & stateCode) / 256);
      const cool = ((0x08) & stateCode) > 0 ? true : false;
      const warm = ((0x8000) & stateCode) > 0 ? true : false;

      return {
        'device_id': jsonMessage['device_id'],
        'is_online': true,
        'power': power,
        'led': led,
        'sleep_mode': sleep,
        'last_recorded_speed': speed,
        'timer_hours': fanTimer,
        'timer_time_elapsed_mins': fanTimerElapsedMins,
        'last_recorded_brightness': brightness,  // aris starlight only
        'last_recorded_color': cool ? (warm ? 'Daylight' : 'Cool') : 'Warm',  // aris starlight only
      } as AtombergFanDeviceState;
    } catch (error) {
      this.log.error('Error parsing broadcast message: ', error);
      return null;
    }
  }

  public listen() {
    this.log.debug('Listening for broadcast messages on port ' + this.bindPort);
    this.socket.bind(this.bindPort);
    this.socket.on('listening', this.onListen.bind(this));
    this.socket.on('message', this.onMessage.bind(this));
  }

  public close() {
    this.socket.close();
  }
}

export default BroadcastListener;
