<span align="center">

# Homebridge Atomberg Fan

</span>

Homebridge Atomberg Fan is a plugin for [Homebridge](https://homebridge.io/) that provides Homekit support for [Atomberg Smart Fans](https://atomberg.com/).

## How it works

The plugin makes use of [Atomberg public APIs](https://developer.atomberg-iot.com/#overview) to fetch and control your device using the API calls. The plugin also listen to broadcasts on your network to update device state without making unnecessary api calls. All devices that are set up on your Atomberg account will appear in your Home app. If you remove a device from your account, it will also disappear from your Home app after you restart Homebridge.

## Homebridge Setup

### Step 1: Generate API Key

Go to Atomberg Home App and enable Developer Options to get your `API Key` and `Refresh Token`, as mentioned in Step 1 of Quickstart section on [Atomberg Developer Portal](https://developer.atomberg-iot.com/#overview).

### Step 2: Install Plugin

Go to your Homebrige UI and search for Atomberg Fan in the plugins section and select this plugin.

### Step 3: Configure

Once Installed configure the plugin. Enter you API Key and Refresh Token which you got from Atomberg Home App.
You can even enter the details directly to config file incase you aren't using UI.

```
{
  "platforms": [
    {
      "platform": "Atomberg Fan",
      "name": "Homebridge Atomberg Fan",
      "apiKey": "tw******",
      "refreshToken": "ey******",
    }
  ]
}
```

### Step 4: Why not?

That's all, just restart Homebridge and your devices should show up in the Accessories tab of Homebridge. You can now add them to your Apple Home App using homebridge.

## Disclaimer

All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
