
var Map = function(parentDiv) {
    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

    var osmCycle = L.tileLayer('http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png');
    var osmCycleTransport = L.tileLayer('http://{s}.tile2.opencyclemap.org/transport/{z}/{x}/{y}.png');
    var toner = L.tileLayer('http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png');
    var watercolor = L.tileLayer('http://{s}.tile.stamen.com/watercolor/{z}/{x}/{y}.jpg');

    this.layerPillars = new L.LayerGroup();
    this.layerArenas = new L.LayerGroup();
    this.layerLibraries = new L.LayerGroup();
    this.layerObelisks = new L.LayerGroup();
    this.layerPortals = new L.LayerGroup();
    this.layerAltars = new L.LayerGroup();
    this.layerCatches = L.markerClusterGroup({ maxClusterRadius: 30 });
    this.layerPath = new L.LayerGroup();

    this.map = L.map(parentDiv, {
        layers: [osm, this.layerPillars, this.layerArenas, this.layerLibraries, this.layerObelisks, this.layerPortals, this.layerCatches, this.layerAltars, this.layerCatches, this.layerPath]
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
        "Pillars": this.layerPillars,
        "Arenas": this.layerArenas,
        "Libraries": this.layerLibraries,
        "Obelisks": this.layerObelisks,
        "Portals": this.layerPortals,
        "Altars": this.layerAltars,
        "Catches": this.layerCatches
    };

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
    this.pillars = [];
    this.arenas = [];
    this.libraries = [];
    this.obelisks = [];
    this.portals = [];
    this.altars = [];
    this.creatureList = [];
};

Map.prototype.saveContext = function() {
    var pillars = Array.from(this.pillars, p => {
        return {
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            visited: p.visited
        }
    });

    sessionStorage.setItem("available", true);
    sessionStorage.setItem("steps", JSON.stringify(this.steps));
    sessionStorage.setItem("catches", JSON.stringify(this.catches));
    sessionStorage.setItem("pillars", JSON.stringify(pillars));
}

Map.prototype.loadContext = function() {
    try {
        if (sessionStorage.getItem("available") == "true") {
            console.log("Load data from storage to restore session");

            this.steps = JSON.parse(sessionStorage.getItem("steps")) || [];
            this.catches = JSON.parse(sessionStorage.getItem("catches")) || [];
            this.pillars = JSON.parse(sessionStorage.getItem("pillars")) || [];

            if (this.steps.length > 0) this.initPath();

            this.initPillars();
            this.initArenas();
            this.initLibraries();
            this.initObelisks();
            this.initPortals();
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

Map.prototype.initPillars = function() {
    for (var i = 0; i < this.pillars.length; i++) {
        var pt = this.pillars[i];
        var iconurl = pt.visited ? `./assets/img/stop_visited.png` : `./assets/img/stop_available.png`;
        var icon = L.icon({ iconUrl: iconurl, iconSize: [30, 30], iconAnchor: [15, 15]});
        pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).bindPopup(pt.name).addTo(this.layerPillars);
    }
}

Map.prototype.initArenas = function() {
    for (var i = 0; i < this.arenas.length; i++) {
        var pt = this.arenas[i];
        var iconurl = `./assets/img/arena.png`;
        var icon = L.icon({ iconUrl: iconurl, iconSize: [40, 40], iconAnchor: [20, 20]});
        pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).bindPopup(pt.name).addTo(this.layerArenas);
    }
}

Map.prototype.initLibraries = function() {
    for (var i = 0; i < this.libraries.length; i++) {
        var pt = this.libraries[i];
        var iconurl = `./assets/img/library.png`;
        var icon = L.icon({ iconUrl: iconurl, iconSize: [40, 40], iconAnchor: [20, 20]});
        pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).bindPopup(pt.name).addTo(this.layerLibraries);
    }
}

Map.prototype.initObelisks = function() {
    for (var i = 0; i < this.obelisks.length; i++) {
        var pt = this.obelisks[i];
        var iconurl = `./assets/img/obelisk.png`;
        var icon = L.icon({ iconUrl: iconurl, iconSize: [40, 40], iconAnchor: [20, 20]});
        pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).bindPopup(pt.name).addTo(this.layerObelisks);
    }
}

