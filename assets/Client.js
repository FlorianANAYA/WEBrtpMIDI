var socket;

var faders;
var buttons;
var positionners;

var currentlyActivatedPositionner = null;




/*
 * Fader class
 */
function Fader(name)
{
    this.m_value = 0;
    this.m_name = name;
    this.m_displayText = "";
}
Fader.prototype.m_value = 0;
Fader.prototype.m_name = "";
Fader.prototype.m_displayText = "";

/*
 * Puts this Fader's value into the HTML slider and the HTML textarea
 */
Fader.prototype.Update = function()
{
    var slider = document.getElementById(this.m_name);
    var textField = document.getElementById("name" + this.m_name);
    
    slider.value = this.m_value;
    textField.value = this.m_displayText;
};

/*
 * Positionner class
 */
function Positionner(name)
{
    this.m_name = name;
    this.m_X = 150;
    this.m_Y = 150;
    var positionner = this;
    
    setTimeout(function()
    {
        var container = document.getElementById(positionner.m_name);
        positionner.m_lineX = document.createElement("div", {id: positionner.m_name + "LineX"});
        positionner.m_lineX.className = "horizontalPositionnerLine";
        container.appendChild(positionner.m_lineX);

        positionner.m_lineY = document.createElement("div", {id: positionner.m_name + "LineY"});
        positionner.m_lineY.className = "verticalPositionnerLine";
        container.appendChild(positionner.m_lineY);
        container.gPositionner = positionner;
    }, 1);
}

Positionner.prototype.Update = function()
{
    this.m_lineY.style.marginLeft = this.m_X + "px";
    this.m_lineX.style.marginTop = this.m_Y + "px";
};

Positionner.prototype.m_name = "";
Positionner.prototype.m_X = 63;
Positionner.prototype.m_Y = 63;
Positionner.prototype.m_lineX = null;
Positionner.prototype.m_lineY = null;

/*
 * Button class
 */
function Button(name)
{
    this.m_name = name;
    this.m_displayText = "";
}

Button.prototype.m_name = "";
Button.prototype.m_displayText = "";



/*
 * Function called when a slider changes value
 */
function onSliderInput(faderName)
{
    window.faders[faderName].m_value = Number(document.getElementById(faderName).value);
    if (typeof socket !== 'undefined')
    {
        socket.emit("faderUpdate", {name: faderName, value: faders[faderName].m_value});
    }
}

/*
 * Function called when a button is pressed
 */
function onButtonPress(buttonName)
{
    console.log("ButtonPress " + buttonName);
    if (typeof socket !== 'undefined')
        socket.emit("buttonPress", {name: buttonName});
}

/*
 * Function called when the "shutdown" button is pressed
 */
function onButtonShutdown()
{
    if (confirm("Shutdown the system ? ?"))
    {
        console.log("Message sent to server to shutdown");
        socket.emit("shutdown", true);
    }
}

function onMIDIChannelChange(input)
{
    
    socket.emit("midichannel", Number(input.value));
}

function onFaderNameChange(faderName)
{
    faders[faderName].m_displayText = document.getElementById("name" + faderName).value;
    if (typeof socket !== 'undefined')
    {
        socket.emit("faderUpdate", {name: faderName, displayText: faders[faderName].m_displayText});
    }
}

/*
 * Function called when the "midiloop" checkbox is changed
 */
function onMidiLoopChange()
{
    if (typeof socket !== 'undefined')
        socket.emit('midiloop', document.getElementById('midiloop').checked);
}

function onMidiDeviceEnable(checkbox)
{
    console.log("(dés)activation midi device: " + checkbox.name + ", " + checkbox.checked);
    var msg = {};
    msg[checkbox.name] = checkbox.checked;
    socket.emit('mididevice', msg);
}

function onPositionChange(event)
{
    if (currentlyActivatedPositionner !== null)
    {
        var rect = document.getElementById(currentlyActivatedPositionner.m_name).getBoundingClientRect();
        currentlyActivatedPositionner.m_X = event.clientX - rect.left;
        currentlyActivatedPositionner.m_Y = (event.clientY - rect.top);
        if (currentlyActivatedPositionner.m_X < 0)
            currentlyActivatedPositionner.m_X = 0;
        if (currentlyActivatedPositionner.m_X > 300)
            currentlyActivatedPositionner.m_X = 300;

        if (currentlyActivatedPositionner.m_Y < 0)
            currentlyActivatedPositionner.m_Y = 0;
        if (currentlyActivatedPositionner.m_Y > 300)
            currentlyActivatedPositionner.m_Y = 300;
        
        
        currentlyActivatedPositionner.Update();
        
        
        
        socket.emit('PositionnerUpdate',
        {
            name: currentlyActivatedPositionner.m_name,
            X: currentlyActivatedPositionner.m_X * 127 / 300,
            Y: currentlyActivatedPositionner.m_Y * 127 / 300
        });
    }
}

