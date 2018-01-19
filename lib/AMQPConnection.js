'use strict';

const EventEmitter = require('events').EventEmitter;
const Amqp         = require('amqplib');
const Joi          = require('joi');

const optionsSchema = Joi.object({
    connection    : {
        hostname  : Joi.string().hostname().default('localhost'),
        port      : Joi.number().integer().positive().max(65535).default(5672),
        vhost     : Joi.string().default('/'),
        username  : Joi.string().default('guest'),
        password  : Joi.string().default('guest'),
        heartbeat : Joi.number().integer().positive().default(30),
        locale    : Joi.string().default('en_US'),
        frameMax  : Joi.number().integer().positive().default(0)
    },
    maxRetry      : Joi.number().integer().positive().default(5),
    autoReconnect : Joi.boolean().default(true),
    maxDelay      : Joi.number().integer().positive().default(3600000),
    socketOptions : {
        timeout : Joi.number().integer().positive().default(3000)
    }
});

class AMQPConnection extends EventEmitter {

    constructor(options) {

        super();

        this.options = Joi.attempt(options, optionsSchema, 'Invalid AMQP connection options');

        this.connected = false;
        this.closed    = false;
    }

    async connect() {

        try {
            this.connection = await Amqp.connect(this.options.connection, this.options.socketOptions);
        }
        catch (error) {
            this.emit('log', { tags : ['error', 'AMQP', 'connection'], message : error.message });
        }

        this.connection.on('error', (error) => {

            if (error.message !== 'AMQPConnection closing') {
                this.emit('log', { tags : ['error', 'AMQP', 'connection'], message : error.message });
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

exports = AMQPConnection;
