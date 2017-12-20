
var Map = function(parentDiv) {
    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

    var osmCycle = L.tileLayer('http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png');
    var osmCycleTransport = L.tileLayer('http://{s}.tile2.opencyclemap.org/transport/{z}/{x}/{y}.png');
    var toner = L.tileLayer('http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png');
    var watercolor = L.tileLayer('http://{s}.tile.stamen.com/watercolor/{z}/{x}/{y}.jpg');

    this.buildingTypes = [{"name": "Pillar", "layerName": "Pillars", "icon": "stop_available"
        },{ "name": "Arena", "layerName": "Arenas", "icon": "arena"
        },{ "name": "Obelisk", "layerName": "Obelisks", "icon": "obelisk"
        },{ "name": "Library", "layerName": "Libraries", "icon": "library"
        },{ "name": "Mock", "layerName": "Mocks", "icon": "mock"
        },{ "name": "Portal", "layerName": "Portals", "icon": "portal"
        },{ "name": "DungeonPillar", "layerName": "Dungeon Pillars", "icon": "stop_available"
        },{ "name": "Altar", "layerName": "Altars", "icon": "altar"
        },{ "name": "Roost", "layerName": "Roosts", "icon": "mother_of_dragons"
        }];

    this.layerCatches = L.markerClusterGroup({ maxClusterRadius: 30 });
    this.layerPath = new L.LayerGroup();

    this.map = L.map(parentDiv, {
        layers: [osm, this.layerCatches, this.layerPath]
    });

   var baseLayers = {
        "OpenStreetMap": osm,
        "OpenCycleMap": osmCycle,
        "OpenCycleMap Transport": osmCycleTransport,
        "Toner": toner,
        "Watercolor": watercolor,
    };
    var overlays = {
        "Path": this.layerPath,
        "Catches": this.layerCatches
    };

    this.layerBuildings = [];
    this.buildings = [];
    for (var i = 0; i < this.buildingTypes.length; i++) {
        this.buildings[i] = [];
        var buildingLayer = new L.LayerGroup();
        buildingLayer.addTo(this.map);
        overlays[this.buildingTypes[i].layerName] = buildingLayer;
        this.layerBuildings.push(buildingLayer);
    }

    // save selected base map on click
    L.control.layers(baseLayers, overlays).addTo(this.map);
    this.map.on('baselayerchange', (function(ev) { 
        let name = ev.name;
        localStorage.setItem("layer", name);
    }).bind(this));

    // restore saved base map
    var base = localStorage.getItem("layer");
    if (base) {
        $(`.leaflet-control-layers-base span:contains('${base}')`).first().prev().click();
    }

    this.map.on('singleclick', (function(ev) { this.setDestination(ev.latlng) }).bind(this));

    this.path = null;
    this.route = null;
    this.destination = null;

    this.steps = [];
    this.catches = [];
    this.creatureList = [];
};

Map.prototype.saveContext = function() {
/*
    var pillars = Array.from(this.pillars, p => {
        return {
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            visited: p.visited
        }
    });
*/
    sessionStorage.setItem("available", true);
    sessionStorage.setItem("steps", JSON.stringify(this.steps));
    sessionStorage.setItem("catches", JSON.stringify(this.catches));
//    sessionStorage.setItem("pillars", JSON.stringify(pillars));
}

Map.prototype.loadContext = function() {
    try {
        if (sessionStorage.getItem("available") == "true") {
            console.log("Load data from storage to restore session");

            this.steps = JSON.parse(sessionStorage.getItem("steps")) || [];
            this.catches = JSON.parse(sessionStorage.getItem("catches")) || [];
            //this.pillars = JSON.parse(sessionStorage.getItem("pillars")) || [];

            if (this.steps.length > 0) this.initPath();

            this.initBuildings();
            this.initCatches();

            sessionStorage.setItem("available", false);
        }
    } catch(err) { console.log(err); }
}

Map.prototype.initPath = function() {
    if (this.path != null) return true;

    if (!this.me) {
        var last = this.steps[this.steps.length - 1];
        this.map.setView([last.lat, last.lng], 16);
        this.me = L.marker([last.lat, last.lng], { zIndexOffset: 200 }).addTo(this.map).bindPopup(`${last.lat.toFixed(4)},${last.lng.toFixed(4)}`);
        $(".loading").hide();
    }

    if (this.steps.length >= 2) {
        var pts = Array.from(this.steps, pt => L.latLng(pt.lat, pt.lng));
        this.path = L.polyline(pts, { color: 'red' }).addTo(this.layerPath);
        return true;
    }

    return false;
}

