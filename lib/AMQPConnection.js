'use strict';

const EventEmitter = require('events').EventEmitter;
const Amqp         = require('amqplib');

class AMQPConnection extends EventEmitter {

    constructor(options) {

        super();

        this.options = options;
        this.connected = false;
        this.closed    = false;
    }

    async connect() {

        try {
            this.connection = await Amqp.connect(this.options.connection, this.options.socketOptions);

            this.connection.on('error', (error) => {

                if (error.message !== 'AMQPConnection closing') {
                    this.emit('log', { tags : ['error', 'AMQP', 'connection'], message : error.message });
                    throw error;
                }
            });

            this.connection.on('close', () => {

                if (this.options.autoReconnect === true && this.closed === false) {
                    this.emit('log', { tags : ['info', 'AMQP', 'connection'], message : 'trying to reconnect' });
                    return this.reconnect();
                }
            });

            if (this.retry !== 0) {
                this.emit('reconnect');
            }

            this.retry     = 0;
            this.connected = true;
            this.emit('log', { tags : ['info', 'AMQP', 'connection'], message : 'connected' });

            return this.connection;
        }
        catch (error) {
            this.emit('log', { tags : ['error', 'AMQP', 'connection'], message : error.message });
            throw new Error(`Couldn't connect to Rabbit : ${error.message}`);
        }
    }

    async reconnect() {

        if (this.retry >= this.options.maxRetry && !this.options.autoReconnect) {
            const Error = new Error('[AMQP] cannot reconnect to AMQP server');

            Error.error = {
                code    : 504,
                devMsge : '[AMQP] cannot reconnect to AMQP server',
                usrMsge : '[AMQP] cannot reconnect to AMQP server'
            };
            throw Error;
        }

        this.connection = undefined;

        const range = Math.floor(this.retry / 5);
        this.retry++;

        await new Promise((resolve) => setTimeout(resolve, Math.min(range * (Math.pow(range, 1.5)) * 60000, this.options.maxDelay) || 1000));
        return this.connect();
    }

    async close() {

        this.connected = false;
        this.closed    = true;

        if (this.connection !== undefined) {
            return await this.connection.close();
        }
    }

    async getChannel() {

        if (!this.connected) {
            await this.connect();
        }

        try {
            const channel = await this.connection.createChannel();

            channel.on('error', (error) => {

                this.emit('log', { tags : ['error', 'AMQP', 'channel'], message : error.message });
            });

            return channel;
        }
        catch (error) {
            throw new Error(`Couldn't create a channel : ${error.message}`);
        }
    }
}

module.exports = AMQPConnection;
