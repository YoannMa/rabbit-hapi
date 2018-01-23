'use strict';

const Joi = require('joi');

const AMQPConnection = require('./AMQPConnection');

const internals = {
    schema : require('./schema')
};

exports.plugin = {
    pkg      : require('../package.json'),
    register : (server, options) => {

        internals.options = Joi.attempt(options, internals.schema.options, 'Invalid AMQP connection options');

        internals.amqpConnection = new AMQPConnection(internals.options);

        server.decorate('server', 'publish', internals.publish);
        server.decorate('server', 'subscribe', internals.subscribe);
        server.decorate('server', 'publishRPC', internals.publishRPC);
        server.decorate('server', 'subscribeRPC', internals.answerRPC);

        server.ext('onPreStop', async () => {

            await internals.amqpConnection.close();
        });
    }
};

internals.prepareMessage = (message) => {

    let newMessage = message;

    if (typeof message === 'string' || message instanceof String) {
        newMessage = { content : message.toString() };
    }

    newMessage         = Joi.attempt(newMessage, internals.schema.message);
    newMessage.content = new Buffer(newMessage.content);

    return newMessage;
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

    const exchange   = Joi.attempt(params.exchange, internals.schema.exchange, 'Error in the exchange configuration');
    const queue      = Joi.attempt(params.queue, internals.schema.queue, 'Error in the queue configuration');
    const routingKey = Joi.attempt(params.routingKey, Joi.string(), 'Error in the queue configuration');
    const message    = internals.prepareMessage(Joi.attempt(params.message, [Joi.string(), Joi.object()], 'Error in the message configuration'));

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
 * @param       {String[]}          [params.routingKeys]
 * @param       {Object}            [params.debug]
 */
internals.subscribe = async (params) => {

    const exchange    = Joi.attempt(params.exchange, internals.schema.exchange, 'Error in the exchange configuration');
    const queue       = Joi.attempt(params.queue, internals.schema.queue, 'Error in the queue configuration');
    const consumer    = Joi.attempt(params.consumer, internals.schema.consumer, 'Error in the consumer configuration');
    const routingKeys = Joi.attempt(params.routingKeys, Joi.array().items(Joi.string()).default(['']), 'Error in the routingKeys configuration');
    const debug       = Joi.attempt(params.debug, internals.schema.debug, 'Error in the debug configuration');

    const consumerFunction = async () => {

        const channel = await internals.amqpConnection.getChannel();

        if (exchange && exchange.name && exchange.name !== '') {
            await channel.assertExchange(exchange.name, exchange.type, exchange.options);
        }

        const destinationQueue = await channel.assertQueue(queue.name, queue.options);

        if (exchange && exchange.name && exchange.name !== '') {
            await Promise.all(routingKeys.map((rk) => channel.bindQueue(destinationQueue.queue, exchange.name, rk)));
        }

        channel.prefetch(consumer.options.prefetch);

        return channel.consume(destinationQueue.queue, async (message) => {

            try {
                message.content = message.content.toString();

                await consumer.receiveFunc(message);

                if (!consumer.options.noAck) {
                    channel.ack(message, consumer.options.allUpTo);
                }
            }
            catch (error) {
                if (!consumer.options.noAck) {
                    channel.nack(message, consumer.options.allUpTo, consumer.options.requeue);
                }

                if (debug && debug.enabled) {
                    if (!debug.queue.name || debug.queue.name === '') {
                        debug.queue.name = destinationQueue.queue.replace(/(\..[^.]*)$/, '.debug$1');
                    }

                    return internals.publish({ queue : debug.queue, message : JSON.stringify({ error, message }) });
                }
            }
        }, consumer.options);
    };

    internals.amqpConnection.on('reconnect', consumerFunction);

    await consumerFunction();
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
internals.publishRPC = async (params) => {
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
internals.answerRPC = async (params) => {
    // TODO
};


