/* 
 * Dépendance NPM :
 * - express
 * - socket.io
 * - rtpmidi
 * - midi
 */

var exec = require('child_process').exec;
var rtpmidi = require('rtpmidi');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var midi = require("midi");
var dummyInput = new midi.Input();
var rtpSession;
const port = 3000;

var midiLoop = false;
var midichannel = 0xb0;

var faders = {};
var buttons = {};
var positionners = {};

var midiToFader = {};

// List of currently connected midi devices (but not necessarly in use)
// {DeviceName: MidiDevice}
var connectedMidiDevices = {};
// List of previously connected MIDI devices which are now disconnected.
// We remember the choice of the user of using the device or not in
// case the device is reconnected
// {DeviceName: boolean}
var disconnectedMidiDevices = {};



io.on('connection', function(socket)
{
    console.log("Web client connect: " + socket.conn.remoteAddress);
    // We send faders' values to the client
    for (var name in faders)
    {
        socket.emit('faderUpdate', {"name": name, "value": faders[name].m_value, displayText: faders[name].m_displayText});
    }
    // We send positionners' values to the client
    for (var name in positionners)
    {
        var positionner = positionners[name];
        socket.emit("PositionnerUpdate",
        {
            name: positionner.m_name,
            X: positionner.m_X,
            Y: positionner.m_Y
        });
    }
    // We send currently connected MIDI devices to the client
    var msg = {};
    for (var name in connectedMidiDevices)
    {
        msg[name] = connectedMidiDevices[name].isEnabled();
    }
    socket.emit('mididevice', msg);
    // We send the current midi channel used
    socket.emit("midichannel", midichannel);
    
    // Event fired when receiving an update of the value or display text 
    // of a fader from a web client
    socket.on('faderUpdate', function(msg)
    {
        // Checks if the message contains the name of a valid fader
        if (typeof msg["name"] === "string" && typeof faders[msg["name"]] !== "undefined")
        {
            var fader = faders[msg["name"]];
            // We check if we received a new value for the fader
            if (typeof msg["value"] === "number")
            {
                fader.m_value = msg["value"];
                socket.broadcast.emit('faderUpdate', {"name": fader.m_name, "value": fader.m_value});
                rtpSession.sendMessage([midichannel, fader.m_MIDINote, fader.m_value]);
            }
            // We check if we received a new display text for the fader
            if (typeof msg["displayText"] === "string")
            {
                fader.m_displayText = msg["displayText"];
                socket.broadcast.emit('faderUpdate', {"name": fader.m_name, "displayText": fader.m_displayText});
            }
        }
    });
    
    // Event fired when a web client presses a button
    socket.on('buttonPress', function(msg)
    {
        // We check if the message contains a valid button name
        if (typeof msg["name"] === "string" && typeof buttons[msg["name"]] !== "undefined")
        {
            var button = buttons[msg["name"]];
            // Replicates the press of a button on a LC2412 by sending
            // 127 then 0
            rtpSession.sendMessage([midichannel, button.m_MIDINote, 0x7f]);
            rtpSession.sendMessage([midichannel, button.m_MIDINote, 0x00]);
        }
    });
    
    // Event fired when a web client enables or disables midiloop
    socket.on('midiloop', function(msg)
    {
        if (typeof msg === "boolean")
        {
            midiLoop = msg;
            if (midiLoop)
                console.log("Midi loop is now enabled");
            else
                console.log("Midi loop is now disabled");
            this.broadcast.emit('midiloop', msg);
        }
    });
    
    // Event fired when a client updates the position of a positionner
    socket.on('PositionnerUpdate', function(msg)
    {
        // CHecks if the structure of the message is correct
        if (typeof msg["name"] === "string"
                && typeof msg["X"] === "number"
                && typeof msg["Y"] === "number"
                && typeof positionners[msg["name"]] !== "undefined")
        {
            var positionner = positionners[msg["name"]];
            positionner.m_X = msg["X"];
            positionner.m_Y = msg["Y"];
            this.broadcast.emit('PositionnerUpdate', msg);
            rtpSession.sendMessage([midichannel, positionner.m_midiNoteX, positionner.m_X]);
            rtpSession.sendMessage([midichannel, positionner.m_midiNoteY, positionner.m_Y]);
        }
    });
    
    // Event fired when a web client enables or disables a MIDI device
    socket.on('mididevice', function(msg)
    {
        if (typeof msg === "object")
        {
            for (var devicename in msg)
            {
                if (typeof connectedMidiDevices[devicename] !== "undefined")
                {
                    connectedMidiDevices[devicename].switchState();
                    MidiDevice.sendAllDevicesToClient();
                }
            }
        }
    });
    
    // Event fired when a client pressed the shutdown button
    socket.on("shutdown", function()
    {
        console.log("Shutting down the system...");
        // This only works if the user executing the software has permission
        // to run the shutdown command. Also this is unix way, it shouldn't 
        // work on Windows
        exec("sudo shutdown -h now");
        // Exits the software
        process.exit();
    });
    
    // Event fired when a web client changes the midichannel used.
    // In fact the client changes the complete first byte of 
    // MIDI messages
    socket.on("midichannel", function(msg)
    {
        if (typeof msg === "number" && msg >= 176 && msg <= 191)
        {
            console.log("New MIDI channel: " + msg);
            midichannel = msg;
            this.broadcast.emit("midichannel", midichannel);
        }
    });
    
    socket.on('disconnect', function()
    {
        console.log("Web client disconnect: " + this.conn.remoteAddress);
    });
});

