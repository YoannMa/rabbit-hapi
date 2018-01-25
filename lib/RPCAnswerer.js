'use strict';

const EventEmitter = require('events').EventEmitter;

const Publisher = require('./Publisher');
const Consumer  = require('./Consumer');

class RPCAnswerer {

    constructor(connection, options) {

        this.configurations = options;
        this.connection     = connection;
    }

    async consume() {
        this.consumer = new Consumer()
    }

    async respond(queue, correlationId, message) {

        const msg = Publisher.prepareMessage(message);

        msg.options.correlationId = correlationId;

        return new Publisher(await this.connection.getChannel(), { queue : { name : queue } }).publish(msg);
    }
}

module.exports = RPCAnswerer;
