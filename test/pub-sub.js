'use strict';

const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');

const Lab = require('lab');


const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const expect = Code.expect;

const Rabbit = require('..');

describe('pub-sub', () => {

    describe('publish()', () => {

        const provisionServer = async (options) => {

            const defaults = { plugins: { 'rabbit-hapi': {} } };
            const server = new Hapi.Server(Hoek.applyToDefaults(defaults, options || {}));
            await server.register(Rabbit);
            return server;
        };

        it('Publish a JSON message', async () => {

            const server = await provisionServer();
            const exchange = { name: 'test1' };
            const queue = { name: 'test1' };

            const message = JSON.stringify({
                uuid: 'test'
            });

            await server.publish({ exchange, queue, message });

            await new Promise(async (fulfil, reject) => {

                await server.subscribe({
                    exchange, queue, consumer: {
                        receiveFunc(data) {

                            expect(JSON.parse(data.content), message);
                            fulfil();
                        }
                    }
                });
            });
        });
    });
});
