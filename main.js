let client = require("discord-rich-presence")("744025052118253578");
const exec = require("child_process").exec;
const fs = require("fs");
const { app, Menu, Tray, nativeImage } = require("electron");

//icon
let image = nativeImage.createFromPath(__dirname + "/EDLogo.ico");
image.setTemplateImage(true);

//electron system tray
let tray = app.whenReady().then(() => {
    tray = new Tray("EDLogo.ico");
    const contextMenu = Menu.buildFromTemplate([
        {label: "Exit", type: "normal", click() {
            app.quit();
            process.exit(0);
        }}
    ]);
    tray.setToolTip("Elite Dangerous Rich Presence for Discord");
    tray.setContextMenu(contextMenu);
});

let logPath = `${process.env.USERPROFILE}/Saved Games/Frontier Developments/Elite Dangerous`;
let logFile;
let isPlaying = false;
let startTime;
let lastLogIndex = 0;
let firstRefreshDone = false;

let shipNames = [
    "adder", "Adder",
    "typex_3", "Alliance Challenger",
    "typex", "Alliance Chieftain",
    "typex_2", "Alliance Crusader",
    "anaconda", "Anaconda",
    "asp", "Asp Explorer",
    "asp_scout", "Asp Scout",
    "belugaliner", "Beluga Liner",
    "cobramkiii", "Cobra MK III",
    "cobramkiv", "Cobra MK IV", //not verified
    "diamondbackxl", "Diamondback Explorer",
    "diamondback", "Diamondback Scout",
    "dolphin", "Dolphin",
    "eagle", "Eagle",
    "federation_dropship_mkii", "Federal Assault Ship",
    "federation_corvette", "Federal Corvette",
    "federation_dropship", "Federal Dropship",
    "federation_gunship", "Federal Gunship",
    "ferdelance", "Fer-de-Lance",
    "hauler", "Hauler",
    "sidewinder", "Sidewinder",
    "empire_eagle", "Imperial Eagle",
    "independent_trader", "Keelback",
    "krait_mkii", "Krait MK II",
    "krait_light", "Krait Phantom",
    "mamba", "Mamba",
    "orca", "Orca",
    "python", "Python",
    "sidewinder", "Sidewinder",
    "type9_military", "Type 10",
    "type6", "Type 6",
    "type_7", "Type 7",
    "type_9", "Type 9",
    "viper", "Viper MK III",
    "viper_mkiv", "Viper MK IV",
    "vulture", "Vulture"
];

//info for rich presence
let cmdrName;
let shipName;
let systemName;
let bodyName;
let supercruising = false;
let nearPlanet;
let planetName;
let inSRV = false;

refresh();

setInterval(() => {
    refresh();
}, 5000);

function refresh() {
    //check if the Elite Dangerous client is running (not the launcher)
    exec("tasklist", (err, stdout, stderr) => {
        if (stdout.indexOf("EliteDangerous64") !== -1) {
            if (isPlaying === false) {
                startTime = Date.now();
                isPlaying = true;
            }
            watchLogFile();

            //set rich presence
            let cmdrText;
            let systemText;
            if (bodyName === systemName) bodyName = undefined;
            if (systemName) systemText = `${systemName} System`
            if (cmdrName) cmdrText = `CMDR ${cmdrName}`;
            let shipText;
            let imageKeyText;
            if (shipName) {
                if (inSRV === true) shipName = "Scarab";
                else if (shipNames.indexOf(shipName) !== -1 && shipNames.indexOf(shipName) % 2 === 0) shipName = shipNames[shipNames.indexOf(shipName) + 1];
                shipText = shipName;
                imageKeyText = shipName.toLowerCase();
                while (imageKeyText.indexOf(" ") !== -1) imageKeyText = imageKeyText.replace(" ", "");
                while (imageKeyText.indexOf("-") !== -1) imageKeyText = imageKeyText.replace("-", "");
            }

            client.updatePresence({
                details: systemText,
                state: bodyName,
                startTimestamp: startTime,
                largeImageKey: imageKeyText,
                largeImageText: shipText,
                smallImageKey: "edlogo",
                smallImageText: cmdrText
            });
        }
        else {
            if (isPlaying === true) {
                client.disconnect();
                client = require("discord-rich-presence")("744025052118253578");
                if (logFile) fs.unwatchFile(`${logPath}/${logFile}`);
            }
            isPlaying = false;
        }
    });
}

