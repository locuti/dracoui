(function() {
    var allPokemon = null;
    var allItems = null;

    var service = {};

    service.init = function(locale, callback) {
        // locale = locale || "en";
        // $.when(
        //     $.ajax({
        //         url: `assets/json/pokemon.${locale}.json`,
        //         success: (result) => { allPokemon = (typeof result == "string" ? JSON.parse(result) : result); }
        //     }),
        //     $.ajax({
        //         url: `assets/json/inventory.${locale}.json`,
        //         success: (result) => { allItems = (typeof result == "string" ? JSON.parse(result) : result); }
        //     })
        // ).then(callback);
        callback();
    }

    service.getPokemonName = function(id) {
        return id;
        // return allPokemon[id];
    }

    service.getItemName = function(id) {
        return id;
        // return allItems[id];
    }

    window.inventoryService = service;
}());