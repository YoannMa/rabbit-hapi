'use strict';

const Code   = require('code');
const Uuidv4 = require('uuid/v4');

const Lab = require('lab');

const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const expect           = Code.expect;

const AMQPConnection = require('../lib/AMQPConnection');

describe('AMQPConnection', () => {

    it('should be able to connect', async () => {

        const amqpConnection = new AMQPConnection({});

        await amqpConnection.connect();

        await amqpConnection.close();
    });

    it('should be able to close and reconnect after', async (flags) => {

        const amqpConnection = new AMQPConnection({});

        amqpConnection.on('connected', flags.mustCall(() => {}, 2));

        await amqpConnection.connect();

        await amqpConnection.close();

        await amqpConnection.reconnect();

        await amqpConnection.close();
    });

    it('should be able auto connect when a channel is requested', async (flags) => {

        const amqpConnection = new AMQPConnection({});

        amqpConnection.on('connected', flags.mustCall(() => {}, 1));

        await amqpConnection.getChannel();

        await amqpConnection.close();
    });

    it('shouldn\'t connect when it\'s already trying to connect', async (flags) => {

        const amqpConnection = new AMQPConnection({});

        amqpConnection.on('connected', flags.mustCall(() => {}, 1));

        amqpConnection.connect();

        await amqpConnection.getChannel();

        await amqpConnection.close();
    });

    it('shouldn\'t connect when it\'s already connected', async (flags) => {

        const amqpConnection = new AMQPConnection({});

        amqpConnection.on('connected', flags.mustCall(() => {}, 1));

        await amqpConnection.connect();

        await amqpConnection.connect();

        await amqpConnection.close();
    });

    it('it should try to reconnect if the connection is close by rabbitMQ', async (flags) => {

        const amqpConnection = new AMQPConnection({ autoReconnect : true });

        amqpConnection.on('connected', flags.mustCall(() => {}, 2));
        amqpConnection.on('reconnected', flags.mustCall(() => {}, 1));

        await amqpConnection.connect();

        amqpConnection.connection.emit('close', new Error('test error'));

        await amqpConnection.once('connected');

        await amqpConnection.close();
    });

});
