<p align="center">
    <img src="https://raw.githubusercontent.com/liberodark/Odrive/master/public/logo.png" width="500">    
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
sudo npm install -g electron webpack eslint
```

Note: If you're using Linux Bash for Windows, [see this guide](https://www.howtogeek.com/261575/how-to-run-graphical-linux-desktop-applications-from-windows-10s-bash-shell/) or use `node` from the command prompt.

Note 2: If you're using Ubuntu and you get an error message about a missing node binary, you may want to try [this](https://stackoverflow.com/questions/18130164/nodejs-vs-node-on-ubuntu-12-04): 

```sudo ln -s `which nodejs` /usr/bin/node```

## Build

This step is to execute every new version of the source code.

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

On Windows, you can make a `.bat` file with `start cmd /k nmp start` that then you can double click to launch the program.

## Testing

To make sure the code is ok and run some sanity checks on it:

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
npm run package-linux
```
For Mac :
```bash
npm run package-mac
```

For Windows :
```bash
npm run package-win
```

## License

[GPL v3](LICENSE.md)
