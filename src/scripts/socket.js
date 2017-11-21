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
        console.log("Update Buildings");
        // console.log(buildings);
        var forts = Array.from(buildings.filter(b => b.type === 0), f => {
            return {
                id: f.id,
                lat: f.coords.latitude,
                lng: f.coords.longitude,
                cooldown: f.pitstop.cooldown,
                lureExpire: false, //f.pitstop ? +f.pitstop.lureTimeLeft
            }
        });
        global.map.addBuildings(forts);
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
        creatureToast(info, { title: `A ${from} Evolved` });
    });
    socket.on("inventory_list", items => {
        console.log(items);
        global.map.displayInventory(items);
    });
    socket.on("creature_list", msg => {
        console.log(msg);
        // var pkm = Array.from(msg.creatures, creature => {
        //     var pkmInfo = global.pokemonSettings[p.pokemon_id - 1] || {};
        //     return {
        //         id: p.id,
        //         pokemonId: p.pokemon_id,
        //         inGym: p.deployed_fort_id != "",
        //         isBad: p.is_bad,
        //         canEvolve: pkmInfo.evolution_ids && pkmInfo.evolution_ids.length > 0,
        //         cp: p.cp,
        //         iv: (100.0 * (p.individual_attack + p.individual_defense + p.individual_stamina)/45.0).toFixed(1),
        //         level: inventory.getPokemonLevel(p),
        //         name: p.nickname || inventory.getPokemonName(p.pokemon_id),
        //         candy: (msg.candy[pkmInfo.family_id] || {}).candy || 0,
        //         candyToEvolve: pkmInfo.candy_to_evolve,
        //         favorite: p.favorite == 1,
        //         stats: {
        //             atk: p.individual_attack,
        //             def: p.individual_defense,
        //             hp: p.individual_stamina,
        //             maxHp: p.stamina_max,
        //             sta: p.stamina
        //         }
        //     };
        // });
        global.map.displayCreatureList(msg.creatures, null, msg.eggs_count);
    });
    socket.on("eggs_list", msg => {
        console.log(msg);
        msg.km_walked = msg.km_walked || 0;
        var incubators = msg.egg_incubators.filter(i => i.target_km_walked != 0 || i.start_km_walked != 0);
        incubators = Array.from(incubators, i => {
            return {
                type: i.item_id == 901 ? "incubator-unlimited" : "incubator",
                totalDist: i.target_km_walked - i.start_km_walked,
                doneDist: msg.km_walked - i.start_km_walked
            }
        });
        var eggsInIncub = Array.from(msg.egg_incubators, i => i.pokemon_id);
        var eggs = Array.from(msg.eggs.filter(e => eggsInIncub.indexOf(e.id) < 0), i => {
            return {
                type: "egg",
                totalDist: i.egg_km_walked_target,
                doneDist: i.egg_km_walked_start
            }
        });
        global.map.displayEggsList(incubators.concat(eggs));
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
    var creatureInfo = creature.name;
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
