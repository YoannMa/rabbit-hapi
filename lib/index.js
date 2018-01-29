'use strict';

const Joi = require('joi');

const AMQPConnection = require('./AMQPConnection');
const Publisher      = require('./Publisher');
const RPCPublisher   = require('./RPCPublisher');
const Consumer       = require('./Consumer');

const internals = {
    schema : require('./schema')
};

exports.plugin = {
    pkg      : require('../package.json'),
    register : async (server, options) => {

        internals.options = Joi.attempt(options, internals.schema.options, 'Invalid AMQP connection options');

        internals.amqpConnection = new AMQPConnection(internals.options);

        await internals.amqpConnection.connect();

        server.decorate('server', 'publish', internals.publish);
        server.decorate('server', 'subscribe', internals.subscribe);
        server.decorate('server', 'publishRPC', internals.publishRPC);
        server.decorate('server', 'subscribeRPC', internals.answerRPC);

        server.ext('onPreStop', async () => {

            await internals.amqpConnection.close();
        });

        internals.amqpConnection.on('log', console.log);
    }
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
    const message    = Joi.attempt(params.message, [Joi.string(), Joi.object()], 'Error in the message configuration');

    const channel = await internals.amqpConnection.getChannel();

    await new Publisher(channel, { exchange, queue, routingKey }).publish(message);

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
internals.subscribe = (params) => {

    const exchange    = Joi.attempt(params.exchange, internals.schema.exchange, 'Error in the exchange configuration');
    const queue       = Joi.attempt(params.queue, internals.schema.queue, 'Error in the queue configuration');
    const consumer    = Joi.attempt(params.consumer, internals.schema.consumer, 'Error in the consumer configuration');
    const routingKeys = Joi.attempt(params.routingKeys, Joi.array().items(Joi.string()).default(['']), 'Error in the routingKeys configuration');
    const debug       = Joi.attempt(params.debug, internals.schema.debug, 'Error in the debug configuration');

    return new Consumer(internals.amqpConnection, { exchange, queue, consumer, routingKeys, debug }).subscribe();
};

/**
 * Send a RPC request : send a message on a queue and wait for a response from consumer
 *
 * @param       {Object}            params
 * @param       {Object}            [params.exchange]
 * @param       {Object}            [params.queue]
 * @param       {Object||String}    params.message
 * @param       {String}            [params.routingKey]
 *
 * @returns     {Promise}
 */
internals.publishRPC = (params) => {

    const exchange   = Joi.attempt(params.exchange, internals.schema.exchange, 'Error in the exchange configuration');
    const queue      = Joi.attempt(params.queue, internals.schema.queue, 'Error in the queue configuration');
    const routingKey = Joi.attempt(params.routingKey, Joi.string(), 'Error in the queue configuration');
    const message    = Joi.attempt(params.message, [Joi.string(), Joi.object()], 'Error in the message configuration');

    return new RPCPublisher(internals.amqpConnection, { exchange, queue, routingKey }).publish(message);
};

/**
 * Answer to a RPC request
 *
 * @param       {object}            params
 * @param       {object}            [params.exchange]
 * @param       {object}            [params.queue]
 * @param       {object}            params.consumer
 * @param       {String[]}          [params.routingKeys]
 * @param       {Object}            [params.debug]
 */
internals.answerRPC = (params) => {

    const exchange    = Joi.attempt(params.exchange, internals.schema.exchange, 'Error in the exchange configuration');
    const queue       = Joi.attempt(params.queue, internals.schema.queue, 'Error in the queue configuration');
    const consumer    = Joi.attempt(params.consumer, internals.schema.consumer, 'Error in the consumer configuration');
    const routingKeys = Joi.attempt(params.routingKeys, Joi.array().items(Joi.string()).default(['']), 'Error in the routingKeys configuration');
    const debug       = Joi.attempt(params.debug, internals.schema.debug, 'Error in the debug configuration');

    return new Consumer(internals.amqpConnection, { exchange, queue, consumer, routingKeys, debug }).subscribe();
};


