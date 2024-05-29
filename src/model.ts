import {PlatformConfig} from 'homebridge';

export interface AtombergFanPlatformConfig extends PlatformConfig {
    apiKey: string;
    refreshToken: string;
}

export interface AtombergFanDevice {
    device_id: string;
    color: string;
    series: string;
    model: string;
    room: string;
    name: string;
    metadata: AtombergFanDeviceMetadata;
}

export interface AtombergFanDeviceMetadata {
    ssid: string;
}

export interface AtombergFanDeviceState {
    'device_id': string;
    'is_online': boolean;
    'power': boolean;
    'led': boolean;
    'sleep_mode': boolean;
    'last_recorded_speed': number;
    'timer_hours': number;
    'timer_time_elapsed_mins': number;
    'ts_epoch_seconds': number;
    'last_recorded_brightness': number; // aris starlight only
    'last_recorded_color': string; // aris starlight only
}

export interface AtombergFanCommandData {
    'device_id': string;
    'command': AtombergFanCommandType;
}

export interface AtombergFanCommandType {
    'power': boolean;
    'speed': number; // 1 to 6
    'speedDelta': number; // 1,2,3,4,5,-1,-2,-3,-4,-5
    'sleep': boolean;
    'timer': number; // 0 to 4, 0 is 1hr, 2 is 2hr, 3 is 3hr, 4 is 6hr
    'led': boolean;
    'brightness': number; // aris starlight only 10 to 100
    'brightnessDelta': number; // aris starlight only -90 to +90
    'light_mode': string; // aris starlight only cool, warm, or daylight
}
