require('dotenv').config({silent: true});

const path = require('path');
const fastify = require('fastify')();

fastify.register(require('fastify-static'), {
    root: path.join(__dirname, 'src'),
});

fastify.listen(8000, "0.0.0.0", function() {
    let addr = fastify.server.address();
    console.log("Server listening at ", addr.address + ":" + addr.port);
});
