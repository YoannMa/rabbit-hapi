'use strict';

const EventEmitter = require('events').EventEmitter;

class Consumer extends EventEmitter {

    constructor(connection, options) {

        super();

        this.configurations = options;
        this.connection     = connection;

        this.connection.on('reconnect', this.subscribe);
    }

    async subscribe() {

        await this.assertRabbitInfra();

        await this.consume();
    }

    async assertRabbitInfra() {

        this.channel = await this.connection.getChannel();

        if (this.configurations.exchange && this.configurations.exchange.name && this.configurations.exchange.name !== '') {
            await this.channel.assertExchange(this.configurations.exchange.name, this.configurations.exchange.type, this.configurations.exchange.options);
        }

        this.queue = await this.channel.assertQueue(this.configurations.queue.name, this.configurations.queue.options);

        if (this.configurations.exchange && this.configurations.exchange.name && this.configurations.exchange.name !== '') {
            await Promise.all(this.configurations.routingKeys.map((rk) => this.channel.bindQueue(this.queue.queue, this.configurations.exchange.name, rk)));
        }

        this.channel.prefetch(this.configurations.consumer.options.prefetch);
    }

    async consume() {

        this.consumer = await this.channel.consume(this.queue.queue, async (message) => {

            try {
                message.content = message.content.toString();

                await this.configurations.consumer.receiveFunc(message);

                if (!this.configurations.consumer.options.noAck) {
                    this.channel.ack(message, this.configurations.consumer.options.allUpTo);
                }
            }
            catch (error) {
                if (!this.configurations.consumer.options.noAck) {
                    this.channel.nack(message, this.configurations.consumer.options.allUpTo, this.configurations.consumer.options.requeue);
                }

                if (this.configurations.debug && this.configurations.debug.enabled) {
                    if (!this.configurations.debug.queue.name || this.configurations.debug.queue.name === '') {
                        this.configurations.debug.queue.name = this.queue.queue.replace(/(\..[^.]*)$/, '.debug$1');
                    }

                    // TODO return internals.publish({ queue : this.configurations.debug.queue, message : JSON.stringify({ error, message }) });
                }
            }
        }, this.configurations.consumer.options);

        await this.configurations.consumer.waitingFunc();
    }

    close() {

        return this.channel.close();
    }
}

module.exports = Consumer;
