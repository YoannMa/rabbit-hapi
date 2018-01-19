'use strict';

const Hoek    = require('hoek');
const Uuid    = require('uuid');
const IsEmpty = require('lodash.isempty');
const Joi     = require('joi');

const AMQPConnection = require('./AMQPConnection');

const internals = {};

internals.defaultCallOptions = {
    exchange    : '',
    queue       : '',
    type        : 'direct',
    options     : {
        durable : true,
        noAck   : false,
        allUpTo : false,
        requeue : true,
        debug   : {
            isActivated : false,
            expires     : 86400000,     // 24 hours
            durable     : true,
            persistent  : true
        }
    },
    RPCTimeout  : 30000,        // 30 sec
    receiveFunc : () => {},
    waitingFunc : () => {}
};

internals.defaultMessage = {
    content : '',
    options : {
        contentType : 'application/json',
        persistent  : true
    }
};

internals.schema.exchangeOptions = Joi.object({
    durable           : Joi.string(),
    internal          : Joi.string(),
    autoDelete        : Joi.string(),
    alternateExchange : Joi.string(),
    arguments         : Joi.string()
});

internals.schema.consumerOptions = Joi.object({
    consumerTag : Joi.string(),
    noLocal     : Joi.string(),
    noAck       : Joi.string(),
    exclusive   : Joi.string(),
    priority    : Joi.string(),
    arguments   : Joi.string()
});

internals.schema.queueOptions = Joi.object({
    exclusive            : Joi.boolean().default(true),
    durable              : Joi.boolean().default(true),
    autoDelete           : Joi.boolean().default(true),
    arguments            : Joi.string(),
    messageTtl           : Joi.string(),
    expires              : Joi.string(),
    deadLetterExchange   : Joi.string(),
    deadLetterRoutingKey : Joi.string(),
    maxLength            : Joi.string(),
    maxPriority          : Joi.string()
});

internals.schema.message = Joi.object({
    content : Joi.string().required(),
    options : {
        contentType     : Joi.string().default('application/json'),
        persistent      : Joi.boolean().default(true),
        expiration      : Joi.string(),
        userId          : Joi.string(),
        CC              : Joi.string(),
        priority        : Joi.string(),
        deliveryMode    : Joi.string(),
        mandatory       : Joi.string(),
        BCC             : Joi.string(),
        immediate       : Joi.string(),
        contentEncoding : Joi.string(),
        headers         : Joi.string(),
        correlationId   : Joi.string(),
        replyTo         : Joi.string(),
        messageId       : Joi.string(),
        timestamp       : Joi.string(),
        type            : Joi.string(),
        appId           : Joi.string()
    }
});

exports.plugin = {
    pkg      : require('../package.json'),
    register : (server, options) => {

        internals.amqpConnection = new AMQPConnection(options);

        server.decorate('server', 'rabbit.publish', internals.publish);
        server.decorate('server', 'rabbit.subscribe', internals.subscribe);
        server.decorate('server', 'rabbit.publishRPC', internals.subscribe);
        server.decorate('server', 'rabbit.subscribeRPC', internals.subscribe);
    }
};

internals.prepareMessage = (message) => {

    if (typeof message === 'string' || message instanceof String) {
        return Joi.attempt({ content : message.toString() }, internals.schema.message);
    }

    return Joi.attempt(message, internals.schema.message);
};

/**
 * Publish a message to an exchange or a queue.
 *
 */
internals.publish = async ({ exchange, queue, routingKey, message, options }) => {

};

/**
 * Subscribe messages on an exchange or a queue. Automatic reconnection to a new channel on connection error/lost.
 *
 * @param       {object}        params                  Function params
 * @param       {string}        params.exchange         Exchange name
 * @param       {object}        [params.options]        Exchange/queue settings (same as Amqp)
 * @param       {string}        [params.queue]          Queue to send in if no routing key is specified (default to queue '')
 * @param       {function}      [params.waitingFunc]    Function to call on connection to the channel
 * @param       {function}      params.receiveFunc      Function to call on message consumption (take message object in parameter)
 * @returns {*}
 */