function Main()
{
    // Creation of the web server
    app.use('/assets', express.static('assets'));
    app.get('/', function(req, res)
    {
        res.sendFile(__dirname + "/index.html");
    });
    http.listen(port, function()
    {
        console.log("WEB server started on port " + port);
    });
    
    rtpSession = rtpmidi.manager.createSession({"localName": "rtpMIDIWEBServer", "address": "127.0.0.1", "bonjourName": "rtpMIDIWEBServer", "port": 5004});
    
    rtpSession.on('ready', function()
    {
        console.log("rtpMIDI session ready");
    });
    
    rtpSession.on('streamAdded', function(event)
    {
        console.log('rtpMIDI client connect: "' + event.stream.name + '"');
    });
    
    // Event fired when receiving a MIDI message from a rtpMIDI client
    rtpSession.on('message', function(deltaTime, message)
    {
        // We check if a fader is bound to the received MIDI note
        if (typeof midiToFader[message[1]] !== "undefined")
        {
            var fader = midiToFader[message[1]];
            fader.m_value = message[2];
            io.emit('faderUpdate', {"name": fader.m_name, "value": fader.m_value});
        }
        // If MIDI loop is enabled, we send back the MIDI note to rtpMIDI clients
        if (midiLoop)
        {
            rtpSession.sendMessage(message);
        }
    });
    
    setInterval(searchForMidiDevices, 5000);
    
    // hardcoded faders and buttons creation
    for (var i = 1; i <= 24; i++)
    {
        faders["fader" + i] = new Fader("fader" + i, i - 1);
    }
    faders["faderA"] = new Fader("faderA", 28);
    faders["faderB"] = new Fader("faderB", 29);
    faders["faderMain"] = new Fader("faderMain", 27);
    faders["faderChase"] = new Fader("faderChase", 26);
    faders["faderXFade"] = new Fader("faderXFade", 25);
    faders["faderSpeed"] = new Fader("faderSpeed", 24);
    for (var i = 1; i <= 12; i++)
    {
        buttons["button" + i] = new Button("button" + i, i + 30);
    }
    buttons["buttonSpecial1"] = new Button("buttonSpecial1", 47);
    buttons["buttonSpecial2"] = new Button("buttonSpecial2", 48);
    buttons["buttonPreset"] = new Button("buttonPreset", 52);
    buttons["buttonMemory"] = new Button("buttonMemory", 53);
    buttons["buttonStep"] = new Button("buttonStep", 30);
    buttons["buttonManual"] = new Button("buttonManual", 49);
    buttons["buttonSR"] = new Button("buttonSR", 50);
    
    // Hardcoded positionner creation
    for (var i = 1; i <= 4; i++)
    {
        positionners["positionner" + i] = new Positionner("positionner" + i, 60 + (i * 2), 61 + (i * 2));
    }
}

