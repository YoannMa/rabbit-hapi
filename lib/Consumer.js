'use strict';

const Emittery = require('emittery');

const Publisher = require('./Publisher');

/**
 * @Type Consumer
 */
class Consumer extends Emittery {

    constructor(connection, options) {

        super();

        this.configurations = options;
        this.connection     = connection;

        this.connection.on('reconnected', () => (this.subscribe()));
    }

    /**
     * @return {Promise<Consumer>}
     */
    async subscribe() {

        await this.assertRabbitInfra();

        await this.consume();

        return this;
    }

    /**
     * @private
     * @return {Promise<void>}
     */
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

    /**
     * @private
     * @return {Promise<void>}
     */
    async consume() {

        if (this.configurations.debug && this.configurations.debug.enabled) {
            if (!this.configurations.debug.queue.name || this.configurations.debug.queue.name !== '') {
                this.configurations.debug.queue.name = this.queue.queue.replace(/(\..[^.]*)$/, '.debug$1');
            }

            this.debugPublisher = new Publisher(this.channel, { queue : this.configurations.debug.queue });
        }

        this.consumer = await this.channel.consume(this.queue.queue, async (message) => {

            try {
                message.content = message.content.toString();

                await this.configurations.consumer.receiveFunc(message);

                if (!this.configurations.consumer.options.noAck) {
                    this.channel.ack(message, this.configurations.consumer.options.allUpTo);
                }
            }
            catch (error) {
                this.emit('log', { tags : ['error', 'AMQP', 'consumer'], message : error.message });

                if (!this.configurations.consumer.options.noAck) {
                    this.channel.nack(message, this.configurations.consumer.options.allUpTo, this.configurations.consumer.options.requeue);
                }

                if (this.configurations.debug && this.configurations.debug.enabled) {
                    await this.debugPublisher.publish(JSON.stringify({ error, message }));
                }
            }
        }, this.configurations.consumer.options);

        await this.configurations.consumer.waitingFunc();
    }

    /**
     * Close the current consumer
     *
     * @return {Promise<void>}
     */
    async close() {

        await this.consumer.cancel(this.consumer.consumerTag);
        return this.channel.close();
    }
}

module.exports = Consumer;
