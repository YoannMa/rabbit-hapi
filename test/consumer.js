'use strict';

const Code   = require('code');
const Uuidv4 = require('uuid/v4');

const Lab = require('lab');

const lab = exports.lab = Lab.script();
const { afterEach, beforeEach, describe, it } = lab;
const expect                                  = Code.expect;

const AMQPConnection = require('../lib/AMQPConnection');
const Publisher      = require('../lib/Publisher');
const Consumer       = require('../lib/Consumer');

describe('Consumer', () => {

    describe('subscribe()', () => {

        const autoDeleteOptions = { durable : false, autoDelete : true };

        let amqpConnection = undefined;

        beforeEach(() => {

            amqpConnection = new AMQPConnection({});
        });

        afterEach(async () => {

            await amqpConnection.close();
        });

        it('should send the error to the debug queue', async () => {

            const queue = { name : 'my_model.my_action', options : autoDeleteOptions };

            const message = Uuidv4();

            await new Promise(async (fulfil) => {

                await new Consumer(amqpConnection, {
                    queue    : { name : 'debug.my_model.my_action', options : autoDeleteOptions },
                    consumer : {
                        options     : { prefetch : 1 },
                        receiveFunc : (data) => {

                            const json = JSON.parse(data.content.toString());

                            expect(json.message.content).to.equal(message);
                            fulfil();
                        }
                    }
                }).subscribe();

                await new Consumer(amqpConnection, {
                    queue, consumer : {
                        options     : { requeue : false },
                        receiveFunc : () => {

                            throw new Error('An Error to try');
                        }
                    },
                    debug           : { enabled : true, queue : { options : autoDeleteOptions } }
                }).subscribe();

                await new Publisher(await amqpConnection.getChannel(), { queue }).publish(message);
            });
        });

        it('should send the error to a custom debug queue', async () => {

            const queue      = { name : 'my_model.my_action', options : autoDeleteOptions };
            const debugQueue = { name : Uuidv4(), options : autoDeleteOptions };

            const message = Uuidv4();

            await new Promise(async (fulfil) => {

                const consumer = new Consumer(amqpConnection, {
                    queue    : debugQueue,
                    consumer : {
                        options     : { prefetch : 1 },
                        receiveFunc : (data) => {

                            const json = JSON.parse(data.content.toString());

                            expect(json.message.content).to.equal(message);
                            fulfil();
                        }
                    }
                });

                await consumer.subscribe();

                await new Consumer(amqpConnection, {
                    queue, consumer : {
                        options     : { requeue : false },
                        receiveFunc : () => {

                            throw new Error('An Error to try');
                        }
                    },
                    debug           : { enabled : true, queue : debugQueue }
                }).subscribe();

                await new Publisher(await amqpConnection.getChannel(), { queue }).publish(message);
            });
        });
    });
});