// Function executed every 5 seconds that search for new MIDI devices and
// disables disconnected MIDI devices
function searchForMidiDevices()
{
    // List of all currently connected MIDI devices
    var connectedList = [];
    // Defines if modifications in the device list have been made
    var modifs = false;
    
    // We search for new MIDI devices
    for (var i = 0; i < dummyInput.getPortCount(); i++)
    {
        var name = dummyInput.getPortName(i);
        connectedList.push(name);
        if (typeof connectedMidiDevices[name] === "undefined")
        { // The device is not in our list of devices
            if (typeof disconnectedMidiDevices[name] === "undefined")
            { // The device has never been connected
                console.log("New MIDI device: " + name);
                connectedMidiDevices[name] = new MidiDevice(name, i);
            }
            else
            { // The device has already been connected
                console.log("MIDI device reconnected: " + name);
                connectedMidiDevices[name] = new MidiDevice(name, i);
                if (disconnectedMidiDevices[name])
                    connectedMidiDevices[name].connect();
            }
            modifs = true;
        }
    }
    
    
    var registeredList = Object.keys(connectedMidiDevices);
    // We check if a known MIDI device has been disconnected
    for (var i = 0 ; i < registeredList.length; i++)
    {
        var name = registeredList[i];
        if (!findInArray(name, connectedList))
        { // If a known device is not found in the list of connected device
            console.log("Disconnected MIDI device: " + name);
            disconnectedMidiDevices[name] = connectedMidiDevices[name].isEnabled();
            if (connectedMidiDevices[name].isEnabled())
                connectedMidiDevices[name].disconnect();
            delete connectedMidiDevices[name];
            modifs = true;
        }
    }
    // If modifications have been made, we send everything to clients
    if (modifs)
        MidiDevice.sendAllDevicesToClient();
}


/**
 * This function searchs a string in an array of strings
 * @param {string} strToFind The string we want to find in the array
 * @param {Array} ArrayToSearch The array to search in
 * @returns {boolean} true if the string has been found
 */
function findInArray(strToFind, ArrayToSearch)
{
    for (var i = 0; i < ArrayToSearch.length; i++)
    {
        var str = ArrayToSearch[i];
        if (str.localeCompare(strToFind) === 0)
        {
            return true;
        }
    }
    return false;
}

/*
 * Fader class
 */
function Fader(name, midiNote)
{
    this.m_value = 0;
    this.m_name = name;
    this.m_displayText = "";
    this.m_MIDINote = midiNote;
    
    midiToFader[midiNote] = this;
    
}
Fader.prototype.m_value = 0;
Fader.prototype.m_name = "";
Fader.prototype.m_displayText = "";
Fader.prototype.m_MIDINote = 0;

/*
 * Button class
 */

function Button(name, midiNote)
{
    this.m_name = name;
    this.m_displayText = "";
    this.m_MIDINote = midiNote;
}

Button.prototype.m_name = "";
Button.prototype.m_displayText = "";
Button.prototype.m_MIDINote = 0;

/*
 * Positionner class
 */
function Positionner(name, midiNoteX, midiNoteY)
{
    this.m_name = name;
    this.m_X = 63;
    this.m_Y = 63;
    this.m_midiNoteX = midiNoteX;
    this.m_midiNoteY = midiNoteY;
}


Positionner.prototype.m_name = "";
Positionner.prototype.m_X = 63;
Positionner.prototype.m_Y = 63;
Positionner.prototype.m_midiNoteX = 0;
Positionner.prototype.m_midiNoteY = 0;

/*
 * MidiDevice class
 */
function MidiDevice(name, portID)
{
    this.m_name = name;
    this.m_portID = portID;
}

MidiDevice.prototype.m_name = "";
MidiDevice.prototype.m_portID = 0;
MidiDevice.prototype.m_input;

MidiDevice.prototype.connect = function()
{
    console.log("Enabling MIDI device: " + this.m_name);
    this.m_input = new midi.Input();
    this.m_input.openPort(this.m_portID);
    this.m_input.on('message', function(deltaTime, message)
    {
        rtpSession.sendMessage(message);
        if (typeof midiToFader[message[1]] !== "undefined")
        {
            var fader = midiToFader[message[1]];
            fader.m_value = message[2];
            io.emit('faderUpdate', {"name": fader.m_name, "value": fader.m_value});
        }
    });
};

MidiDevice.prototype.disconnect = function()
{
    console.log("Disabling MIDI device " + this.m_name);
    this.m_input.closePort();
    delete this.m_input;
};

MidiDevice.prototype.switchState = function()
{
    if (this.isEnabled())
    {
        this.disconnect();
    }
    else
    {
        this.connect();
    }
};

MidiDevice.prototype.isEnabled = function()
{
    return !(typeof this.m_input === "undefined");
};

MidiDevice.prototype.setPortID = function(portID)
{
    this.m_portID = portID;
};

// Static function to send midi devices to all WEB clients
MidiDevice.sendAllDevicesToClient = function()
{
    var msg = {};
    for (var devicename in connectedMidiDevices)
    {
        msg[devicename] = connectedMidiDevices[devicename].isEnabled();
    }
    io.emit('mididevice',msg);
};


/*
 * Sript execution
 */

Main();