'use strict';

const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');
const Uuid = require('uuid');

const Lab = require('lab');

const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const expect           = Code.expect;

const Rabbit = require('..');

describe('connection()', () => {

    const provisionServer = async (options) => {

        const defaults = {};
        const server   = new Hapi.Server();
        await server.register({ plugin : Rabbit, options : Hoek.applyToDefaults(defaults, options || {}) });
        return server;
    };

    it('Bad credentials', async () => {

        const server = provisionServer({ connection : { username : 'notGuest', password : 'notGuestEither' }, maxDelay : 1, maxRetry : 1, socketOptions : { timeout : 1000 } });

        expect(server).to.throw();

        await server;
    });
});
