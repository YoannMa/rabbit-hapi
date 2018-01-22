'use strict';

const Joi     = require('joi');

module.exports.exchange = Joi.object({
    name    : Joi.string(),
    type    : Joi.string().default('fanout').valid(['direct', 'fanout', 'topic', 'header']),
    options : {
        durable           : Joi.string().default(true),
        internal          : Joi.string().default(false),
        autoDelete        : Joi.string().default(false),
        alternateExchange : Joi.string(),
        arguments         : Joi.object().default({})
    }
});

module.exports.debug = Joi.object({
    isActivated : Joi.boolean().default(false).required(),
    expires     : Joi.number().integer().positive().default(86400000),     // 24 hours
    durable     : Joi.boolean().default(true),
    persistent  : Joi.boolean().default(true),
    queue       : Joi.string().default('')
});

module.exports.consumer = Joi.object({
    options     : {
        consumerTag : Joi.string(),
        noLocal     : Joi.boolean().default(false),
        noAck       : Joi.boolean().default(false),
        exclusive   : Joi.boolean().default(false),
        priority    : Joi.string(),
        arguments   : Joi.object(),
        prefetch    : Joi.number().integer().positive()
    },
    receiveFunc : Joi.func().default(() => {}),
    waitingFunc : Joi.func().default(() => {})
});

module.exports.queue = Joi.object({
    name    : Joi.string(),
    options : {
        exclusive            : Joi.boolean().default(true),
        durable              : Joi.boolean().default(true),
        autoDelete           : Joi.boolean().default(true),
        arguments            : Joi.object().default({}),
        messageTtl           : Joi.number().integer().positive(),
        expires              : Joi.string(),
        deadLetterExchange   : Joi.string(),
        deadLetterRoutingKey : Joi.string(),
        maxLength            : Joi.number().integer().positive(),
        maxPriority          : Joi.string()
    }
});

module.exports.message = Joi.object({
    content : Joi.string().required(),
    options : {
        contentType     : Joi.string().default('application/json'),
        persistent      : Joi.boolean().default(true),
        expiration      : Joi.string(),
        userId          : Joi.string(),
        CC              : Joi.string(),
        priority        : Joi.string(),
        deliveryMode    : Joi.string(),
        mandatory       : Joi.string(),
        BCC             : Joi.string(),
        immediate       : Joi.string(),
        contentEncoding : Joi.string(),
        headers         : Joi.string(),
        correlationId   : Joi.string(),
        replyTo         : Joi.string(),
        messageId       : Joi.string(),
        timestamp       : Joi.string(),
        type            : Joi.string(),
        appId           : Joi.string()
    }
});
