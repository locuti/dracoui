(function() {
    var global = { 
        storage: {
            items: 350,
            creatures: 250
        },
        snipping: false
    };
    window.global = global;
 
    global.config = window.configService.load();
    global.version = global.config.version;

    document.title += " - " + global.version;

    function confirmAndSendToServer(msg, callback) {
        if (global.config.noConfirm) {
            callback();
        } else {
            vex.dialog.confirm({
                unsafeMessage: msg,
                callback: value => { if(value) callback(); }
            });
        }
    }

    $(function() {
        launchApp();
    });

    function launchApp() {
        window.gtag = window.gtag || function() {};

        var sortBy = localStorage.getItem("sortCreatureBy") || "cp";
        $("#sortBy" + sortBy).addClass("active").siblings().removeClass("active");

        $("#pokemonLink").click( function() {
            if ($(".inventory").css("opacity") == "1" && $(".inventory .data .pokemon").length) {
                $(".inventory").removeClass("active");
            } else {
                global.ws.emit("creature_list");
            }
        });
        $("#eggsLink").click( function() {
            if ($(".inventory").css("opacity") == "1" && $(".inventory .data .egg").length) {
                $(".inventory").removeClass("active");
            } else { 
                global.ws.emit("eggs_list");
            }
        });
        $("#inventoryLink").click( function() {
            if ($(".inventory").css("opacity") == "1" && $(".inventory .data .item").length) {
                $(".inventory").removeClass("active");
            } else {
                global.ws.emit("inventory_list");
            }
        });

        $("#sortBypokemonId").click(() => global.map.displayCreatureList(null, "name"));
        $("#sortBycp").click(() => global.map.displayCreatureList(null, "cp"));
        $("#sortByiv").click(() => global.map.displayCreatureList(null, "iv"));

        $("#sortBypokemonId, #sortBycp, #sortByiv").click( function() {
            if(!$(this).hasClass("active")) {
                $(this).toggleClass("active").siblings().removeClass("active");
            }
        });

        $(".inventory .refresh").click(function() {
            console.log("Refresh");
            global.ws.emit(global.active + "_list");
        });

        $(".inventory .close").click(function() {
            $(this).parent().removeClass("active");
            $(".inventory .sort").hide();
        });

        $(".message .close").click(function() {
            $(this).parent().hide();
        });

        $(".close").click(() => { global.active = null });

        $("#recycleLink").click(() => {
            sessionStorage.setItem("available", false);
            window.location.reload();
        });

        $("#settingsLink").click(() => {
            global.map.saveContext();
            window.location = "config.html";
        });

        $(".inventory .data").on("click", "a.transferAction", function(event) {
            event.preventDefault()
            var parent = $(this).parent();
            var id = parent.data().id;
            var idx = global.map.creatureList.findIndex(p => p.id == id);
            var selected = global.map.creatureList[idx];
            var left = global.map.creatureList.filter(p => p.name == selected.name).length - 1;
            var msg = `Are you sure you want to transfer this ${selected.display}? <br /> You will have <b>${left}</b> left.`;
            confirmAndSendToServer(msg, () => {
                gtag("event", "transfer", selected.display);
                global.ws.emit("transfer_creature", { id: id });
                global.map.creatureList.splice(idx, 1);
                parent.parent().fadeOut();
            });
        });

        $(".inventory .data").on("click", "a.evolveAction", function(event) {
            event.preventDefault()
            var parent = $(this).parent();
            var id = parent.data().id;
            var idx = global.map.creatureList.findIndex(p => p.id == id);
            var selected = global.map.creatureList[idx];
            var left = global.map.creatureList.filter(p => p.name == selected.name).length - 1;
            var msg = `Are you sure you want to evolve this ${selected.display}? <br /> You will have <b>${left}</b> left.`;
            confirmAndSendToServer(msg, () => {
                gtag('event', 'evolve', name);
                console.log('Evolve ' + id);
                global.ws.emit('evolve_creature', { id: id, to: Object.values(selected.evolutions)[0] });
                global.map.creatureList.splice(idx, 1);
                parent.parent().fadeOut();
            });
        });
        
        $(".inventory .data").on("click", "a.favoriteAction", function(event) {
            event.preventDefault()
            var parent = $(this).parent();
            var id = parent.data().id;
            var idx = global.map.creatureList.findIndex(p => p.id == id);
            var selected = global.map.creatureList[idx];
            selected.favorite = !selected.favorite;
            var name = selected.display;
            gtag('event', 'favorite', name);
            $(this).find("img").attr('src', `./assets/img/favorite_${selected.favorite ? 'set' : 'unset'}.png`);
            parent.find(".transferAction").toggleClass("hide");
            global.ws.emit("favorite_creature", { id: id, favorite: selected.favorite });
        });

        $(".inventory .data").on("click", "a.dropItemAction", function(event) {
            event.preventDefault();
            var parent = $(this).parent();
            var itemId = parent.data().id;
            var name = parent.parent().find('.info').text();
            var count = parent.data().count;
            vex.dialog.confirm({
                unsafeMessage: `How many <b>${name}</b> would you like to drop?`,
                input: `
                    <p class="range-field">
                        <input type="range" name="count" value="1" min="1" max="${count}" onchange="$('#display-range').text(this.value)" />
                    </p>
                    Drop: <span id='display-range'>1</span>
                `,
                callback: value => {
                    if(value) {
                        var drop = parseInt(value.count);
                        gtag('event', 'drop_items', name);
                        global.ws.emit('drop_items', { id: itemId, count: drop });
                        if (count == drop) {
                            parent.parent().fadeOut();
                        } else {
                            parent.data("count", count - drop);
                            parent.parent().find(".count").text("x" + (count - drop));
                        }
                    }
                }
            });
        });

        $(".player").on("pogo:player_update", () => {
            if (global.player) {
                // console.log(global.player);
                var player = $(".player");
                player.find(".playername .value").text(global.user);
                player.find(".level .value").text(global.player.level);
                var percent = 100 * global.player.currentExperience / global.player.nextLevelExperience;
                player.find(".myprogress .value").css("width", `${percent.toFixed(0)}%`);
                player.show();
            }
        });

        if (global.config.websocket) {
            // settings ok, let's go
            global.map = new Map("map");
            global.map.loadContext();
            startListenToSocket();
        } else {
            // no settings, first time run?
            window.location = "config.html";
        }
    }

}());