function onPositionnerReset(positionnerName)
{
    var positionner = positionners[positionnerName];
    positionner.m_X = 0;
    positionner.m_Y = 0;
    positionner.Update();
    socket.emit('PositionnerUpdate',
        {
            name: positionnerName,
            X: 0,
            Y: 0
        });
}

function onMouseDown(element)
{
    currentlyActivatedPositionner = element.gPositionner;
}

function onMouseUp()
{
    currentlyActivatedPositionner = null;
}

/**
 * Function called by HTML to start the application
 */
function StartFunction()
{
    console.log("Connecting to WebSocket server...");
    if (typeof io !== 'undefined')
    {
        socket = io();
        console.log("WebSocket connected");
    }
    else
    { // This happens when debugging on local machine
        console.log("Socket.io unavailable");
    }

    faders = {};
    buttons = {};
    positionners = {};
    
    console.log("Creating faders and buttons");
    // Création des faders et boutons
    for (var i = 1; i <= 24; i++)
    {
        faders["fader" + i] = new Fader("fader" + i);
    }
    faders["faderA"] = new Fader("faderA");
    faders["faderB"] = new Fader("faderB");
    faders["faderMain"] = new Fader("faderMain");
    faders["faderChase"] = new Fader("faderChase");
    faders["faderXFade"] = new Fader("faderXFade");
    faders["faderSpeed"] = new Fader("faderSpeed");
    for (var i = 1; i <= 12; i++)
    {
        buttons["button" + i] = new Button("button" + i);
    }
    buttons["buttonSpecial1"] = new Button("buttonSpecial1");
    buttons["buttonSpecial2"] = new Button("buttonSpecial2");
    buttons["buttonPreset"] = new Button("buttonPreset");
    buttons["buttonMemory"] = new Button("buttonMemory");
    buttons["buttonStep"] = new Button("buttonStep");
    buttons["buttonManual"] = new Button("buttonManual");
    buttons["buttonSR"] = new Button("buttonSR");
    
    positionners["positionner1"] = new Positionner("positionner1");
    positionners["positionner2"] = new Positionner("positionner2");
    positionners["positionner3"] = new Positionner("positionner3");
    positionners["positionner4"] = new Positionner("positionner4");
    
    if (typeof socket !== 'undefined')
    {
        socket.on('faderUpdate', function(msg)
        {
            // Checks if the message contains a fader name that exists
            if (msg["name"] && faders[msg["name"]])
            {
                var fader = faders[msg["name"]];
                if (msg["value"])
                {
                    fader.m_value = msg["value"];
                }
                if (typeof msg["displayText"] === "string")
                {
                    fader.m_displayText = msg["displayText"];
                }
                fader.Update();
            }
        });
        
        socket.on('midiloop', function(msg)
        {
            if (typeof msg === "boolean")
                document.getElementById('midiloop').checked = msg;
        });
        
        socket.on('PositionnerUpdate', function(msg)
        {
            if (typeof msg["name"] === "string"
                    && typeof msg["X"] === "number"
                    && typeof msg["Y"] === "number"
                    && typeof positionners[msg["name"]] !== "undefined")
            {
                var positionner = positionners[msg["name"]];
                positionner.m_X = msg["X"] * 300 / 127;
                positionner.m_Y = msg["Y"] * 300 / 127;
                positionner.Update();
            }
        });
        socket.on('mididevice', function(msg)
        {
            var HTML = "";
            for (var devicename in msg)
            {
                if (msg[devicename])
                {
                    HTML += "<input type='checkbox' value='' checked='true' name='" + devicename + "' oninput='onMidiDeviceEnable(this)'>" + devicename + "<br/>";
                }
                else
                {
                    HTML += "<input type='checkbox' value='' name='" + devicename + "' oninput='onMidiDeviceEnable(this)'>" + devicename + "<br/>";
                }
            }
            
            var divall = document.getElementById('mididevices');
            divall.innerHTML = HTML;
        });
        
        socket.on("midichannel", function(msg)
        {
            if (typeof msg === "number")
                document.getElementById("MIDIchannel").value = msg;
        });
    }
};

