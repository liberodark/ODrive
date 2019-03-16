<p align="center">
    <img src="https://raw.githubusercontent.com/liberodark/Odrive/master/public/images/logo.png" width="500">    
</p>
<p align="center">
  <b>Sync your files and folders simply</b>
</p>

</p>
<p align="center">
  <a href="https://www.patreon.com/odrive">
	<img alt="Patreon" src="https://c5.patreon.com/external/logo/become_a_patron_button.png" height="50" />
</a>

<a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=3XL3UN5WFNW2Y&source=url">
	<img src="https://avaazimages.s3.amazonaws.com/paypal_donate_button.jpg" height="50"  />
</a>
</p>

# ODrive

**Clone and run for a quick way to see ODrive (OpenSource Drive) in action.**

- This is a GUI client for Google Drive on linux application based on the https://electron.atom.io/.

## Supported Operating Systems

[![Snap Status](https://build.snapcraft.io/badge/liberodark/ODrive.svg)](https://build.snapcraft.io/user/liberodark/ODrive)
![Travis Status](https://travis-ci.org/liberodark/ODrive.svg?branch=master)

- Linux (most distros)
- Arch Linux (https://aur.archlinux.org/packages/odrive-bin/)
- Snap ```sudo snap install --edge odrive```
- Flatpak (https://github.com/flathub/io.github.liberodark.OpenDrive)
- macOS 10.9 and later
- Microsoft Windows 7 and later

## To Use

To clone and run this repository you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org/en/download/) (which comes with [npm](http://npmjs.com)) installed on your computer. 

The first thing you need is the source code, in your command line:

```bash
# Clone this repository
git clone https://github.com/liberodark/ODrive
```
This will download all the source code in a "ODrive" folder in the current directory. Alternatively, you can download and extract the zip from github's interface.

The steps below (Setup, Build, Run) are to execute in order to ready everything. 

## Setup

This step is only needed once, in order to install the necessary environment on your computer for ODrive to run.

```bash
# Needed for electron 1.7+ to run, as it's based on chrome
sudo apt install libgconf-2-4
```

Note: If you're using Linux Bash for Windows, [see this guide](https://www.howtogeek.com/261575/how-to-run-graphical-linux-desktop-applications-from-windows-10s-bash-shell/) or use `node` from the command prompt.

## Build

This step is to execute every new version of the source code.

In the project directory:

```bash
npm install
```

Note: If you're using Ubuntu and you get an error message about a missing node binary, you may want to try [this](https://stackoverflow.com/questions/18130164/nodejs-vs-node-on-ubuntu-12-04): 

```sudo ln -s `which nodejs` /usr/bin/node```

If you are working on the code yourself and editing some files in `app/assets/`, you will need to run `npm run webpack` (or `npm install`) for those changes to have an impact on the application.

## Run

In the project directory:

```bash
npm start
```

On Windows, you can make a `.bat` file with `start cmd /k nmp start` that then you can double click to launch the program.

The launch-on-startup functionality is only available on bundled releases. See the **Deployment** section.

## Testing

To make sure the code is ok and run some sanity checks on it:

```bash
npm test
```

## Deployment

### Releases

There are currently three "release" formats supported: nsis (Windows installer) for Windows, AppImage for Linux, and DMG for Mac. You can generate them like this:

```bash
npm run release-windows
npm run release-linux
npm run release-mac
```

To create a different format, like a deb or rpm package for example:
```bash
npm run release-linux deb
npm run release-linux rpm
```

The releases are generated in the `dist` folder.

All formats supported by [electron-builder](https://github.com/electron-userland/electron-builder) are available, such as 7z, zip, tar.gz, deb, rpm, freebsd, pacman, p5p, apk, dmg, pkg, mas, nsis, appx, msi...

### Permissionless deployment

An appimage on linux already runs permissionless. Anyway, you can just do:

```bash
# Permissonless deployment
npm run release-windows dir # or zip, 7zip, tar.xz, tar.7z, ...
```

This will create a folder in `dist` that you can just copy to a Windows machine.

## License

[GPL v3](LICENSE.md)