Map.prototype.initPortals = function() {
    for (var i = 0; i < this.portals.length; i++) {
        var pt = this.portals[i];
        var iconurl = `./assets/img/portal.png`;
        var icon = L.icon({ iconUrl: iconurl, iconSize: [40, 40], iconAnchor: [20, 20]});
        pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).bindPopup(pt.name).addTo(this.layerPortals);
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
        info = `${pt.display} (lvl ${(pt.level/2).toFixed(1)}) <br /> CP:${pt.cp}`; // IV:${pt.iv}%`;
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

    var ps = this.pillars.find(ps => ps.id == pt.id);
    if (!ps) {
        this.pillars.push(pt);
        ps = pt;
        var icon = L.icon({ iconUrl: `./assets/img/stop_cooldown.png`, iconSize: [30, 30], iconAnchor: [15, 15] });
        pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerPillars);
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

Map.prototype.addBuildings = function(forts) {
    for(var i = 0; i < forts.length; i++) {
        var pt = forts[i];
        var ps = this.pillars.find(ps => ps.id == pt.id);
        if (ps) pt = Object.assign(ps, pt);
        else this.pillars.push(pt);

        var type = "stop_available";
        if (pt.cooldown) {
            type = "stop_cooldown";
        } else if (pt.visited) {
            type = "stop_visited";
        }

        if (!pt.marker) {
            var icon = L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [30, 30], iconAnchor: [15, 15] });
            pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerPillars);
            if (pt.name) pt.marker.bindPopup(pt.name);
            else pt.marker.bindPopup('Stop<br />' + pt.id);
        } else {
            pt.marker.setIcon(L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [30, 30], iconAnchor: [15, 15] }));
        }
    }
}

Map.prototype.addArena = function(arenas) {
    for(var i = 0; i < arenas.length; i++) {
        var pt = arenas[i];
        var ps = this.arenas.find(ps => ps.id == pt.id);
        if (ps) pt = Object.assign(ps, pt);
        else this.arenas.push(pt);

        var type = "arena";
        var ally = pt.arena.allianceType;
        if (ally !== null) {
            type += ally === 0 ? '_red' : '_blue';
        }

        if (!pt.marker) {
            var icon = L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] });
            pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerArenas);
            if (pt.name) pt.marker.bindPopup(pt.name);
            else pt.marker.bindPopup('Arena<br />' + pt.id);
        } else {
            pt.marker.setIcon(L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] }));
        }
    }
}

Map.prototype.addLibrary = function(libraries) {
    for(var i = 0; i < libraries.length; i++) {
        var pt = libraries[i];
        var ps = this.libraries.find(ps => ps.id == pt.id);
        if (ps) pt = Object.assign(ps, pt);
        else this.libraries.push(pt);

        var type = "library";
        var ally = pt.arena.allianceType;
        if (ally !== null) {
            type += ally === 0 ? '_red' : '_blue';
        }

        if (!pt.marker) {
            var icon = L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] });
            pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerLibraries);
            if (pt.name) pt.marker.bindPopup(pt.name);
            else pt.marker.bindPopup('Library<br />' + pt.id);
        } else {
            pt.marker.setIcon(L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] }));
        }
    }
}

Map.prototype.addObelisk = function(obelisks) {
    for(var i = 0; i < obelisks.length; i++) {
        var pt = obelisks[i];
        var ps = this.obelisks.find(ps => ps.id == pt.id);
        if (ps) pt = Object.assign(ps, pt);
        else this.obelisks.push(pt);

        var type = "obelisk";
        if (!pt.marker) {
            var icon = L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] });
            pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerObelisks);
            if (pt.name) pt.marker.bindPopup(pt.name);
            else pt.marker.bindPopup('Obelisk<br />' + pt.id);
        } else {
            pt.marker.setIcon(L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] }));
        }
    }
}

Map.prototype.addPortal = function(portals) {
    for(var i = 0; i < portals.length; i++) {
        var pt = portals[i];
        var ps = this.portals.find(ps => ps.id == pt.id);
        if (ps) pt = Object.assign(ps, pt);
        else this.portals.push(pt);

        var type = "portal";
        if (!pt.marker) {
            var icon = L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] });
            pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerPortals);
            if (pt.name) pt.marker.bindPopup(pt.name);
            else pt.marker.bindPopup('Portal<br />' + pt.id);
        } else {
            pt.marker.setIcon(L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] }));
        }
    }
}

Map.prototype.addAltar = function(altars) {
    for(var i = 0; i < altars.length; i++) {
        var pt = altars[i];
        var ps = this.altars.find(ps => ps.id == pt.id);
        if (ps) pt = Object.assign(ps, pt);
        else this.altars.push(pt);

        var type = "altar";
        if (!pt.marker) {
            var icon = L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] });
            pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerAltars);
            if (pt.name) pt.marker.bindPopup(pt.name);
            else pt.marker.bindPopup('Altar<br />' + pt.id);
        } else {
            pt.marker.setIcon(L.icon({ iconUrl: `./assets/img/${type}.png`, iconSize: [40, 40], iconAnchor: [20, 20] }));
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
                <span class="name">${elt.display} lvl ${(elt.level/2).toFixed(1)}</span>
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
            if (elt.incubatorId !== null) img = 18;
            div.append(`
                <div class="egg">
                    <span class="imgspan"><img src="./assets/inventory/${img}.png" /></span>
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
