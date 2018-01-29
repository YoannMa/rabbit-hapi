'use strict';

const Joi = require('joi');

module.exports.options = Joi.object({
    connection    : {
        hostname  : Joi.string().hostname().default('localhost'),
        port      : Joi.number().integer().positive().max(65535).default(5672),
        vhost     : Joi.string().default('/'),
        username  : Joi.string().default('guest'),
        password  : Joi.string().default('guest'),
        heartbeat : Joi.number().integer().positive().default(30),
        locale    : Joi.string().default('en_US'),
        frameMax  : Joi.number().integer().positive().default(0)
    },
    maxRetry      : Joi.number().integer().min(0).default(5),
    autoReconnect : Joi.boolean().default(true),
    maxDelay      : Joi.number().integer().positive().default(3600000),
    socketOptions : {
        timeout : Joi.number().integer().positive().default(3000)
    }
});

module.exports.exchange = Joi.object().keys({
    name    : Joi.string(),
    type    : Joi.string().default('fanout').valid(['direct', 'fanout', 'topic', 'header']),
    options : Joi.object().keys({
        durable           : Joi.boolean().default(true),
        internal          : Joi.boolean().default(false),
        autoDelete        : Joi.boolean().default(false),
        alternateExchange : Joi.string(),
        arguments         : Joi.object()
    }).default({ durable : true, internal : false, autoDelete : false })
});

module.exports.consumer = Joi.object().keys({
    options     : Joi.object().keys({
        consumerTag : Joi.string(),
        noLocal     : Joi.boolean().default(false),
        requeue     : Joi.boolean().default(true),
        noAck       : Joi.boolean().default(false),
        exclusive   : Joi.boolean().default(false),
        allUpTo     : Joi.boolean().default(false),
        priority    : Joi.number().integer(),
        arguments   : Joi.object(),
        prefetch    : Joi.number().integer().positive()
    }).default({ allUpTo : false, noAck : false }),
    receiveFunc : Joi.func().required().default(() => {}),
    waitingFunc : Joi.func().default(() => {})
});

module.exports.queue = Joi.object().keys({
    name    : Joi.string(),
    options : Joi.object().keys({
        exclusive            : Joi.boolean().default(false),
        durable              : Joi.boolean().default(true),
        autoDelete           : Joi.boolean().default(false),
        arguments            : Joi.object(),
        messageTtl           : Joi.number().integer().positive(),
        expires              : Joi.number().integer().positive(),
        deadLetterExchange   : Joi.string(),
        deadLetterRoutingKey : Joi.string(),
        maxLength            : Joi.number().integer().positive(),
        maxPriority          : Joi.number().integer().positive()
    }).default({ exclusive : false, durable : true, autoDelete : false })
});

module.exports.message = Joi.object().keys({
    content : Joi.string().required(),
    options : Joi.object().keys({
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
    }).default({ contentType : 'application/json', persistent : true })
});

module.exports.debug = Joi.object().keys({
    enabled    : Joi.boolean().default(false),
    expires    : Joi.number().integer().positive().default(86400000),     // 24 hours
    durable    : Joi.boolean().default(true),
    persistent : Joi.boolean().default(true),
    queue      : module.exports.queue
});
