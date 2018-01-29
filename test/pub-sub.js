'use strict';

const Code   = require('code');
const Hapi   = require('hapi');
const Hoek   = require('hoek');
const Uuidv4 = require('uuid/v4');

const Lab = require('lab');

const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const expect           = Code.expect;

const Rabbit = require('..');

describe('pub-sub', () => {

    const autoDeleteOptions = { durable : false, autoDelete : true };

    const provisionServer = async (options) => {

        const defaults = { plugins : { 'rabbit-hapi' : {} } };
        const server   = new Hapi.Server(Hoek.applyToDefaults(defaults, options || {}));
        await server.register(Rabbit);
        return server;
    };

    describe('publish()', () => {

        it('Publish a string message', async (flags) => {

            const server   = await provisionServer();
            const exchange = { name : Uuidv4(), options : autoDeleteOptions };
            const queue    = { name : Uuidv4(), options : autoDeleteOptions };

            const message = {
                uuid : Uuidv4()
            };

            const waitingFunc = flags.mustCall(() => {}, 1);

            const resultPromise = new Promise(async (fulfil) => {

                await server.subscribe({
                    exchange, queue, consumer : {
                        waitingFunc,
                        receiveFunc : (data) => {

                            expect(JSON.parse(data.content)).to.equal(message);
                            fulfil();
                        }
                    }
                });
            });

            await server.publish({ exchange, queue, message : JSON.stringify(message) });

            await resultPromise;
        });

        it('Publish a String object message', async () => {

            const server   = await provisionServer();
            const exchange = { name : Uuidv4(), options : autoDeleteOptions };
            const queue    = { name : Uuidv4(), options : autoDeleteOptions };

            const message = String(Uuidv4());

            const resultPromise = new Promise(async (fulfil) => {

                await server.subscribe({
                    exchange, queue, consumer : {
                        receiveFunc : (data) => {

                            expect(data.content.toString()).to.equal(message);
                            fulfil();
                        }
                    }
                });
            });

            await server.publish({ exchange, queue, message });

            await resultPromise;
        });

        it('Publish without exchange', async () => {

            const server = await provisionServer();
            const queue  = { name : Uuidv4(), options : autoDeleteOptions };

            const message = String(Uuidv4());

            const resultPromise = new Promise(async (fulfil) => {

                await server.subscribe({
                    queue, consumer : {
                        receiveFunc : (data) => {

                            expect(data.content.toString()).to.equal(message);
                            fulfil();
                        }
                    }
                });
            });

            await server.publish({ queue, message });

            await resultPromise;
        });
    });

    describe('subscribe()', () => {

        it('Test debug feature', async () => {

            const server = await provisionServer();
            const queue  = { name : 'my_model.my_action', options : autoDeleteOptions };

            const message = Uuidv4();

            const resultPromise = new Promise(async (fulfil) => {

                await server.subscribe({
                    queue    : { name : 'my_model.debug.my_action', options : autoDeleteOptions },
                    consumer : {
                        options     : { prefetch : 1 },
                        receiveFunc : (data) => {

                            const json = JSON.parse(data.content.toString());

                            expect(json.message.content).to.equal(message);
                            fulfil();
                        }
                    }
                });
            });

            await server.subscribe({
                queue, consumer : {
                    options     : { requeue : false },
                    receiveFunc : () => {

                        throw new Error('An Error to try');
                    }
                },
                debug           : { enabled : true, queue : { options : autoDeleteOptions } }
            });

            await server.publish({ queue, message });

            await resultPromise;
        });
    });
});
