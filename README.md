<p align="center">
    <img src="https://raw.githubusercontent.com/liberodark/Odrive/master/logo.jpg" width="500">    
</p>
<p align="center">
  <b>Sync your files and folders simply</b>
</p>

# ODrive

**Clone and run for a quick way to see ODrive (OpenSource Drive) in action.**

This is a GUI client for Google Drive on linux application based on the https://electron.atom.io/.

## Supported Operating Systems

- Linux (most distros)
- macOS 10.9 and later
- Microsoft Windows 7 and later

## To Use

To clone and run this repository you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org/en/download/) (which comes with [npm](http://npmjs.com)) installed on your computer. From your command line:

```bash
# Clone this repository
git clone https://github.com/liberodark/ODrive
# Run the app
npm start
```

Note: If you're using Linux Bash for Windows, [see this guide](https://www.howtogeek.com/261575/how-to-run-graphical-linux-desktop-applications-from-windows-10s-bash-shell/) or use `node` from the command prompt.

## Setup

```bash
sudo npm install -g electron webpack eslint
```
## Build

In the project directory:

```bash
npm install
webpack
```

## Run

In the project directory:

```bash
npm start
```

## Testing

To make sure the code is ok:

```bash
npm test
```

## Make Executable

To make a build for your OS:


for use in npm scripts
```bash
npm install electron-packager --save-dev
```
for use from cli
```bash
sudo npm install electron-packager -g
```
For Linux :
```bash
electron-packager . --overwrite --platform=linux --arch=x64 --prune=true --out=release-builds
```
For Mac :
```bash
electron-packager . --overwrite --platform=darwin --arch=x64 --prune=true --out=release-builds
```

For Windows :
```bash
electron-packager . --overwrite --platform=win32 --arch=x64 --prune=true --out=release-builds
```

## License

[GPL v3](LICENSE.md)
