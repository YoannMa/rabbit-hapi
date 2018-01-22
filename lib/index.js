'use strict';

const Joi     = require('joi');

const AMQPConnection = require('./AMQPConnection');

const internals = {
    schema : require('./schema')
};

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
 * @param       {Object}            params
 * @param       {Object}            [params.exchange]
 * @param       {Object}            [params.queue]
 * @param       {Object||String}    params.message
 * @param       {String}            [params.routingKey]
 *
 * @return      {Promise<void>}
 */
internals.publish = async (params) => {

    const { exchange, queue, routingKey } = Joi.attempt(params, Joi.object({
        exchange   : internals.schema.exchange,
        queue      : internals.schema.queue,
        routingKey : Joi.string()
    }).or('exchange', 'queue'));

    const message = internals.prepareMessage(message);

    const channel = await internals.amqpConnection.getChannel();

    if (exchange && exchange.name && exchange.name !== '') {
        await channel.assertExchange(exchange.name, exchange.type, exchange.options);
    }

    if (queue) {
        const destinationQueue = await channel.assertQueue(queue.name, queue.options);

        if (exchange && exchange.name && exchange.name !== '') {
            await channel.bindQueue(destinationQueue.queue, exchange.name, routingKey);

            await channel.publish(exchange.name, routingKey || destinationQueue.queue, message.content, message.options);
        }
        else {
            await channel.publish('', destinationQueue.queue, message.content, message.options);
        }
    }

    return channel.close();
};

/**
 * Subscribe messages on an exchange or a queue. Automatic reconnection to a new channel on connection error/lost.
 *
 * @param       {object}            params
 * @param       {object}            [params.exchange]
 * @param       {object}            [params.queue]
 * @param       {object}            params.consumer
 * @param       {String[]|String}   [params.routingKeys]
 * @param       {Object}            [params.debug]
 *
 * @returns {*}
 */
internals.subscribe = async (params) => {

    let { exchange, queue, consumer, routingKeys, debug } = Joi.attempt(params, Joi.object({
        exchange    : internals.schema.exchange,
        queue       : internals.schema.queue,
        consumer    : internals.schema.consumer.required(),
        routingKeys : Joi.array().items(Joi.string()),
        debug       : internals.schema.debug
    }).or('exchange', 'queue'));

    const consumerFunction = async () => {

        const channel = await internals.amqpConnection.getChannel();

        if (exchange && exchange.name && exchange.name !== '') {
            await channel.assertExchange(exchange.name, exchange.type, exchange.options);
        }

        const destinationQueue = await channel.assertQueue(queue.name, queue.options);

        if (exchange && exchange.name && exchange.name !== '') {
            if (typeof routingKeys === 'string' || routingKeys instanceof String) {
                routingKeys = [routingKeys];
            }

            await Promise.map(routingKeys, (rk) => channel.bindQueue(destinationQueue.queue, exchange.name, rk));
        }

        channel.prefetch(consumer.prefetch);

        return channel.consume(destinationQueue.queue, async (message) => {

            try {
                await consumer.receiveFunc(message);

                if (!consumer.options.noAck) {
                    channel.ack(message, consumer.options.allUpTo);
                }
            }
            catch (error) {
                if (!consumer.noAck) {
                    channel.nack(message, consumer.options.allUpTo, consumer.options.requeue);
                }

                if (debug.enable) {
                    const errorMessage = internals.prepareMessage(JSON.stringify({ error, message }));

                    if (debug.queue === '') {
                        debug.queue = destinationQueue.queue.replace(/(:.[^:]*)$/, ':debug$1');

                        const destinationDebugQueue = await channel.assertQueue(debug.queue, debug.options);

                        return channel.publish(destinationDebugQueue.queue, '', errorMessage.content, errorMessage.options);
                    }
                }
            }
        }, consumer.options);
    };

    internals.amqpConnection.on('reconnect', consumerFunction);

    return await consumerFunction();
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


