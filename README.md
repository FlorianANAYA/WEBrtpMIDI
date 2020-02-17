

![ ](https://i.ibb.co/YDQgTnz/image.png)

# WEBrtpMIDI
This repo is a small project aiming to replicate the DMX console Eurolight LC2412 in the WEB browser to be used remotely on any device.
It can also be used with any other MIDI device.

basically, WEBrtpMIDI transmits every MIDI note it receives to rtpMIDI sessions connected.  It can also receive MIDI notes on a rtpMIDI session and transmit them back to every connected rtpMIDI session. It also serves a web page on which virtual faders are present that also send MIDI notes to rtpMIDI sessions.

![ ](https://i.ibb.co/qrfnmP9/image.png)

As it is, it is not very functional and was created to serve my own needs but I plan to make improvements in order to make it more customizable (see section below for planned features).
It has only been tested on Linux, but most of the features should work on Windows too.
Also, you don't need a high-end computer, as I run it on a 1GHz single core and 1 Go of RAM PC (it uses only ~20Mo).

## Features

 - Possibility to use several MIDI devices at the same time, and to enable and disable any of them at any time
 - Connection of several rtpMIDI clients
 - Possibility to name the faders (the names are automatically senton all connected web clients)
 - The values inserted by a web client are instantly sent to other WEB client (including fader names)
 - Possibility to change the MIDI channel on which the WEB client is bound to
 - Possibility to shut down the system via the WEB client

## Future development
Here are some improvements I want to incorporate to make this piece of software more useful.

 - Possibility to save (currently, as soon as the software is turned off, everything is lost)
 - Customizable layout (currently, only the LC2412 layout is available, and is hardcoded) with the possibility to save and load layouts. Each layout would consist of faders, textareas, buttons, positionners, etc. Each one of them would have assignable MIDI commands.
 - Add system information (such as CPU load, CPU temperature, etc)
 - Make the design more responsive
 - Make the `midi` library optional because it needs system packages that are sometimes undesirable.
 - Add a real config file
## Installation
This tutorial is for Linux.
The project runs on nodejs and currently needs four npm packages :

    express
    socket.io
    rtpmidi
    midi

The `midi` package needs `alsa` and a few system packages to work correctly.
We will assume in this tutorial  that you want to run this software on a user called `webmidi`.

Let's start by installing system packages necessary to install and run the `midi` package :

    sudo apt-get install alsa-utils libasound2-dev make g++ git
Then we add the user and right away add it to the `audio` group to access MIDI devices :

    sudo adduser webmidi
    sudo adduser webmidi audio
You can now login as user `webmidi`.
Let's now install nodejs. We are going to use the version manager [nvm](https://github.com/nvm-sh/nvm) for that purpose.

    wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.1/install.sh | bash
    export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
I think it is fine to install any recent version of nodejs, but WEBrtpMIDI has only been tested on version `8.16.0` (because my production PC that runs it is very resource limited so I picked a version that is available precompiled).

    node install
or

    node install 8.16.0
We are now going to install the npm packages dependencies.

    npm install express
    npm install socket.io
    npm install rtpmidi
    npm install midi
Let's now download WEBrtpMIDI.

    git clone https://github.com/FlorianFun/WEBrtpMIDI
It will create a folder called `WEBrtpMIDI`, we change directory to it :

    cd WEBrtpMIDI

By default, the WEB server start on port 3000. It is possible to change it by editing `Main.js`.

    nano Main.js
The line to edit is the following :

    const port = 3000;
On Linux, you need to allow a non root user to use port under 1023 or the application will fail to launch. You can do this with this command (the path has to be edited to the real node installation path. Also, note that this command allows the use of every ports under 1023, there are other ways to achieve this) :

    sudo setcap CAP_NET_BIND_SERVICE=+eip /home/webmidi/.nvm/versions/node/v8.16.0/bin/node
Now we want to allow the user to shutdown the computer (this is not mandatory, but if you want to use this feature, you need to do this). You can also change the command executed in the code (look for the word `shutdown` in `Main.js`).
One way to allow the user is to use `sudo`. There are several other ways so feel free to use whatever method you prefer.

    sudo nano /etc/sudoers
Add the following line :

    webmidi ALL=NOPASSWD: /sbin/shutdown
You can now launch the application.

    node Main.js
    