internals.subscribe = async (params) => {

    const settings = Hoek.applyToDefaults(internals.defaultCallOptions, params);

    const consumerFunction = async () => {

        const channel = await internals.amqpConnection.getChannel();

        if (!IsEmpty(settings.exchange)) {
            await channel.assertExchange(settings.exchange, settings.type, settings.options.map((c) => c.exchangeOpt)); // TODO
        }

        const assert = await channel.assertQueue(settings.queue, settings.options.map((c) => c.queueOpt)); // TODO

        if (!IsEmpty(settings.exchange)) {
            await channel.bindQueue(assert.queue, settings.exchange, settings.routingKey);
        }

        if (!Number.isNaN(settings.prefetch)) {
            channel.prefetch(settings.prefetch);
        }

        return channel.consume(assert.queue, async (message) => {

            try {
                await settings.receiveFunc(message);

                if (!settings.options.noAck) {
                    channel.ack(message, settings.options.allUpTo);
                }
            }
            catch (error) {
                if (!settings.options.noAck) {
                    channel.nack(message, settings.options.allUpTo, settings.options.requeue);
                }

                // TODO ADD DEBUG
            }
        }, settings.options); // TODO
    };

    internals.amqpConnection.on('reconnect', consumerFunction);

    return await consumerFunction();
};

/**
 * Consume messages on an exchange or a queue. Automatic reconnection to a new channel on connection error/lost.
 *
 * @param       {object}        params                  Function params
 * @param       {string}        [params.exchange]       Exchange name
 * @param       {string}        [params.type]           Exchange type (fanout, direct, topic)
 * @param       {object}        [params.options]        Exchange/queue settings (same as Amqp)
 * @param       {number}        [params.prefetch]       Specify prefetch on the channel
 * @param       {string}        [params.queue]          Queue to send in if no routing key is specified (default to queue '')
 * @param       {function}      [params.waitingFunc]    Function to call on connection to the channel
 * @param       {function}      params.receiveFunc      Function to call on message consumption (take message object in parameter)
 * @returns     {*}
 */
internals.consume = async (params) => {

};

/**
 * Create exchange and queue if it do not exist and bind to specified routing keys.
 *
 * @param       {object}            params                  Function params
 * @param       {string}            params.exchange         Exchange name
 * @param       {string}            params.type             Exchange type (fanout, direct, topic)
 * @param       {object}            [params.options]        Exchange/queue settings (same as amqp)
 * @param       {string}            params.queue            Queue to bind
 * param        {string|string[]}   params.routingKeys      Routing keys to bind to. Use an array to specified multiple keys.
 * @returns     {*}
 */
internals.bindExchange = async (params) => {

    const settings = Hoek.applyToDefaults(internals.defaultCallOptions, params);

    const channel = await internals.amqpConnection.getChannel();

    await channel.assertExchange(settings.exchange, settings.type, settings.options.map((c) => c.exchangeOpt)); // TODO

    if (!settings.routingKey || settings.routingKey.length <= 0) {
        return channel.bindQueue(settings.queue, settings.exchange);
    }

    if (typeof settings.routingKeys === 'string') {
        settings.routingKeys = [settings.routingKeys];
    }

    await Promise.map(settings.routingKeys, (routingKey) => channel.bindQueue(settings.queue, settings.exchange, routingKey));

    return channel.close();
};

/**
 * Send a RPC request : send a message on a queue and wait for a response from consumer
 *
 * @param       {object}            params                      Function params
 * @param       {string|object}     params.message              Message to send
 * @param       {*}                 [params.message.content]    Message content
 * @param       {object}            [params.message.options]    Message options (same as amqp)
 * @param       {string}            params.queue                Queue to send
 * @param       {object}            [params.options]            Queue settings (same as amqp)
 * @param       {function}          params.receiveFunc          Function to call server answer
 * @returns     {*}
 */
internals.sendRPC = async (params) => {
    // TODO
};

/**
 * Answer to a RPC request
 *
 * @param       {object}            params                  Function params
 * @param       {number}            [params.prefetch]       Specify prefetch on the channel
 * @param       {string}            params.queue            Queue to send
 * @param       {object}            [params.options]        Queue settings (same as amqp)
 * @param       {function}          [params.waitingFunc]    Function to call on connection to the channel
 * @param       {function}          params.receiveFunc      Function to call when receiving a message
 * @return      {*}
 */
internals.answerToRPC = async (params) => {
    // TODO
};