Map.prototype.initCatches = function() {
    for (var i = 0; i < this.catches.length; i++) {
        var pt = this.catches[i];
        var pkmId = String(pt.id);
        pkmId = '0'.repeat(3 - pkmId.length) + pkmId;
        var icon = L.icon({ iconUrl: `./assets/pokemon/${pkmId}.png`, iconSize: [60, 60], iconAnchor: [30, 30]});
        var pkm = `${pt.name} <br /> Cp:${pt.cp} Iv:${pt.iv}%`;
        if (pt.lvl) {
            pkm = `${pt.name} (lvl ${pt.lvl}) <br /> Cp:${pt.cp} Iv:${pt.iv}%`;
        }
        L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 100}).bindPopup(pkm).addTo(this.layerCatches);
    }
}

Map.prototype.initBuildings = function(){
    for(var x = 0; x < this.buildingTypes.length; x++) {
        for (var i = 0; i < this.buildings[x].length; i++) {
            var pt = this.buildings[x][i];
            var iconurl = pt.visited ? `./assets/img/stop_visited.png` : `./assets/img/${this.buildingTypes[x].icon}.png`;
            var icon = L.icon({iconUrl: iconurl, iconSize: [30, 30], iconAnchor: [15, 15]});
            pt.marker = L.marker([pt.lat, pt.lng], {
                icon: icon,
                zIndexOffset: 50
            }).bindPopup(pt.name).addTo(this.layerBuildings[x]);
        }
    }
}

Map.prototype.addToPath = function(pt) {
    this.steps.push(pt);
    if (global.config.memory.limit && this.steps.length > global.config.memory.mathPath) {
        this.layerPath.clearLayers();
        this.path = null;
        var max = Math.floor(global.config.memory.mathPath * 0.7);
        this.steps = this.steps.slice(-max);
    }
    if (this.initPath()) {
        var latLng = L.latLng(pt.lat, pt.lng);
        this.path.addLatLng(latLng);
        this.me.setLatLng(latLng).getPopup().setContent(`${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`);
        if (global.config.followPlayer) {
            this.map.panTo(latLng, { animate: true });
        }
    }
}

Map.prototype.addCatch = function(pt) {
    if (!pt.lat) {
        if (this.steps.length <= 0) return;
        var last = this.steps[this.steps.length - 1];
        pt.lat = last.lat;
        pt.lng = last.lng;
    }

    var info = `${pt.display}<br /> CP:${pt.cp}`; // IV:${pt.iv}%`;
    if (pt.level) {
        info = `${pt.display} (lvl ${pt.level/2}) <br /> CP:${pt.cp}`; // IV:${pt.iv}%`;
    }

    this.catches.push(pt);

    if (global.config.memory.limit && this.catches.length > global.config.memory.maxCaught) {
        console.log("Clean catches");
        var max = Math.floor(global.config.memory.maxCaught * 0.7);
        this.catches = this.catches.slice(-max);
        this.layerCatches.clearLayers();
        this.initCatches();
    } else {
        var creatureType = String(pt.name);
        creatureType = '0'.repeat(3 - creatureType.length) + creatureType;
        var icon = L.icon({ iconUrl: `./assets/creatures/${creatureType}.png`, iconSize: [60, 60], iconAnchor: [30, 30] });
        L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 100 }).bindPopup(info).addTo(this.layerCatches);
    }
}

Map.prototype.addVisitedBuilding = function(pt) {
    if (!pt.lat) return;

    var ps = this.buildings[0].find(ps => ps.id == pt.id);
    if (!ps) {
        this.buildings[0].push(pt);
        ps = pt;
        var icon = L.icon({ iconUrl: `./assets/img/stop_cooldown.png`, iconSize: [30, 30], iconAnchor: [15, 15] });
        pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerBuildings[0]);
    } else {
        Object.assign(ps, pt);
    }

    ps.visited = true;
    if (ps && ps.marker) {
        ps.marker.setIcon(L.icon({ iconUrl: `./assets/img/stop_cooldown.png`, iconSize: [30, 30], iconAnchor: [15, 15] }));
        if (ps.name) ps.marker.bindPopup(ps.name);
        else ps.marker.bindPopup(ps.id);
    }
}

