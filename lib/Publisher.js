'use strict';

const EventEmitter = require('events').EventEmitter;
const Joi          = require('joi');

const messageSchema = require('./schema').message;

class Publisher extends EventEmitter {

    constructor(channel, options) {

        super();

        this.configurations = options;
        this.channel        = channel;
    }

    /**
     * Send the message on the queue/exchange using the configuration given to the Publisher at his creation.
     * @param message
     * @return {Promise<void>}
     */
    async publish(message) {

        const msg = Publisher.prepareMessage(message);

        if (this.configurations.exchange && this.configurations.exchange.name && this.configurations.exchange.name !== '') {
            await this.channel.assertExchange(this.configurations.exchange.name, this.configurations.exchange.type, this.configurations.exchange.options);
        }

        if (this.configurations.queue) {
            const destinationQueue = await this.channel.assertQueue(this.configurations.queue.name, this.configurations.queue.options);

            if (this.configurations.exchange && this.configurations.exchange.name && this.configurations.exchange.name !== '') {
                await this.channel.bindQueue(destinationQueue.queue, this.configurations.exchange.name, this.configurations.routingKey);

                await this.channel.publish(this.configurations.exchange.name, this.configurations.routingKey || destinationQueue.queue, msg.content, msg.options);
            }
            else {
                await this.channel.publish('', destinationQueue.queue, msg.content, msg.options);
            }
        }
    }

    /**
     * Convert a String message to an object message if needed
     * @param {Object|String|string} message
     * @return {*}
     */
    static prepareMessage(message) {

        let newMessage = message;

        if (typeof message === 'string' || message instanceof String) {
            newMessage = { content : message.toString() };
        }

        newMessage         = Joi.attempt(newMessage, messageSchema);
        newMessage.content = new Buffer(newMessage.content);

        return newMessage;
    }
}

module.exports = Publisher;