function watchLogFile() {
    files = fs.readdirSync(logPath);
    //get latest log file
    let dates = [];
    for (file of files) {
        if (file.endsWith(".log")) dates.push(file.substring(file.indexOf("Journal.") + 8, file.indexOf(".01")));
    }
    let latest = dates.sort().reverse()[0];

    let templogFile = files.find(file => file.indexOf(latest) !== -1);
    if (logFile !== templogFile || firstRefreshDone === false) {
        firstRefreshDone = true;
        lastLogIndex = 0;
        let lastLogFile = logFile;
        logFile = templogFile;
        //watch latest log file
        fs.watchFile(`${logPath}/${logFile}`, {encoding: "utf-8"}, (current, previous) => {
            updateInfo();
        });
        fs.unwatchFile(`${logPath}/${lastLogFile}`);
    }
}

function updateInfo() {
    let data = fs.readFileSync(`${logPath}/${logFile}`, "utf-8");
    let lines = data.split("\n");
    let newLogs = [];
    for (let i = lastLogIndex; i < lines.length - 1; i++) {
        newLogs.push(JSON.parse(lines[i]));
    }
    lastLogIndex = lines.length - 2;

    for (e of newLogs) {
        switch(e.event) {
            case "LoadGame": //Commander, Ship
                console.log(`LoadGame - Commander: ${e.Commander}`);
                cmdrName = e.Commander;
            break;

            case "Location": //StarSystem, Body, StationName
                console.log(`Location - StarSystem: ${e.StarSystem}, Body: ${e.Body}, StationName: ${e.StationName}`);
                systemName = e.StarSystem;
                if (e.StationName) bodyName = e.StationName;
                else if (e.Body) bodyName = e.Body;
                else bodyName = undefined;
                if (e.Body && !e.StationName) nearPlanet = true;
            break;

            case "DockingRequested": //StationName
                console.log(`DockingRequested - StationName: ${e.StationName}`);
                bodyName = e.StationName;
            break;

            case "Docked": //StationName, StarSystem
                console.log(`Docked - StationName: ${e.StationName}, StarSystem: ${e.StarSystem}`);
                systemName = e.StarSystem;
                bodyName = e.StationName;
            break;

            case "FSDJump": //StarSystem
                console.log(`FSDJump - StarSystem: ${e.StarSystem}`);
                systemName = e.StarSystem;
                bodyName = undefined;
                supercruising = false;
                nearPlanet = false;
            break;

            case "SupercruiseEntry": //StarSystem
                console.log(`SupercruiseEntry - StarSystem: ${e.StarSystem}`);
                systemName = e.StarSystem;
                if (nearPlanet === true) bodyName = planetName;
                else bodyName = undefined;
                supercruising = true;
            break;

            case "SupercruiseExit": //StarSystem, Body
                console.log(`SupercruiseExit - StarSystem: ${e.StarSystem}`);
                systemName = e.StarSystem;
                supercruising = false;
            break;

            case "ShipyardSwap": //ShipType
                console.log(`ShipyardSwap - ShipType: ${e.shipType}`);
                shipName = e.ShipType;
            break;

            case "LaunchSRV":
                console.log("LaunchSRV");
                inSRV = true;
            break;

            case "DockSRV":
                console.log("DockSRV");
                inSRV = false;
            break;

            case "Loadout": //Ship
                console.log(`Loadout - Ship: ${e.Ship}`);
                shipName = e.Ship;
            break;

            case "ApproachBody": //StarSystem, Body
                console.log(`ApproachBody - StarSystem: ${e.StarSystem}, Body: ${e.Body}`);
                systemName = e.StarSystem;
                bodyName = e.Body;
                nearPlanet = true;
                planetName = e.Body;
            break;

            case "LeaveBody": //StarSystem, Body
                console.log(`LeaveBody - StarSystem: ${e.StarSystem}, Body: ${e.Body}`);
                systemName = e.StarSystem;
                bodyName = undefined;
                supercruising = true;
                nearPlanet = false;
            break;

            case "Undocked": //StationName
                console.log(`Undocked - StationName: ${e.StationName}`);
                if (nearPlanet === true) bodyName = undefined;
            break;
        }
    }
}