Map.prototype.addBuildings = function(buildings) {
    for(var i = 0; i < buildings.length; i++) {
        var pt = buildings[i];
        var ps = this.buildings[pt.type].find(ps => ps.id == pt.id);
        if (ps) pt = Object.assign(ps, pt);
        else this.buildings[pt.type].push(pt);

        var type = this.buildingTypes[pt.type].icon;
        if (pt.cooldown) {
            type = "stop_cooldown";
        } else if (pt.visited) {
            type = "stop_visited";
        }

        var ally = pt.arena ? pt.arena.allianceType : null;
        if (ally !== null) {
            type += ally === 0 ? '_red' : '_blue';
        }

        if (!pt.marker) {
            var icon = L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [30, 30], iconAnchor: [15, 15] });
            pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerBuildings[pt.type]);
            if (pt.name) pt.marker.bindPopup(pt.name);
            else pt.marker.bindPopup(this.buildingTypes[pt.type].name+'<br />' + pt.id);
        } else {
            pt.marker.setIcon(L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [30, 30], iconAnchor: [15, 15] }));
        }
    }
}

Map.prototype.setRoute = function(route) {
    var points = Array.from(route, pt => L.latLng(pt.lat, pt.lng));
    if (this.route != null) {
        this.route.setLatLngs(points);
    } else {
        this.route = L.polyline(points, { dashArray: "5, 5", color: 'red', opacity: 0.4 }).addTo(this.layerPath);
    }
}

Map.prototype.displayCreatureList = function(all, sortBy, eggs) {
    console.log("Creature list");
    global.active = "creature";
    console.log(all);
    this.creatureList = all || this.creatureList;
    this.eggsCount = (eggs || this.eggsCount) || 0;
    if (!sortBy) {
        sortBy = localStorage.getItem("sortCreatureBy") || "cp";
    } else {
        localStorage.setItem("sortCreatureBy", sortBy);
    }

    if (sortBy === "name") {
        this.creatureList = this.creatureList.sort((p1, p2) => {
            if (p1[sortBy] != p2[sortBy]) {
                return p1[sortBy] - p2[sortBy];
            }
            var sort2 = p2["cp"] != p1["cp"] ? "cp" : "iv";
            return p2[sort2] - p1[sort2];
        });
    } else {
        this.creatureList = this.creatureList.sort((p1, p2) => {
            if (p1[sortBy] != p2[sortBy]) {
                return p2[sortBy] - p1[sortBy];
            } else if (p1["name"] != p2["name"]) {
                return p1["name"] - p2["name"];
            } else {
                var sort2 = (sortBy == "cp") ? "iv" : "cp";
                return p2[sort2] - p1[sort2];
            }
        });
    }

    var total = this.eggsCount + this.creatureList.length;
    $(".inventory .numberinfo").text(`${total}/${global.storage.creatures}`);
    var div = $(".inventory .data");
    div.html('');
    this.creatureList.forEach(function(elt) {
        var needed = Object.keys(elt.evolutions)[0];
        var canEvolve = needed && elt.improvable && elt.candies >= needed && !elt.isArenaDefender;
        var evolveStyle = canEvolve ? "" : "hide";
        var evolveClass = canEvolve ? "canEvolve" : "";
        var transferClass = elt.favorite ? "hide" : "";
        var candyStyle = elt.improvable && needed ? "" : "style='display:none'";
        var hp = Math.round(elt.hp * 100)/100;
        var creatureId = String(elt.name);
        creatureId = '0'.repeat(3 - creatureId.length) + creatureId;
        div.append(`
            <div class="pokemon ${elt.attackValue >= 5 && elt.staminaValue >= 5 ? 'perfect': ''}">
                <div class="transfer" data-id='${elt.id}'>
                    <a title='Transfer' href="#" class="transferAction ${transferClass}"><img src="./assets/img/recyclebin.png" /></a>
                    <a title='Evolve' href="#" class="evolveAction ${evolveStyle}"><img src="./assets/img/evolve.png" /></a>
                </div>
                <span class="imgspan ${evolveClass}">
                    <div class="stat atk">${elt.attackValue}</div>
                    <div class="stat stam">${elt.staminaValue}</div>
                    <div class="battle-type"><img src="./assets/img/${elt.isAttacker ? 'Sword' : 'Shild'}_color.png"/></div>
                    <img src="./assets/creatures/${creatureId}.png" />
                </span>
                <span class="name">${elt.display} lvl ${elt.level/2}</span>
                <span class="info">CP: <strong>${elt.cp}</strong> IV: <strong>${elt.iv}%</strong></span>
                <span class="info">HP: ${hp}</span>
                <span class="info">Candies: ${elt.candies}<span ${candyStyle}>/${needed}</span></span>
            </div>
        `);
    });
    $(".pokemonsort").show();
    $(".inventory").show().addClass("active");
}

