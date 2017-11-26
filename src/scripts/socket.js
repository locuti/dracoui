var inventory = window.inventoryService;

function setUserName(user) {
    if (!global.user) {
        global.user = user;
        document.title = `[${user}] ${document.title}`;
    }
}

function startTimers() {
    // Get Player Stats every 5 minutes
    window.setInterval(() => {
        if (global.connected) {
            global.ws.emit("player_stats");
        }
    }, 1000*60*5);

    // Update pokestop status every minutes
    // window.setInterval(() => {
    //     if (global.connected) {
    //         global.map.updatePokestopsStatus();
    //     }
    // }, 1000*60);
}

function startListenToSocket() {
    // inventory.init(global.config.locale);
    console.log("Connecting to " + global.config.websocket);

    startTimers();

    var pkmSettings = localStorage.getItem("pokemonSettings");
    if (pkmSettings) {
        global.pokemonSettings = JSON.parse(pkmSettings);
    } else {
        global.pokemonSettings = {};
    }

    var socket = io(global.config.websocket, { transports: ['websocket', 'polling'] });
    global.ws = socket;

    socket.on('connect', () => {
        console.log("Connected to Bot");
        global.connected = true;
        $(".loading").text("Waiting to get GPS coordinates from client...");
    });

    socket.on('disconnect', () => {
        global.connected = false;
    });
    
    socket.on("initialized", msg => {
        if (msg.username) {
            console.log("Bot Ready.");
            console.log(msg);
            setUserName(msg.username);
            global.player = msg.player;
            if (global.player) {
                $(".player").trigger("pogo:player_update");
                ga("send", "event", "level", global.player.level);
            }
            global.storage = msg.storage;
            global.map.addToPath(msg.pos);
        }
        $(".toolbar div").show();
        global.ws.emit("pokemon_settings");
    });
    socket.on("pokemon_settings", msg => {
        global.pokemonSettings = msg;
        localStorage.setItem("pokemonSettings", JSON.stringify(global.pokemonSettings));
    });
    socket.on("player_stats", msg => {
        console.log(msg);
        global.player = msg.player;
        $(".player").trigger("pogo:player_update");
    });
    socket.on('position', pos => {
        if (!global.snipping) {
            global.map.addToPath(pos);
        }
    });
    socket.on('buildings', buildings => {
        // console.log("Update Buildings");
        // console.log(buildings);
        var pillars = Array.from(buildings.filter(b => b.type === 0), f => {
            return {
                id: f.id,
                lat: f.coords.latitude,
                lng: f.coords.longitude,
                cooldown: f.pitstop.cooldown,
                lureExpire: false, //f.pitstop ? +f.pitstop.lureTimeLeft
            }
        });
        global.map.addBuildings(pillars);

        var arenas = Array.from(buildings.filter(b => b.type === 1), f => {
            return {
                id: f.id,
                lat: f.coords.latitude,
                lng: f.coords.longitude,
                arena: f.arena
            }
        });
        global.map.addArena(arenas);

        var obelisks = Array.from(buildings.filter(b => b.type === 2), f => {
            return {
                id: f.id,
                lat: f.coords.latitude,
                lng: f.coords.longitude
            }
        });
        global.map.addObelisk(obelisks);

        var libraries = Array.from(buildings.filter(b => b.type === 3), f => {
            return {
                id: f.id,
                lat: f.coords.latitude,
                lng: f.coords.longitude,
                arena: f.arena
            }
        });
        global.map.addLibrary(libraries);

        var altars = Array.from(buildings.filter(b => b.type === 4), f => {
            return {
                id: f.id,
                lat: f.coords.latitude,
                lng: f.coords.longitude
            }
        });
        global.map.addAltar(altars);

        var portals = Array.from(buildings.filter(b => b.type === 5), f => {
            return {
                id: f.id,
                lat: f.coords.latitude,
                lng: f.coords.longitude
            }
        });
        global.map.addObelisk(portals);
    });
    socket.on('building_visited', building => {
        console.log("Building Visited");
        console.log(building);
        global.map.addVisitedBuilding({
            id: building.id,
            name: "",
            lat: building.coords.latitude,
            lng: building.coords.longitude,
            cooldown: building.pitstop.cooldown,
            // lureExpire: parseInt(building.lure_expires_timestamp_ms) || null,
            visited: true
        });
    });
    socket.on('creature_caught', msg => {
        console.log("Creature caught");
        console.log(msg);
        var creature = msg.creature;
        if (msg.position) {
            creature.lat = msg.position.lat;
            creature.lng = msg.position.lng;
        }
        global.map.addCatch(creature);
        creatureToast(creature, { ball: creature.ball });
    });
    socket.on("pokemon_evolved", msg => {
        //console.log(msg);
        var info = {
            id: msg.evolution,
            name: inventory.getPokemonName(msg.evolution)
        };
        var from = inventory.getPokemonName(msg.pokemon.pokemon_id)
        creatureToast(info, { title: `A ${from} evolved` });
    });
    socket.on("inventory_list", items => {
        console.log(items);
        global.map.displayInventory(items);
    });
    socket.on("creature_list", msg => {
        console.log(msg);
        var creatures = msg.creatures.map(c => {
            c.iv = (10 * (c.attackValue + c.staminaValue)).toFixed(0);
            return c;
        });
        global.map.displayCreatureList(creatures, null, msg.eggs_count);
    });
    socket.on("eggs_list", msg => {
        console.log(msg);
        global.map.displayEggsList(msg.eggs, msg.max);
    });
    socket.on("route", route => {
        // console.log("New route received");
        // console.log(route);
        global.map.setRoute(route);
    });
    socket.on("manual_destination_reached", () => {
        global.map.manualDestinationReached();
    });

    global.ws = socket;
}

function errorToast(message) {
    toastr.error(message, "Error", {
        "progressBar": true,
        "positionClass": "toast-top-right",
        "timeOut": "5000",
        "closeButton": true
    });
}

function creatureToast(creature, options) {
    if (global.config.noPopup) return;

    options = options || {};
    var title = options.title || ( global.snipping ? "Snipe success" : "Catch success" );
    var toast = global.snipping ? toastr.success : toastr.info;
    var creatureInfo = creature.display;
    if (creature.level) creatureInfo += ` (lvl ${creature.level})`;

    let padId = creature.name.toString();
    if(padId.length == 1) padId = '00' + padId;
    if(padId.length == 2) padId = '0' + padId;

    var content = `<div>${creatureInfo}</div><div>`;
    content += `<img src='./assets/creatures/${padId}.png' height='50' />`;
    if (options.ball) content += `<img src='./assets/inventory/${options.ball}.png' height='30' />`;
    content += `</div>`;
    toast(content, title, {
        "progressBar": true,
        "positionClass": "toast-top-right",
        "timeOut": 5000,
        "closeButton": true
    })
}