Map.prototype.displayEggsList = function(eggs, max) {
    console.log("Eggs list");
    global.active = "eggs";
    $(".inventory .sort").hide();
    $(".inventory .numberinfo").text(eggs.length + '/' + max);
    var div = $(".inventory .data");
    div.html("");
    eggs.forEach(function(elt) {
        if (elt) {
            var img = elt.eggType;
            var info = ((elt.passedDistance/1000).toFixed(1) + ' / ' + (elt.totalDistance / 1000).toFixed(1)) + ' km';
            if(elt.isEggForRoost){
                info = (elt.passedDistance.toFixed(1) + ' / ' + elt.totalDistance.toFixed(1)) + ' h'
            }
            var imgsrc = `./assets/inventory/${img}.png`;
            if(elt.incubatorId !== null) {
                imgsrc = `./assets/img/cocoon.png`;
                if(elt.isEggForRoost) {
                    imgsrc = `./assets/img/mod_cocoon.png`;
                }
            }
            div.append(`
                <div class="egg">
                    <span class="imgspan"><img src="${imgsrc}" /></span>
                    <span>${info}</span>
                </div>
            `);
        }
    });
    $(".inventory").show().addClass("active");
};

Map.prototype.displayInventory = function(items) {
    console.log("Inventory list");
    global.active = "inventory";
    $(".inventory .sort").hide();
    var count = items.reduce((prev, cur) => prev + cur.count, 0);
    $(".inventory .numberinfo").text(`${count}/${global.storage.items}`);
    var div = $(".inventory .data");
    div.html(``);
    items.forEach(function(elt) {
        var dropStyle = elt.removable ? "" : "hide";
        div.append(`
            <div class="item">
                <div class="transfer" data-id='${elt.type}' data-count='${elt.count}'>
                    <a title='Drop' href="#" class="dropItemAction ${dropStyle}"><img src="./assets/img/recyclebin.png" /></a>
                </div>

                <span class="count">x${elt.count}</span>
                <span class="imgspan"><img src="./assets/inventory/${elt.type}.png" /></span>
                <span class="info">${elt.display}</span>
            </div>
        `);
    });
    $(".inventory").show().addClass("active");
};

Map.prototype.setDestination = function(latlng) {
    var popup = L.popup().setLatLng(latlng)
                 .setContent(`<div class='dest'>${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}</div><div class="center-align"><a class="destBtn waves-effect waves-light btn">Go?</a></div>`)
                 .openOn(this.map);

    $(".destBtn").click((function() {
        this.map.closePopup(popup);
        console.log(`Set destination: ${latlng.lat}, ${latlng.lng}`);
        if (this.destination) {
            this.layerPath.removeLayer(this.destination);
        }

        this.destination = L.marker(latlng, { zIndexOffset: 199, icon: new RedIcon() }).bindPopup(`${latlng.lat}, ${latlng.lng}`).addTo(this.layerPath);
        global.ws.emit("set_destination", latlng);
    }).bind(this));
}

Map.prototype.manualDestinationReached = function() {
    this.layerPath.removeLayer(this.destination);
    this.destination = null;
}

// Red icon

var RedIcon = L.Icon.Default.extend({
    options: {
        iconUrl: 'assets/img/marker-icon-red.png' 
    }
});

// Fix zindex for groups

L.MarkerCluster.prototype.true_initialize = L.MarkerCluster.prototype.initialize;
L.MarkerCluster.prototype.initialize = function (group, zoom, a, b) {
    this.true_initialize(group, zoom, a, b);
    this.setZIndexOffset(200);
}

// Add event for single click

L.Evented.addInitHook(function () {
    this._singleClickTimeout = null;
    this.on('click', this._scheduleSingleClick, this);
    this.on('dblclick dragstart zoomstart', this._clearSingleClickTimeout.bind(this), this);
});

L.Evented.include({
    _scheduleSingleClick: function(e) {
        this._clearSingleClickTimeout();
        this._singleClickTimeout = setTimeout(this._fireSingleClick.bind(this, e), 500)
    },

    _fireSingleClick: function(e){
        if (!e.originalEvent._stopped) {
            this.fire('singleclick', L.Util.extend(e, { type : 'singleclick' }));
        }
    },

    _clearSingleClickTimeout: function(){
        if (this._singleClickTimeout != null) {
            clearTimeout(this._singleClickTimeout);
            this._singleClickTimeout = null;
        }
    }
});
